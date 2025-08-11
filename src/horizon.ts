// src/horizon.ts
import fetch from 'node-fetch';
import { CFG } from './config';

type HorizonLedgersResp = {
  _embedded?: {
    records?: Array<{ sequence: string }>;
  };
};

export async function getLatestLedger(): Promise<number> {
  const res = await fetch(`${CFG.horizon}/ledgers?order=desc&limit=1`);
  if (!res.ok) throw new Error(`Horizon ${res.status}`);
  const json = (await res.json()) as HorizonLedgersResp;

  const seq = json._embedded?.records?.[0]?.sequence;
  return Number(seq ?? CFG.startLedger);
}
