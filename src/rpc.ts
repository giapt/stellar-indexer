// src/rpc.ts
import fetch from 'node-fetch';
import { xdr, scValToNative } from '@stellar/stellar-sdk';
import { CFG } from './config';
import type { DecodedEvent } from './handlers';
import { prettyScVal } from './utils/prettyScVal';

const DEBUG = process.env.DEBUG === 'true';

type RpcEventRaw = {
  txHash: string;
  contractId?: string;
  ledger: number;
  // Providers may return topics under `topics` (array of base64 XDR) or `topic`
  topics?: string[];
  topic?: string[];
  // Value field may be `value` or `data` (base64 XDR)
  value?: string;
  data?: string;
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

// add pretty fields so callers can display Soroban-typed strings
type DecodedEventPlus = DecodedEvent & {
  topicsPretty?: string[];
  dataPretty?: string;
};

export type GetEventsResult = {
  events: DecodedEventPlus[];
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
  return JSON.stringify(v, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
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
      pagination: {
        limit: 10000,
      },
      filters: [],          // NO FILTERS: pull everything for the window
      xdrFormat: 'base64',  // topics/value come back as base64 XDR
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

  // Decode topics + value and make JSON-safe; also produce pretty-printed strings
  const events: DecodedEventPlus[] = result.events.map((e) => {
    // Providers may send `topics` or `topic`
    const topicB64s = (e.topics ?? e.topic ?? []) as string[];

    // Pretty strings (Soroban-typed) built straight from XDR
    const topicsPretty = topicB64s.map(b64 => {
      try { return prettyScVal(xdr.ScVal.fromXDR(b64, 'base64')); }
      catch { return '<invalid topic XDR>'; }
    });

    const valueB64 = e.value ?? e.data;
    const dataPretty = (() => {
      if (!valueB64) return undefined;
      try { return prettyScVal(xdr.ScVal.fromXDR(valueB64, 'base64')); }
      catch { return '<invalid value XDR>'; }
    })();

    // Native decode → JSON-safe
    const decodedTopicsRaw = topicB64s.map(decodeScValBase64);
    const decodedValueRaw  = decodeScValBase64(valueB64);

    const decodedTopics = jsonSafe(decodedTopicsRaw);
    const decodedValue  = jsonSafe(decodedValueRaw);

    const topicSignature = decodedTopicsRaw.map(toSigPiece).join(':');

    return {
      txHash: e.txHash,
      contractId: e.contractId || '',
      ledger: e.ledger,
      topicSignature,        // e.g., TEAM_FINANCE_TOKEN:mint
      topics: decodedTopics, // JSON-safe decoded array
      data: decodedValue,    // JSON-safe decoded value
      topicsPretty,          // e.g., ['"TEAM_FINANCE_TOKEN"sym','"mint"sym']
      dataPretty,            // e.g., '{"decimal"sym: 9u32, ...}'
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
