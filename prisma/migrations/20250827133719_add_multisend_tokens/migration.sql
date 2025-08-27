-- CreateTable
CREATE TABLE "multisendTokens" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "blockHeight" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "txHash" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "recipients" TEXT NOT NULL,
    "amounts" TEXT NOT NULL,
    "token_owner" TEXT,
    "token_name" TEXT NOT NULL,
    "token_symbol" TEXT NOT NULL,
    "token_totalSupply" TEXT NOT NULL,
    "token_decimals" INTEGER NOT NULL,
    "token_ipfs" TEXT,
    "from" TEXT NOT NULL,

    CONSTRAINT "multisendTokens_pkey" PRIMARY KEY ("id")
);
