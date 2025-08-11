import { Pool } from 'pg';
import { CFG } from './config';

export const pool = new Pool({
  connectionString: CFG.databaseUrl,
  // Optional: enable SSL via env if your DB requires it (e.g., cloud providers)
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

export async function upsertEvent(e: {
  txHash: string;
  contractId: string;
  ledger: number;
  topicSignature: string;
  topics: any[];
  data: any;
}) {
  await pool.query(
    `INSERT INTO soroban_events
     (tx_hash, contract_id, ledger, topic_signature, topics, data)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (tx_hash, contract_id, ledger, topic_signature) DO NOTHING`,
    [e.txHash, e.contractId, e.ledger, e.topicSignature, JSON.stringify(e.topics), JSON.stringify(e.data)]
  );
}
