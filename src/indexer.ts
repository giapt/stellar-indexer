import { CFG } from './config';
import { getLatestLedger } from './horizon';
import { getEventsRange } from './rpc';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CHUNK = 200;

export async function runIndexer() {
  let cursor = CFG.startLedger;

  for (;;) {
    try {
      const horizonHead = await getLatestLedger();
      let end = Math.min(cursor + CHUNK - 1, horizonHead);

      const res = await getEventsRange(cursor, end);

      // Outside window → reposition and retry
      if (!res.events.length && res.rangeHint) {
        const { min, max } = res.rangeHint;
        const newStart = Math.max(min, max - CHUNK + 1);
        console.warn(`Cursor ${cursor}-${end} outside RPC window ${min}-${max}. Repositioning to ${newStart}.`);
        cursor = newStart;
        continue;
      }

      // Save events if we got any
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

      // If we're at the RPC's latest ledger, wait for a new one
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
    await sleep(2000); // poll every 2s
    const latest = await getLatestLedger();
    if (latest > lastLedger) {
      console.log(`New ledger ${latest} detected, resuming...`);
      return;
    }
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
