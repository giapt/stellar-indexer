/*
  Warnings:

  - The primary key for the `teamFinanceTokens` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `network` to the `SorobanEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `network` to the `teamFinanceTokens` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SorobanEvent" ADD COLUMN     "network" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "teamFinanceTokens" DROP CONSTRAINT "teamFinanceTokens_pkey",
ADD COLUMN     "network" TEXT NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "teamFinanceTokens_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "teamFinanceTokens_id_seq";

-- CreateTable
CREATE TABLE "DepositDetail" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "withdrawalAddress" TEXT NOT NULL,
    "tokenAmount" BIGINT NOT NULL,
    "unlockTime" BIGINT NOT NULL,
    "withdrawn" BOOLEAN NOT NULL,
    "tokenId" BIGINT NOT NULL,
    "isNFT" BOOLEAN NOT NULL,
    "migratedLockDepositId" BIGINT NOT NULL,
    "isNFTMinted" BOOLEAN NOT NULL,

    CONSTRAINT "DepositDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposits" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "blockHeight" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "lockContractAddress" TEXT NOT NULL,
    "depositId" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "withdrawalAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "unlockTime" BIGINT NOT NULL,
    "txHash" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "senderAddress" TEXT NOT NULL,
    "token_owner" TEXT,
    "token_name" TEXT NOT NULL,
    "token_symbol" TEXT NOT NULL,
    "token_totalSupply" TEXT NOT NULL,
    "token_decimals" INTEGER NOT NULL,
    "token_ipfs" TEXT,
    "deposit_withdrawn" BOOLEAN NOT NULL,
    "deposit_tokenId" BIGINT NOT NULL,
    "deposit_isNFT" BOOLEAN NOT NULL,
    "deposit_migratedLockDepositId" BIGINT NOT NULL,
    "deposit_isNFTMinted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "totalSupply" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "ipfs" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deposit_idx_lock_contract" ON "deposits"("depositId");
