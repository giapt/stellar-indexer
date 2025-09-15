-- CreateTable
CREATE TABLE "lpDeposits" (
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

    CONSTRAINT "lpDeposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nftDeposits" (
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
    "tokenId" BIGINT NOT NULL,
    "nft_owner" TEXT,
    "nft_name" TEXT NOT NULL,
    "nft_symbol" TEXT NOT NULL,
    "nft_ipfs" TEXT,
    "deposit_withdrawn" BOOLEAN NOT NULL,
    "deposit_tokenId" BIGINT NOT NULL,
    "deposit_isNFT" BOOLEAN NOT NULL,
    "deposit_migratedLockDepositId" BIGINT NOT NULL,
    "deposit_isNFTMinted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nftDeposits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lp_deposit_idx_lock_contract" ON "lpDeposits"("depositId");

-- CreateIndex
CREATE INDEX "nft_deposit_idx_lock_contract" ON "nftDeposits"("depositId");
