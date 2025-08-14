# Dockerfile
FROM node:20-slim
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl
# Install pg_isready (postgresql-client)
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client \
  && rm -rf /var/lib/apt/lists/*

# Install deps first (better layer caching)
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate

# Build sources
COPY . .
RUN npm run build

# Entrypoint
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV NODE_ENV=production
ENTRYPOINT ["/app/entrypoint.sh"]

