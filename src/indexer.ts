// src/indexer.ts
import { CFG } from './config';
import { getLatestLedger } from './horizon';
import { getEventsRange } from './rpc';
import { PrismaClient } from '@prisma/client';
import {
  StellarHandlerKind, EventHandlerDef,
  eventMatchesHandler, DecodedEvent
} from './handlers';
import { decodeEnvelopeForTx } from './utils/tx-utils';
import e from 'express';

const prisma = new PrismaClient();
const CHUNK = 50;

// ==== Your handlers ====
async function handleMintEvent(ev: DecodedEvent) {
  console.log('[Mint]', ev.ledger, ev.contractId, ev.topicSignature, ev.data);
  try {
    const { data, timestamp, envelopeXdr } = await decodeEnvelopeForTx(ev.txHash);
    const constructorArgs =
    data.tx.tx.operations?.[0]?.body?.invoke_host_function?.host_function?.create_contract_v2?.constructor_args;
    console.log('[Mint] constructor args:', constructorArgs);
    console.log('[Mint] decoded envelope', constructorArgs?.[0]?.address, constructorArgs?.[1]?.u32);
    await prisma.teamFinanceToken.create({
      data: {
        txHash: ev.txHash,
        contractId: ev.contractId,
        address: ev.contractId,
        blockHeight: ev.ledger,
        sequence: ev.ledger,
        owner: ev.data,
        timestamp: BigInt(timestamp), // Convert to BigInt if needed
        // timestamp: BigInt(Date.parse(ev.ledger.toString())),
        name: constructorArgs?.[2]?.string || 'Unknown',
        symbol: constructorArgs?.[3]?.string || 'Unknown',
        decimals: constructorArgs?.[1]?.u32 || 0,
        totalSupply: BigInt(constructorArgs?.[4]?.i128) || BigInt(0),
        ipfs: constructorArgs?.[5]?.string || '',
        envelopeXdr,
      }
    });
    // console.log('[Mint] decoded envelope', {
    //   txHash: ev.txHash,
    //   envelopeType: summary.envelopeType,
    //   source: summary.source,
    //   fee: summary.fee,
    //   memo: summary.memo,
    //   ops: summary.operations
    // });

    // OPTIONAL: persist the decoded summary in another table
    // await prisma.decodedTx.upsert({ ... })

  } catch (e) {
    console.error('[Mint] envelope decode failed', ev.txHash, e);
  }
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
        // if (ev.txHash === '70b0f424306798f19a4ddc0f0521750e9ba815b5d83ccf94b4e937a34456634a') {
        //     console.log(`Checking event ${ev.txHash}`);
        //     // console.log('Event topics:', JSON.stringify(res));
        //     // console.log('Handler:', def);
        //   }
        for (const def of HANDLERS) {
          

          if (eventMatchesHandler(ev, def)) {
            // console.log(`Matched event ${ev.txHash} with handler ${def.filter.topics.join(', ')}`);
            // console.log('Event:', JSON.stringify(ev.dataPretty, null, 2));
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
