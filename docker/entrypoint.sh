#!/usr/bin/env bash
set -euo pipefail

echo "⏳ Waiting for database..."
# pg_isready accepts a full connection URI via -d
until pg_isready -d "$DATABASE_URL" >/dev/null 2>&1; do
  sleep 1
done
echo "✅ Database is ready."

echo "🚀 Running Prisma migrations (deploy)..."
npx prisma migrate deploy

echo "▶️ Starting indexer..."
exec node dist/main.js
