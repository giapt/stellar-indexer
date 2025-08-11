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
      const head = await getLatestLedger();
      if (cursor > head) { await sleep(1000); continue; }

      const end = Math.min(cursor + CHUNK - 1, head);
      const { events } = await getEventsRange(cursor, end);

      if (events.length) {
        await prisma.sorobanEvent.createMany({
          data: events.map(e => ({
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

      console.log(`Indexed ledgers ${cursor}-${end}: ${events.length} events`);
      cursor = end + 1;
    } catch (err) {
      console.error(`Indexer loop error at cursor ${cursor}:`, err);
      await sleep(2000); // backoff and try the same range again
    }
  }
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
