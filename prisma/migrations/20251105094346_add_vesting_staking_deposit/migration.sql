-- CreateTable
CREATE TABLE "vestingClaims" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "blockHeight" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "txHash" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "vesting" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "userVesting_totalClaimed" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vestingClaims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserVesting" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "vestingContractAddress" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "totalClaimed" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserVesting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stakingClaims" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "blockHeight" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "txHash" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "poolIndex" BIGINT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stakingClaims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stakingDeposits" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "blockHeight" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "txHash" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "poolIndex" BIGINT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stakingDeposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stakingWithdraws" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "blockHeight" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "txHash" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "poolIndex" BIGINT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stakingWithdraws_pkey" PRIMARY KEY ("id")
);
