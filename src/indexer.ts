// src/indexer.ts
import { CFG } from './config';
import { getLatestLedger } from './horizon';
import { getEventsRange } from './rpc';
import {
  StellarHandlerKind, EventHandlerDef,
  eventMatchesHandler, DecodedEvent
} from './handlers';
// import { jsonPrismaSafe, toDbBigInt } from './utils/json-safe';
import { handleDepositEvent, handleUpdateMetadataEvent, 
  handleMintEvent, handleStakingPoolCreatedEvent, handleMultisendTokenEvent
} from './mappings/mappingHandlers';
import { prisma } from './prismaConfig'; // Ensure you have a Prisma client instance

const CHUNK = 100;


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
  {
    handler: handleDepositEvent,
    kind: StellarHandlerKind.Event,
    filter: { topics: ['TEAM_FINANCE_LOCKING', 'deposit', '*', '*'] },
  },
  {
    handler: handleStakingPoolCreatedEvent,
    kind: StellarHandlerKind.Event,
    filter: { topics: ['TEAM_FINANCE_STAKING', 'pool_created', '*', '*'] },
  },
  {
    handler: handleMultisendTokenEvent,
    kind: StellarHandlerKind.Event,
    filter: { topics: ['TEAM_FINANCE_MULTISENDER', 'multi_send_token', '*', '*'] },
  }
];
// ========================

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runIndexer() {
  let cursor = CFG.startLedger;

  for (;;) {
    try {
      const horizonHead = await getLatestLedger();
      let end = Math.min(cursor + CHUNK - 1, horizonHead);

      // Request ALL events (no filters)
      const res = await getEventsRange(cursor, end+1);
      // console.log(`RPC returned ${res.events} events for ledgers ${cursor}-${end}`, JSON.stringify(res, null, 2));

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
            network: 'stellar-testnet', // Adjust as needed
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
      // todo : check events length > 10000 then reset cursor

      // Wait at RPC head to avoid out-of-range spam
      if (res.latestLedger && end >= res.latestLedger) {
        console.log(`Reached RPC head at ledger ${res.latestLedger}, waiting for new block...`);
        await waitForNewLedger(res.latestLedger);
      }

      cursor = end + 1;
      await delay(500); // 200ms between requests
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
