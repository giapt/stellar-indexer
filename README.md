# Stellar Soroban Indexer

A TypeScript-based blockchain indexer for the Stellar network with Soroban smart contract support.  
This service connects to Horizon and Soroban RPC APIs, processes events from a specified starting ledger, stores them in PostgreSQL, and exposes a GraphQL API for querying indexed data.

---

## Features

- **Fetch events from custom start ledger** using Soroban RPC `getEvents` API.
- **No topic filter at RPC level** — all events fetched and filtered locally by topic signature.
- **Base64 → human-readable decoding** for topics and event data.
- **Transaction envelope decoding** to extract constructor args and other details.
- **PostgreSQL storage** with Prisma ORM.
- **GraphQL endpoint** for indexed events and token mint data.
- **Dockerized build** for easy deployment.
- **Migration scripts** for schema changes.
- **Rate-limit friendly** — supports delays between RPC calls.

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
```

## Configuration

Copy `.env.example` to `.env` and update values:

```bash
HORIZON_URL=https://horizon-testnet.stellar.org
SOROBAN_RPC_URL=https://rpc-futurenet.stellar.org
START_LEDGER=900000
DATABASE_URL=postgresql://user:password@localhost:5432/stellar_indexer
GQL_PORT=8080
```

## Database
Run migrations
```bash
npx prisma migrate deploy
```

Reset database (truncate tables & re-run migrations)
```bash
npm run reset:db
```

Add migration
```bash
update schema.prisma
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
or
```bash
docker compose up --build -d
```

## GraphQL
Once running, the GraphQL API is available at:

```bash
http://localhost:8080/
```
Example query:

```graphql
{
  teamFinanceTokens(limit: 10) {
    id
    amount
    contractId
    txHash
    timestamp
  }
}
```

## Scripts
`npm run dev` — Start in development mode with ts-node

`npm run build` — Compile TypeScript

`npm start` — Run compiled JS

`npm run reset:db` — Truncate tables & re-run migrations

`npm run gen:gql` — Generate src/graphql.ts from schema.prisma

## Project Structure
```graphql
src/
 ├── config.ts          # App config
 ├── db.ts              # Database connection (Prisma)
 ├── rpc.ts             # Soroban & Horizon RPC helpers
 ├── indexer.ts         # Main indexer loop
 ├── graphql.ts         # GraphQL typeDefs & resolvers
 ├── handlers/          # Event handlers
 ├── utils/             # Helper functions
prisma/
 ├── schema.prisma      # Database schema
scripts/
 ├── reset-db.ts        # Truncate & migrate DB
 ├── gen-graphql.ts     # Generate GraphQL schema/resolvers
```