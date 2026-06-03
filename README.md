# Stellar Soroban Indexer

A TypeScript-based blockchain indexer for the Stellar network, tracking **Team Finance** Soroban smart contract events on both mainnet and testnet simultaneously.

This service connects to Horizon and Soroban RPC APIs, processes events from a specified starting ledger, stores them in PostgreSQL, and exposes a GraphQL API for querying indexed data.

---

## Features

- **Multi-network indexing** — indexes Stellar mainnet and testnet concurrently.
- **17 event handlers** across 5 Team Finance contracts (Token, Locking, Staking, Multisender, Vesting).
- **Transaction envelope decoding** via WASM-based XDR decoder.
- **Token metadata enrichment** — fetches name, symbol, decimals, owner via Soroban contract simulation.
- **PostgreSQL storage** with Prisma ORM (20 models).
- **Dual GraphQL API** — Apollo Server + Hasura GraphQL Engine.
- **Concurrent handler processing** with bounded parallelism (max 10 in-flight).
- **WASM caching** — XDR decoder initialized once and reused.
- **Envelope caching** — decoded transactions cached by txHash to avoid duplicate Horizon fetches.
- **Dockerized deployment** with PostgreSQL + Hasura + Indexer stack.

---

## Indexed Events

| Contract | Events |
|---|---|
| **TEAM_FINANCE_TOKEN** | `mint`, `update_metadata` |
| **TEAM_FINANCE_LOCKING** | `deposit`, `lp_deposit`, `deposit_nft`, `token_lock_transferred`, `lock_split`, `log_token_withdrawal`, `log_nft_withdrawal`, `lock_duration_extended` |
| **TEAM_FINANCE_STAKING** | `pool_created`, `claim`, `deposit`, `withdraw` |
| **TEAM_FINANCE_MULTISENDER** | `multi_send_token` |
| **TEAM_FINANCE_VESTING_FACTORY** | `vesting_created` |
| **TEAM_FINANCE_VESTING** | `claim` |

---

## Requirements

- Node.js >= 18
- PostgreSQL >= 14
- Docker & Docker Compose (optional but recommended)
- Stellar Soroban RPC endpoint & Horizon endpoint

---

## Installation

```bash
# Clone repository
git clone https://github.com/<your-username>/stellar-indexer.git
cd stellar-indexer

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate
```

## Configuration

Copy `.env.example` to `.env` and update values:

```env
# Stellar RPC & Horizon URLs
STELLAR_MAINNET_RPC_URL=https://soroban-rpc.mainnet.stellar.org
STELLAR_TESTNET_RPC_URL=https://soroban-rpc.testnet.stellar.org

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/stellar_indexer

# Starting ledgers (set to recent ledger for initial sync)
START_LEDGER_MAINNET=50000000
START_LEDGER_TESTNET=40000000

# Hasura
HASURA_GRAPHQL_ADMIN_SECRET=your-secret

# Debug logging
DEBUG=false
```

## Database

Run migrations:
```bash
npx prisma migrate deploy
```

Reset database (truncate tables & re-run migrations):
```bash
npm run reset:db
```

Add migration:
```bash
# Update prisma/schema.prisma first
npx prisma migrate dev -n migration_name
```

## Development

Run the indexer and GraphQL server in dev mode:

```bash
npm run dev
```

## Build & Run in Docker

```bash
docker build -t stellar-indexer .
docker run --env-file .env -p 8080:8080 stellar-indexer
```

Or with Docker Compose (PostgreSQL + Hasura + Indexer):
```bash
npx prisma generate
docker compose up --build -d
```

## GraphQL

Once running, the GraphQL API is available at:

```
http://localhost:8080/
```

Example query:

```graphql
{
  teamFinanceTokens(limit: 10) {
    id
    name
    symbol
    contractId
    txHash
    timestamp
    network
  }
}
```

Query deposits:
```graphql
{
  deposits(limit: 10, orderBy: { timestamp: desc }) {
    id
    tokenAddress
    amount
    token_name
    token_symbol
    unlockTime
    network
  }
}
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start in development mode with ts-node |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled JS |
| `npm run reset:db` | Truncate tables & re-run migrations |
| `npm run gen:gql` | Generate `src/graphql.ts` from `schema.prisma` |
| `npm run start:clean` | Reset DB then start |

## Project Structure

```
src/
├── main.ts                    # Entry point — launches indexers for all networks
├── indexer.ts                 # Core indexing loop with concurrent handler processing
├── config.ts                  # App configuration (network configs, env vars)
├── handlers.ts                # Event type definitions, topic matching logic
├── rpc.ts                     # Soroban RPC JSON-RPC client (getEvents, XDR decoding)
├── horizon.ts                 # Horizon API client (fetches latest ledger)
├── graphql.ts                 # Apollo Server GraphQL server (auto-generated)
├── prismaConfig.ts            # Shared PrismaClient singleton
├── topic-encoder.ts           # Encodes topic filters to base64 XDR
├── common/
│   └── chains.ts              # Network constants (RPC URLs, Horizon URLs, passphrases)
├── mappings/
│   └── mappingHandlers.ts     # All 17 event handler implementations
└── utils/
    ├── contract.ts            # Soroban contract simulation (getDepositDetails)
    ├── metadata.ts            # Token metadata fetching with DB caching
    ├── tx-utils.ts            # Transaction envelope decoding (WASM + cache)
    ├── json-helper.ts         # XDR JSON traversal helpers
    ├── json-safe.ts           # BigInt/Uint8Array → JSON-safe conversion
    └── prettyScVal.ts         # ScVal pretty-printing

prisma/
├── schema.prisma              # Database schema (20 models)
└── migrations/                # Database migrations

scripts/
├── gen-graphql.ts             # Auto-generates GraphQL resolvers from Prisma schema
└── reset-db.ts                # Truncates all tables and re-runs migrations

docker/
└── entrypoint.sh              # Docker entrypoint (wait for DB, migrate, start)

hasura-metadata/
└── hasura_metadata.json       # Hasura table permissions for public read access
```

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Soroban RPC │────▶│   Indexer    │────▶│  PostgreSQL  │
│  (getEvents) │     │   Loop       │     │  (Prisma)    │
└──────────────┘     └──────┬───────┘     └──────┬───────┘
                            │                     │
┌──────────────┐            │              ┌──────▼───────┐
│   Horizon    │◀───────────┘              │  GraphQL API │
│  (tx decode) │                           │  (Apollo)    │
└──────────────┘                           └──────────────┘
                                                    │
                                             ┌──────▼───────┐
                                             │    Hasura    │
                                             │  GraphQL     │
                                             └──────────────┘
```

The indexer runs an infinite loop per network:
1. Fetches events from Soroban RPC in chunks of 100 ledgers
2. Matches events against 17 handler definitions by topic signature
3. Processes matched handlers concurrently (max 10 in-flight)
4. Each handler decodes the transaction envelope, fetches token metadata, and writes to PostgreSQL
5. Raw events are batch-inserted via `createMany`
6. At chain head, waits for new ledgers before continuing
