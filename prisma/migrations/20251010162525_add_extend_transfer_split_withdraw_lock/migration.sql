-- CreateTable
CREATE TABLE "lockDurationExtendeds" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "blockHeight" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "lockContractAddress" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "depositId" TEXT NOT NULL,
    "unlockTime" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lockDurationExtendeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lockSplits" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "blockHeight" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "lockContractAddress" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "depositId" TEXT NOT NULL,
    "remainingAmount" TEXT NOT NULL,
    "splitLockId" BIGINT NOT NULL,
    "newSplitLockAmount" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lockSplits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transferLocks" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "blockHeight" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "lockContractAddress" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "depositId" TEXT NOT NULL,
    "receiverAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transferLocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logNftWithdrawals" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "blockHeight" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "lockContractAddress" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "depositId" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "tokenId" BIGINT NOT NULL,
    "withdrawalAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "deposit_withdrawn" BOOLEAN NOT NULL,
    "deposit_tokenId" BIGINT NOT NULL,
    "deposit_isNFT" BOOLEAN NOT NULL,
    "deposit_migratedLockDepositId" BIGINT NOT NULL,
    "deposit_isNFTMinted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logNftWithdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logTokenWithdrawals" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "blockHeight" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "lockContractAddress" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "depositId" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "withdrawalAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "deposit_withdrawn" BOOLEAN NOT NULL,
    "deposit_tokenId" BIGINT NOT NULL,
    "deposit_isNFT" BOOLEAN NOT NULL,
    "deposit_migratedLockDepositId" BIGINT NOT NULL,
    "deposit_isNFTMinted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logTokenWithdrawals_pkey" PRIMARY KEY ("id")
);
