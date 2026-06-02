// src/indexer.ts
import { getLatestLedger } from './horizon';
import { getEventsRange } from './rpc';
import {
  StellarHandlerKind, EventHandlerDef,
  eventMatchesHandler, DecodedEvent
} from './handlers';
// import { jsonPrismaSafe, toDbBigInt } from './utils/json-safe';
import { handleDepositEvent, handleUpdateMetadataEvent,
  handleMintEvent, handleStakingPoolCreatedEvent,
  handleMultisendTokenEvent, handleVestingCreatedEvent,
  handleLpDepositEvent, handleNftDepositEvent,
  handleTransferLockEvent, handleSplitLockEvent,
  handleTokenWithdrawEvent, handleVestingClaimedEvent,
  handleExtendLockDurationEvent, handleNftWithdrawEvent,
  handleStakingClaimEvent, handleStakingDepositEvent,
  handleStakingWithdrawEvent
} from './mappings/mappingHandlers';
import { prisma } from './prismaConfig'; // Ensure you have a Prisma client instance
import { NetworkConfig } from './config';

// Simple concurrency limiter (avoids ESM-only p-limit dependency)
function createConcurrencyLimit(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  function next() {
    active--;
    if (queue.length > 0) {
      const resolve = queue.shift()!;
      resolve();
    }
  }
  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= concurrency) {
      await new Promise<void>(resolve => queue.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      next();
    }
  };
}

const CHUNK = 100;
const HANDLER_CONCURRENCY = 10; // max concurrent handler executions per chunk

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
    handler: handleLpDepositEvent,
    kind: StellarHandlerKind.Event,
    filter: { topics: ['TEAM_FINANCE_LOCKING', 'lp_deposit', '*', '*'] },
  },
  {
    handler: handleTransferLockEvent,
    kind: StellarHandlerKind.Event,
    filter: { topics: ['TEAM_FINANCE_LOCKING', 'token_lock_transferred', '*', '*'] },
  },
  {
    handler: handleSplitLockEvent,
    kind: StellarHandlerKind.Event,
    filter: { topics: ['TEAM_FINANCE_LOCKING', 'lock_split', '*', '*'] },
  },
  {
    handler: handleTokenWithdrawEvent,
    kind: StellarHandlerKind.Event,
    filter: { topics: ['TEAM_FINANCE_LOCKING', 'log_token_withdrawal', '*', '*'] },
  },
  {
    handler: handleNftWithdrawEvent,
    kind: StellarHandlerKind.Event,
    filter: { topics: ['TEAM_FINANCE_LOCKING', 'log_nft_withdrawal', '*', '*'] },
  },
  {
    handler: handleNftDepositEvent,
    kind: StellarHandlerKind.Event,
    filter: { topics: ['TEAM_FINANCE_LOCKING', 'deposit_nft', '*', '*'] },
  },
  {
    handler: handleExtendLockDurationEvent,
    kind: StellarHandlerKind.Event,
    filter: { topics: ['TEAM_FINANCE_LOCKING', 'lock_duration_extended', '*', '*'] },
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
  },
  {
    handler: handleVestingCreatedEvent,
    kind: StellarHandlerKind.Event,
    filter: { topics: ['TEAM_FINANCE_VESTING_FACTORY', 'vesting_created', '*', '*'] },
  },
  {
    handler: handleVestingClaimedEvent,
    kind: StellarHandlerKind.Event,
    filter: { topics: ['TEAM_FINANCE_VESTING', 'claim', '*', '*'] },
  },
  {
    handler: handleStakingClaimEvent,
    kind: StellarHandlerKind.Event,
    filter: { topics: ['TEAM_FINANCE_STAKING', 'claim', '*', '*'] },
  },
  {
    handler: handleStakingDepositEvent,
    kind: StellarHandlerKind.Event,
    filter: { topics: ['TEAM_FINANCE_STAKING', 'deposit', '*', '*'] },
  },
  {
    handler: handleStakingWithdrawEvent,
    kind: StellarHandlerKind.Event,
    filter: { topics: ['TEAM_FINANCE_STAKING', 'withdraw', '*', '*'] },
  },
];
// ========================

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runIndexer(net: NetworkConfig) {
  let cursor = net.startLedger;
  console.log(`Starting indexer for ${net.name} from ledger ${cursor}...`);

  for (;;) {
    try {
      const horizonHead = await getLatestLedger(net);
      let end = Math.min(cursor + CHUNK - 1, horizonHead);

      // Request ALL events (no filters)
      const res = await getEventsRange(net.rpc,cursor, end+1);
      // console.log(`RPC returned ${res.events} events for ledgers ${cursor}-${end}`, JSON.stringify(res, null, 2));

      // If outside window, your previous reposition logic can stay here (if you kept it in rpc.ts, expose rangeHint)
      if (!res.events.length && (res as any).rangeHint) {
        const { min, max } = (res as any).rangeHint!;
        const newStart = Math.max(min, max - CHUNK + 1);
        console.warn(`Cursor ${cursor}-${end} outside RPC window ${min}-${max}. Repositioning to ${newStart}.`);
        cursor = newStart;
        continue;
      }

      // Match events against handlers — process concurrently with bounded parallelism
      const limit = createConcurrencyLimit(HANDLER_CONCURRENCY);
      const matched: DecodedEvent[] = [];
      const handlerPromises: Promise<void>[] = [];
      for (const ev of res.events) {
        for (const def of HANDLERS) {
          if (eventMatchesHandler(ev, def)) {
            matched.push(ev);
            handlerPromises.push(limit(async () => { await def.handler(ev, net); }));
            break; // stop at first match; remove if multiple handlers can apply
          }
        }
      }
      const results = await Promise.allSettled(handlerPromises);
      for (const r of results) {
        if (r.status === 'rejected') {
          console.error(`Handler error in chunk ${cursor}-${end}:`, r.reason);
        }
      }

      if (matched.length) {
        await prisma.sorobanEvent.createMany({
          data: matched.map(e => ({
            network: net.name, // Adjust as needed
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

      // console.log(`Indexed ledgers ${cursor}-${end}: total=${res.events.length}, matched=${matched.length}`);
      // todo : check events length > 10000 then reset cursor

      // Wait at RPC head to avoid out-of-range spam
      if (res.latestLedger && end >= res.latestLedger) {
        console.log(`Reached RPC head at ledger ${res.latestLedger}, waiting for new block...`);
        await waitForNewLedger(res.latestLedger, net);
      }

      cursor = end + 1;
      await delay(500); // 200ms between requests
    } catch (err) {
      console.error(`Indexer loop error at cursor ${cursor}:`, err);
      await sleep(2000);
    }
  }
}

// export async function runIndexer(net: NetworkConfig) {
//   let cursor = net.startLedger;

//   while (true) {
//     try {
//       const res = await getEventsRange(net.rpc, cursor, cursor + 199);

//       if (res.events.length) {
//         await prisma.sorobanEvent.createMany({
//           data: res.events.map(e => ({
//             network: net.name,   // 🔥 important
//             txHash: e.txHash,
//             contractId: e.contractId,
//             ledger: e.ledger,
//             topicSignature: e.topicSignature,
//             topics: e.topics,
//             data: e.data,
//           })),
//           skipDuplicates: true,
//         });

//       }

//       cursor += 200;

//       await delay(200);

//     } catch (e) {
//       console.error(`[${net.name}] error`, e);
//       await delay(1000);
//     }
//   }
// }

async function waitForNewLedger(lastLedger: number, network: NetworkConfig) {
  for (;;) {
    await sleep(2000);
    const latest = await getLatestLedger(network);
    if (latest > lastLedger) {
      console.log(`New ledger ${latest} detected, resuming...`);
      return;
    }
  }
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
