import fetch from 'node-fetch';
import { CFG } from './config';
import { xdr, scValToNative } from '@stellar/stellar-sdk';

type RpcEvent = { txHash: string; contractId?: string; ledger: number; topics?: string[]; value?: string };
type RpcOk = { jsonrpc: string; id: number; result?: { events?: RpcEvent[]; latestLedger?: number } };
type RpcErr = { jsonrpc: string; id: number; error?: { code: number; message: string; data?: any } };
type JsonRpcResponse = RpcOk | RpcErr;

function decodeScValBase64(b64?: string) {
  if (!b64) return undefined;
  try {
    const v = xdr.ScVal.fromXDR(b64, 'base64');
    return scValToNative(v); // may include bigint, Uint8Array, address objects, etc.
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
    // Soroban address objects often look like { address: "G..." }
    if ('address' in v && typeof v.address === 'string') return v.address;
    return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, jsonSafe(val)]));
  }
  return String(v);
}

function toSigPiece(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Uint8Array) return '0x' + Buffer.from(v).toString('hex');
  if (typeof v === 'object' && 'address' in v && typeof (v as any).address === 'string') return (v as any).address;
  return JSON.stringify(v);
}

export async function getEventsRange(startLedger: number, endLedger: number) {
  const filters: any[] = [{ type: 'contract' }];
  if (CFG.contractIds.length) filters[0].contractIds = CFG.contractIds;
  if (CFG.topicFilter.length) filters[0].topics = CFG.topicFilter; // already encoded earlier

  const reqBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'getEvents',
    params: { startLedger, endLedger, filters, xdrFormat: 'base64' }
  };

  const res = await fetch(CFG.rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(reqBody) });

  let raw: unknown;
  try { raw = await res.json(); } catch {
    console.error('RPC non-JSON response', { status: res.status });
    return { events: [], latestLedger: 0, rangeHint: undefined as {min:number;max:number}|undefined };
  }
  const body = raw as JsonRpcResponse;

  if ('error' in body && body.error) {
    console.error('RPC error from getEvents:', body.error, 'request:', reqBody);
    const m = /ledger range:\s*(\d+)\s*-\s*(\d+)/i.exec(body.error.message || '');
    const rangeHint = m ? { min: Number(m[1]), max: Number(m[2]) } : undefined;
    return { events: [], latestLedger: 0, rangeHint };
  }

  const result = 'result' in body ? body.result : undefined;
  if (!result || !Array.isArray(result.events)) {
    console.warn('RPC unexpected payload (no result.events). Full body:', JSON.stringify(body));
    return { events: [], latestLedger: Number(result?.latestLedger || 0), rangeHint: undefined };
  }

  const events = result.events.map((e) => {
    const decodedTopicsRaw = (e.topics ?? []).map(decodeScValBase64);
    const decodedValueRaw  = decodeScValBase64(e.value);
    const decodedTopics    = jsonSafe(decodedTopicsRaw);
    const decodedValue     = jsonSafe(decodedValueRaw);
    const topicSignature   = (decodedTopicsRaw).map(toSigPiece).join(':');

    return {
      txHash: e.txHash,
      contractId: e.contractId || '',
      ledger: e.ledger,
      topicSignature,     // human-readable signature
      topics: decodedTopics, // JSON-safe
      data: decodedValue     // JSON-safe
    };
  });

  return { events, latestLedger: Number(result.latestLedger || 0), rangeHint: undefined };
}
