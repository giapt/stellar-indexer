FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma

ENV NODE_ENV=production
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma generate && npm start"]
