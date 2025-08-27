-- CreateTable
CREATE TABLE "stakingPools" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "blockHeight" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "stakingContract" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "txHash" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "stakingToken" TEXT NOT NULL,
    "rewardToken" TEXT NOT NULL,
    "startTime" BIGINT NOT NULL,
    "endTime" BIGINT NOT NULL,
    "precision" TEXT NOT NULL,
    "totalReward" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "stakingToken_owner" TEXT,
    "stakingToken_name" TEXT NOT NULL,
    "stakingToken_symbol" TEXT NOT NULL,
    "stakingToken_totalSupply" TEXT NOT NULL,
    "stakingToken_decimals" INTEGER NOT NULL,
    "stakingToken_ipfs" TEXT,
    "rewardToken_owner" TEXT,
    "rewardToken_name" TEXT NOT NULL,
    "rewardToken_symbol" TEXT NOT NULL,
    "rewardToken_totalSupply" TEXT NOT NULL,
    "rewardToken_decimals" INTEGER NOT NULL,
    "rewardToken_ipfs" TEXT,
    "poolIndex" BIGINT NOT NULL,

    CONSTRAINT "stakingPools_pkey" PRIMARY KEY ("id")
);

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
