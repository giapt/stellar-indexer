import fetch from 'node-fetch';
import { CFG } from './config';
import { encodeTopicFilterHuman } from './topic-encoder';

type RpcEvent = { txHash: string; contractId?: string; ledger: number; topics?: any[]; value?: any; };
type RpcOk = { jsonrpc: string; id: number; result?: { events?: RpcEvent[]; latestLedger?: number } };
type RpcErr = { jsonrpc: string; id: number; error?: { code: number; message: string; data?: any } };
type JsonRpcResponse = RpcOk | RpcErr;

export async function getEventsRange(startLedger: number, endLedger: number) {
  const filters: any[] = [{ type: 'contract' }];

  if (CFG.contractIds.length) filters[0].contractIds = CFG.contractIds;

  // Convert human-readable topics to the base64-XDR form RPC expects
  // If you kept TOPIC_FILTER as raw base64 already, skip this and assign directly.
  if (CFG.topicFilter.length) {
    filters[0].topics = encodeTopicFilterHuman(CFG.topicFilter);
  }

  const reqBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'getEvents',
    params: { startLedger, endLedger, filters, xdrFormat: 'base64' } // response format; request topics are base64
  };

  const res = await fetch(CFG.rpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(reqBody)
  });

  let raw: unknown;
  try { raw = await res.json(); } catch {
    console.error('RPC non-JSON response', { status: res.status });
    return { events: [], latestLedger: 0 };
  }

  const body = raw as JsonRpcResponse;
  if ('error' in body && body.error) {
    console.error('RPC error from getEvents:', body.error, 'request:', reqBody);
    return { events: [], latestLedger: 0 };
  }

  const result = 'result' in body ? body.result : undefined;
  if (!result || !Array.isArray(result.events)) {
    console.warn('RPC unexpected payload (no result.events). Full body:', JSON.stringify(body));
    return { events: [], latestLedger: Number(result?.latestLedger || 0) };
  }

  // Build our normalized event objects (topics/value are base64 XDR strings in base64 mode)
  const events = result.events.map((e) => {
    // We'll keep topic as-is (array of base64 XDR strings) and topicSignature as a simple colon-joined helper
    const topics = e.topics ?? [];
    const topicSignature = topics.join(':'); // quick filter helper; decode if you need human-readable

    return {
      txHash: e.txHash,
      contractId: e.contractId || '',
      ledger: e.ledger,
      topicSignature,
      topics,
      data: e.value
    };
  });

  return { events, latestLedger: Number(result.latestLedger || 0) };
}
