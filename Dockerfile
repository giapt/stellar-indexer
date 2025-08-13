FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl
# If you run on arm64 hosts, this image works on arm64 too.
WORKDIR /app

# Install deps first for better caching
COPY package*.json ./
COPY prisma ./prisma

RUN npm ci
# Generate Prisma Client *inside* the image so binaries match the base
RUN npx prisma generate

# Now copy source and build
COPY . .
RUN npm run build

ENV NODE_ENV=dev
CMD ["node", "dist/main.js"]
