-- CreateTable
CREATE TABLE "UserPool" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "poolIndex" BIGINT NOT NULL,
    "user" TEXT NOT NULL,
    "deposit" TEXT NOT NULL,
    "withdraw" TEXT NOT NULL,
    "claimed" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPool_pkey" PRIMARY KEY ("id")
);
