// src/indexer.ts
import { CFG } from './config';
import { getLatestLedger } from './horizon';
import { getEventsRange } from './rpc';
import { PrismaClient } from '@prisma/client';
import {
  StellarHandlerKind, EventHandlerDef,
  eventMatchesHandler, DecodedEvent
} from './handlers';

const prisma = new PrismaClient();
const CHUNK = 200;

// ==== Your handlers ====
async function handleMintEvent(ev: DecodedEvent) {
  console.log('[Mint]', ev.ledger, ev.contractId, ev.topicSignature, ev.data);
}
async function handleUpdateMetadataEvent(ev: DecodedEvent) {
  console.log('[UpdateMetadata]', ev.ledger, ev.contractId, ev.topicSignature, ev.data);
}

const HANDLERS: EventHandlerDef[] = [
  {
    handler: handleMintEvent,
    kind: StellarHandlerKind.Event,
    filter: { topics: ['TEAM_FINANCE_TOKEN', 'mint', '*', '*'] },
  },
  {
    handler: handleUpdateMetadataEvent,
    kind: StellarHandlerKind.Event,
    filter: { topics: ['TEAM_FINANCE_TOKEN', 'update_metadata', '*', '*'] },
  },
];
// ========================

export async function runIndexer() {
  let cursor = CFG.startLedger;

  for (;;) {
    try {
      const horizonHead = await getLatestLedger();
      let end = Math.min(cursor + CHUNK - 1, horizonHead);

      // Request ALL events (no filters)
      const res = await getEventsRange(cursor, end);

      // If outside window, your previous reposition logic can stay here (if you kept it in rpc.ts, expose rangeHint)
      if (!res.events.length && (res as any).rangeHint) {
        const { min, max } = (res as any).rangeHint!;
        const newStart = Math.max(min, max - CHUNK + 1);
        console.warn(`Cursor ${cursor}-${end} outside RPC window ${min}-${max}. Repositioning to ${newStart}.`);
        cursor = newStart;
        continue;
      }

      // Match events against handlers
      const matched: DecodedEvent[] = [];
      for (const ev of res.events) {
        // if (ev.txHash === '64208a4f645089ddecb1cb242affbf519ff934e41e44208709f86a3d24b6afb7') {
        //     console.log(`Checking event ${ev.txHash}`);
        //     // console.log('Event topics:', JSON.stringify(res));
        //     // console.log('Handler:', def);
        //   }
        for (const def of HANDLERS) {
          

          if (eventMatchesHandler(ev, def)) {
            matched.push(ev);
            await def.handler(ev); // run handler
            break;                 // stop at first match; remove if multiple handlers can apply
          }
        }
      }

      if (matched.length) {
        await prisma.sorobanEvent.createMany({
          data: matched.map(e => ({
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

      console.log(`Indexed ledgers ${cursor}-${end}: total=${res.events.length}, matched=${matched.length}`);

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
