import 'dotenv/config';

export const CFG = {
  horizon: process.env.HORIZON_URL!,
  rpc: process.env.SOROBAN_RPC_URL!,
  startLedger: Number(process.env.START_LEDGER || 1),
  gqlPort: Number(process.env.GRAPHQL_PORT || 8080),
  databaseUrl: process.env.DATABASE_URL!,
  contractIds: (process.env.CONTRACT_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean),
  topicFilter: JSON.parse(process.env.TOPIC_FILTER || '[]') as string[][]
};