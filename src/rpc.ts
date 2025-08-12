// src/rpc.ts
import fetch from 'node-fetch';
import { xdr, scValToNative } from '@stellar/stellar-sdk';
import { CFG } from './config';
import type { DecodedEvent } from './handlers';

const DEBUG = process.env.DEBUG === 'true';

type RpcEventRaw = {
  txHash: string;
  contractId?: string;
  ledger: number;
  topics?: string[];  // base64 XDR (because we request xdrFormat: 'base64')
  value?: string;     // base64 XDR
};

type RpcOk = {
  jsonrpc: string;
  id: number;
  result?: {
    events?: RpcEventRaw[];
    latestLedger?: number;
  };
};

type RpcErr = {
  jsonrpc: string;
  id: number;
  error?: { code: number; message: string; data?: any };
};

type JsonRpcResponse = RpcOk | RpcErr;

export type GetEventsResult = {
  events: DecodedEvent[];
  latestLedger: number;
  rangeHint?: { min: number; max: number };
};

function decodeScValBase64(b64?: string) {
  if (!b64) return undefined;
  try {
    const v = xdr.ScVal.fromXDR(b64, 'base64');
    return scValToNative(v); // may include bigint, Uint8Array, {address}, etc.
  } catch {
    return undefined;
  }
}

// Recursively convert to JSON-safe values for Prisma JSON columns
function jsonSafe(v: any): any {
  if (v === null || v === undefined) return v;
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (v instanceof Uint8Array) return '0x' + Buffer.from(v).toString('hex');
  if (Array.isArray(v)) return v.map(jsonSafe);
  if (typeof v === 'object') {
    // Soroban address sometimes comes as { address: "G..." }
    if ('address' in v && typeof (v as any).address === 'string') return (v as any).address;
    return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, jsonSafe(val)]));
  }
  return String(v);
}

// Build a readable piece for the signature from a decoded topic element
function toSigPiece(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Uint8Array) return '0x' + Buffer.from(v).toString('hex');
  if (typeof v === 'object' && 'address' in v && typeof (v as any).address === 'string') return (v as any).address;
  return JSON.stringify(v);
}

/**
 * Fetch events from Soroban RPC in [startLedger, endLedger], using already-built rpcFilters.
 * rpcFilters is the array produced by buildRpcFiltersFromHandlers(...) in handlers.ts
 */
export async function getEventsRange(
  startLedger: number,
  endLedger: number,
  rpcFilters: any[]
): Promise<GetEventsResult> {
  const reqBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'getEvents',
    params: {
      startLedger,
      endLedger,
      filters: rpcFilters,
      xdrFormat: 'base64', // topics/value come back as base64 XDR
    },
  };

  if (DEBUG) {
    console.log('RPC getEvents request window', { startLedger, endLedger });
    // Avoid huge console spam but show filters structure
    try { console.dir({ filters: rpcFilters }, { depth: null }); } catch {}
  }

  const res = await fetch(CFG.rpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(reqBody),
  });

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    console.error('RPC non-JSON response', { status: res.status });
    return { events: [], latestLedger: 0 };
  }

  const body = raw as JsonRpcResponse;

  // JSON-RPC error handling (also try to parse retention window)
  if ('error' in body && body.error) {
    console.error('RPC error from getEvents:', body.error, 'request:', reqBody);
    const m = /ledger range:\s*(\d+)\s*-\s*(\d+)/i.exec(body.error.message || '');
    const rangeHint = m ? { min: Number(m[1]), max: Number(m[2]) } : undefined;
    return { events: [], latestLedger: 0, rangeHint };
  }

  const result = 'result' in body ? body.result : undefined;
  if (!result || !Array.isArray(result.events)) {
    console.warn('RPC unexpected payload (no result.events). Full body:', JSON.stringify(body));
    return { events: [], latestLedger: Number(result?.latestLedger || 0) };
  }

  // Decode topics + value and make JSON-safe
  const events: DecodedEvent[] = result.events.map((e) => {
    const decodedTopicsRaw = (e.topics ?? []).map(decodeScValBase64);
    const decodedValueRaw  = decodeScValBase64(e.value);

    const decodedTopics = jsonSafe(decodedTopicsRaw);
    const decodedValue  = jsonSafe(decodedValueRaw);

    const topicSignature = (decodedTopicsRaw).map(toSigPiece).join(':');

    return {
      txHash: e.txHash,
      contractId: e.contractId || '',
      ledger: e.ledger,
      topicSignature, // human-readable, e.g. TEAM_FINANCE_TOKEN:mint
      topics: decodedTopics, // JSON-safe
      data: decodedValue,    // JSON-safe
    };
  });

  if (DEBUG) {
    console.log('RPC getEvents response', {
      latestLedger: Number(result.latestLedger || 0),
      eventsCount: events.length,
    });
  }

  return { events, latestLedger: Number(result.latestLedger || 0) };
}

/**
 * Diagnostic helper: try progressively-relaxed filters to understand 0-event batches.
 *  1) exact filters
 *  2) wildcard topics (keep contractIds)
 *  3) no filters
 */
export async function probeEvents(
  startLedger: number,
  endLedger: number,
  rpcFilters: any[]
): Promise<void> {
  console.log('Probe: exact filters');
  let r = await getEventsRange(startLedger, endLedger, rpcFilters);
  console.log(' -> events:', r.events.length);

  if (r.events.length > 0) return;

  const wild = rpcFilters.map((f: any) => ({
    ...f,
    topics: Array.isArray(f.topics) ? f.topics.map(() => ['*', '*', '*', '*']) : undefined,
  }));
  console.log('Probe: wildcard topics (keep contractIds)');
  r = await getEventsRange(startLedger, endLedger, wild);
  console.log(' -> events:', r.events.length);

  if (r.events.length > 0) return;

  console.log('Probe: no filters at all');
  r = await getEventsRange(startLedger, endLedger, []);
  console.log(' -> events:', r.events.length);
}
