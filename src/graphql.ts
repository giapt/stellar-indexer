import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import express from 'express';
import cors from 'cors';
import { json } from 'body-parser';
import { PrismaClient } from '@prisma/client';
import { CFG } from './config';

const prisma = new PrismaClient();

const typeDefs = /* GraphQL */ `
  scalar JSON

  type SorobanEvent {
    id: ID!
    txHash: String!
    contractId: String!
    ledger: Int!
    topicSignature: String!
    topics: JSON
    data: JSON
    createdAt: String
  }

  type Query {
    events(
      contractId: String
      topic: String
      fromLedger: Int
      toLedger: Int
      limit: Int = 100
      offset: Int = 0
    ): [SorobanEvent!]

    latestLedger: Int!
  }
`;

const resolvers = {
  JSON: {
    __serialize(v: any) { return v; },
    __parseValue(v: any) { return v; },
    __parseLiteral(ast: any) { return (ast as any).value; }
  },
  Query: {
    events: async (_: any, args: any) => {
      return prisma.sorobanEvent.findMany({
        where: {
          contractId: args.contractId || undefined,
          topicSignature: args.topic ? { contains: args.topic, mode: 'insensitive' } : undefined,
          ledger: args.fromLedger || args.toLedger ? {
            gte: args.fromLedger || undefined,
            lte: args.toLedger || undefined
          } : undefined
        },
        orderBy: [{ ledger: 'asc' }, { id: 'asc' }],
        take: Math.min(args.limit ?? 100, 1000),
        skip: args.offset ?? 0
      });
    },
    latestLedger: async () => {
      const r = await prisma.sorobanEvent.aggregate({ _max: { ledger: true } });
      return r._max.ledger ?? 0;
    }
  }
};

export async function startGraphQL() {
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();

  const app = express();
  app.use(cors(), json(), expressMiddleware(server));

  app.listen(CFG.gqlPort, () => {
    console.log(`🚀 GraphQL ready at http://0.0.0.0:${CFG.gqlPort}/`);
  });
}
