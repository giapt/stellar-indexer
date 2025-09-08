-- CreateTable
CREATE TABLE "vestings" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "blockHeight" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "txHash" TEXT NOT NULL,
    "factoryContractAddress" TEXT NOT NULL,
    "creator" TEXT NOT NULL,
    "vestingAddress" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "merkleRoot" TEXT NOT NULL,
    "tokenTotal" TEXT NOT NULL,
    "fee" TEXT NOT NULL,
    "claimed" TEXT NOT NULL,
    "vesting_list_hash" TEXT NOT NULL,
    "token_owner" TEXT,
    "token_name" TEXT NOT NULL,
    "token_symbol" TEXT NOT NULL,
    "token_totalSupply" TEXT NOT NULL,
    "token_decimals" INTEGER NOT NULL,
    "token_ipfs" TEXT,

    CONSTRAINT "vestings_pkey" PRIMARY KEY ("id")
);
