import 'dotenv/config';
import { SOROBAN_RPC_URL, HORIZON_URL, CHAIN_IDS, NETWORK_PASSPHRASE } from './common/chains';
export const CFG = {
  gqlPort: Number(process.env.GRAPHQL_PORT || 8080),
  databaseUrl: process.env.DATABASE_URL!,
  contractIds: (process.env.CONTRACT_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean),
  topicFilter: JSON.parse(process.env.TOPIC_FILTER || '[]') as string[][]
};

export type NetworkConfig = {
  name: typeof CHAIN_IDS.STELLAR_MAINNET | typeof CHAIN_IDS.STELLAR_TESTNET;
  horizon: string;
  rpc: string;
  startLedger: number;
  passphrase: string;
};

export const NETWORKS: NetworkConfig[] = [
  {
    name: CHAIN_IDS.STELLAR_MAINNET,
    horizon: HORIZON_URL.STELLAR_MAINNET,
    rpc: process.env.STELLAR_MAINNET_RPC_URL || SOROBAN_RPC_URL.STELLAR_MAINNET,
    startLedger: Number(process.env.START_LEDGER_MAINNET || 0),
    passphrase: NETWORK_PASSPHRASE.STELLAR_MAINNET,
  },
  {
    name: CHAIN_IDS.STELLAR_TESTNET,
    horizon: HORIZON_URL.STELLAR_TESTNET,
    rpc: SOROBAN_RPC_URL.STELLAR_TESTNET,
    startLedger: Number(process.env.START_LEDGER_TESTNET || 0),
    passphrase: NETWORK_PASSPHRASE.STELLAR_TESTNET,
  },
];