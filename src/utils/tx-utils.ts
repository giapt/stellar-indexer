import fetch from 'node-fetch';
import {
  TransactionBuilder,
  Networks,
  FeeBumpTransaction,
  Transaction
} from '@stellar/stellar-sdk';
import { CFG } from '../config';
import path from "node:path";
import fs from 'fs/promises';
import initWasm, { decode } from "@stellar/stellar-xdr-json";
type TransactionResp = {
    timestamp: string;
    envelopeXDR: string;
}
async function getTransactionEnvelopeXDR(txHash: string): Promise<TransactionResp> {
  const res = await fetch(`${CFG.horizon}/transactions/${txHash}`);
  if (!res.ok) throw new Error(`Horizon tx fetch failed: ${res.status}`);
  const j = await res.json() as any;
  console.log('Transaction created_at', j.created_at);
  const timestamp= Math.floor(new Date(j.created_at).getTime() / 1000).toString();
  return {
    envelopeXDR: j.envelope_xdr as string,
    timestamp
  };
}

function inferPassphraseFromHorizon(url: string): string {
  // crude but effective; make it explicit via env if you prefer
  return /testnet/i.test(url)
    ? Networks.TESTNET  // "Test SDF Network ; September 2015"
    : Networks.PUBLIC;  // "Public Global Stellar Network ; September 2015"
}

type DecodedOp = {
  type: string;
  source?: string;
  // you can add more fields per op type if you need them
  details: Record<string, unknown>;
};

type DecodedTxSummary = {
  envelopeType: 'feeBump' | 'regular';
  source: string;
  fee: string;
  memo?: string;
  operations: DecodedOp[];
};

function summarizeTransaction(tx: Transaction | FeeBumpTransaction): DecodedTxSummary {
  // Handle fee bump v. regular
  const isFeeBump = (tx as FeeBumpTransaction).innerTransaction !== undefined;

  const inner: Transaction = isFeeBump
    ? (tx as FeeBumpTransaction).innerTransaction
    : (tx as Transaction);

  const envelopeType = isFeeBump ? 'feeBump' : 'regular';
  const source = inner.source?.toString();
  const fee = inner.fee.toString();
  // memo can be TextMemo, IdMemo, HashMemo, ReturnHashMemo etc.
  const memo = inner.memo && inner.memo.value !== undefined
    ? String(inner.memo.value)
    : undefined;

  const operations: DecodedOp[] = inner.operations.map((op: any) => {
    const base: DecodedOp = {
      type: op.type,
      source: op.source ? op.source.toString() : undefined,
      details: {}
    };

    // Add some common fields; extend as you need
    switch (op.type) {
      case 'payment':
        base.details = {
          asset: op.asset?.toString(),
          amount: op.amount,
          destination: op.destination?.toString()
        };
        break;
      case 'createAccount':
        base.details = {
          destination: op.destination?.toString(),
          startingBalance: op.startingBalance
        };
        break;
      case 'invokeHostFunction':
        base.details = {
          // Soroban invocation, you can inspect deeper if needed
          function: op.func ? String(op.func) : undefined,
          paramsLen: Array.isArray(op.parameters) ? op.parameters.length : undefined
        };
        break;
      default:
        // fallback: shallow print
        base.details = Object.fromEntries(
          Object.entries(op)
            .filter(([k]) => !['type', 'source'].includes(k))
            .map(([k, v]) => [k, (typeof v === 'object' && v?.toString) ? v.toString() : v])
        );
    }

    return base;
  });

  return { envelopeType, source, fee, memo, operations };
}

type DecodedResp = {
  data: any,
  timestamp: string,
  envelopeXdr: string,
};

export async function decodeEnvelopeForTx(txHash: string): Promise<DecodedResp> {
  const { envelopeXDR, timestamp } = await getTransactionEnvelopeXDR(txHash);
  const keyFilePath = path.join(__dirname, "../../stellar_xdr_json_bg.wasm");
  const wasmBinary = await fs.readFile(keyFilePath);
await initWasm(wasmBinary);
    const decoded = decode('TransactionEnvelope', envelopeXDR);
    const data = JSON.parse(decoded);


  return {
    data,
    timestamp,
    envelopeXdr: envelopeXDR
  };
}
