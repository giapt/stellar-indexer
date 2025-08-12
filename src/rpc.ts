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
  topics?: string[];  // base64 XDR (xdrFormat: 'base64')
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
 * Fetch ALL events from Soroban RPC in [startLedger, endLedger], with NO filters.
 * Filtering by topic/contract is done later in code via handlers.
 */
export async function getEventsRange(
  startLedger: number,
  endLedger: number
): Promise<GetEventsResult> {
  const reqBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'getEvents',
    params: {
      startLedger,
      endLedger,
      filters: [],         // <- NO FILTERS (catch-all)
      xdrFormat: 'base64', // topics/value come back as base64 XDR
    },
  };

  if (DEBUG) {
    console.log('RPC getEvents request window', { startLedger, endLedger });
    // console.dir({ filters: [] }, { depth: null });
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
  const topicB64s = (e as any).topics ?? (e as any).topic ?? [];
  const decodedTopicsRaw = (topicB64s as string[]).map(decodeScValBase64);

  const valueB64 = (e as any).value ?? (e as any).data;
  const decodedValueRaw  = decodeScValBase64(valueB64);

  const decodedTopics = jsonSafe(decodedTopicsRaw);
  const decodedValue  = jsonSafe(decodedValueRaw);

  const topicSignature = decodedTopicsRaw.map(toSigPiece).join(':');

  return {
    txHash: e.txHash,
    contractId: e.contractId || '',
    ledger: e.ledger,
    topicSignature,
    topics: decodedTopics,
    data: decodedValue,
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
