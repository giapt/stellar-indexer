import { Address, nativeToScVal } from '@stellar/stellar-sdk';

export enum StellarHandlerKind {
  Event = 'Event'
}

export type EventFilter = {
  contractId?: string;              // optional
  topics: (string | '*')[];         // human strings: ["TEAM_FINANCE_TOKEN","mint","*","*"]
};

export type EventHandlerDef = {
  handler: (ev: DecodedEvent) => Promise<void> | void;  // your function
  kind: StellarHandlerKind.Event;
  filter: EventFilter;
};

export type DecodedEvent = {
  txHash: string;
  contractId: string;
  ledger: number;
  topics: any[];         // decoded + JSON safe
  data: any;             // decoded + JSON safe
  topicSignature: string;// joined human signature, e.g. TEAM_FINANCE_TOKEN:mint
};

// ===== Encoding helpers (human -> base64 XDR) =====
function encodeTopicSegment(seg: string | '*'): string {
  if (seg === '*') return '*';
  // default: treat as symbol
  return nativeToScVal(seg, { type: 'symbol' }).toXDR('base64');
}

export function buildRpcFiltersFromHandlers(handlers: EventHandlerDef[]) {
  // Soroban RPC expects an array of filter objects:
  // [{ type:'contract', contractIds?:[], topics?: string[][] (b64 or '*') }]
  const filters: any[] = [];

  // group by contractId (optional)
  const byContract = new Map<string | undefined, EventFilter[]>();
  for (const h of handlers) {
    if (h.kind !== StellarHandlerKind.Event) continue;
    const key = h.filter.contractId;
    const arr = byContract.get(key) ?? [];
    arr.push(h.filter);
    byContract.set(key, arr);
  }

  for (const [contractId, filts] of byContract) {
    const f: any = { type: 'contract' };
    if (contractId) f.contractIds = [contractId];
    // topics: array of arrays
    f.topics = filts.map(flt => {
      const t = flt.topics.slice(0, 4); // up to 4
      while (t.length < 4) t.push('*'); // pad
      return t.map(encodeTopicSegment);
    });
    filters.push(f);
  }
  return filters;
}

// ===== Match decoded event to a handler (defense-in-depth) =====
export function eventMatchesHandler(ev: DecodedEvent, def: EventHandlerDef): boolean {
  if (def.filter.contractId && def.filter.contractId !== ev.contractId) return false;
  const want = def.filter.topics;
  const got = ev.topics; // decoded array
  // per-position match: '*' wildcard or exact (string compare; symbols become strings after decode)
  for (let i = 0; i < want.length; i++) {
    const w = want[i];
    if (w === '*') continue;
    const g = got[i];
    if (g === undefined) return false;
    const gs = typeof g === 'string' ? g : (typeof g?.address === 'string' ? g.address : JSON.stringify(g));
    if (gs !== w) return false;
  }
  return true;
}
