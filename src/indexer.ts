import { CFG } from './config';
import { getLatestLedger } from './horizon';
import { getEventsRange } from './rpc';
import { PrismaClient } from '@prisma/client';
import {
  StellarHandlerKind, EventHandlerDef, buildRpcFiltersFromHandlers,
  eventMatchesHandler, DecodedEvent
} from './handlers';

const prisma = new PrismaClient();
const CHUNK = 200;

// ==== YOUR HANDLERS (add more as needed) ====
async function handleMintEvent(ev: DecodedEvent) {
  // Example: log or write to an extra table, queue, etc.
  console.log('[Mint]', ev.ledger, ev.contractId, ev.topicSignature, ev.data);
  // You already insert all events below; if you want a special table, do it here with prisma.*
}

async function handleUpdateMetadataEvent(ev: DecodedEvent) {
  console.log('[UpdateMetadata]', ev.ledger, ev.contractId, ev.topicSignature, ev.data);
}

const HANDLERS: EventHandlerDef[] = [
  {
    handler: handleMintEvent,
    kind: StellarHandlerKind.Event,
    filter: {
      // contractId: 'CCF4...XQHV', // optional narrow
      topics: ['TEAM_FINANCE_TOKEN','mint','*','*'],
    },
  },
  {
    handler: handleUpdateMetadataEvent,
    kind: StellarHandlerKind.Event,
    filter: {
      topics: ['TEAM_FINANCE_TOKEN','update_metadata','*','*'],
    },
  }
];
// ============================================

export async function runIndexer() {
  let cursor = CFG.startLedger;
  const rpcFilters = buildRpcFiltersFromHandlers(HANDLERS);

  for (;;) {
    try {
      const horizonHead = await getLatestLedger();
      let end = Math.min(cursor + CHUNK - 1, horizonHead);

      const res = await getEventsRange(cursor, end, rpcFilters);

      if (!res.events.length && res.rangeHint) {
        const { min, max } = res.rangeHint;
        const newStart = Math.max(min, max - CHUNK + 1);
        console.warn(`Cursor ${cursor}-${end} outside RPC window ${min}-${max}. Repositioning to ${newStart}.`);
        cursor = newStart;
        continue;
      }

      // Optionally, run handler callbacks on matching events
      for (const ev of res.events) {
        for (const def of HANDLERS) {
          if (eventMatchesHandler(ev as DecodedEvent, def)) {
            await def.handler(ev as DecodedEvent);
          }
        }
      }

      // Persist events (all, or only matches—your choice)
      if (res.events.length) {
        await prisma.sorobanEvent.createMany({
          data: res.events.map(e => ({
            txHash: e.txHash,
            contractId: e.contractId,
            ledger: e.ledger,
            topicSignature: e.topicSignature,
            topics: e.topics as any,
            data: e.data as any
          })),
          skipDuplicates: true
        });
      }

      console.log(`Indexed ledgers ${cursor}-${end}: ${res.events.length} events`);

      // Wait at RPC head to avoid out-of-range spam
      if (res.latestLedger && end >= res.latestLedger) {
        console.log(`Reached RPC head at ledger ${res.latestLedger}, waiting for new block...`);
        await waitForNewLedger(res.latestLedger);
      }

      cursor = end + 1;
    } catch (err) {
      console.error(`Indexer loop error at cursor ${cursor}:`, err);
      await sleep(2000);
    }
  }
}

async function waitForNewLedger(lastLedger: number) {
  for (;;) {
    await sleep(2000);
    const latest = await getLatestLedger();
    if (latest > lastLedger) {
      console.log(`New ledger ${latest} detected, resuming...`);
      return;
    }
  }
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
