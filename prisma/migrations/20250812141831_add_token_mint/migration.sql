-- CreateTable
CREATE TABLE "teamFinanceTokens" (
    "id" BIGSERIAL NOT NULL,
    "blockHeight" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "txHash" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "totalSupply" BIGINT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "ipfs" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "envelopeXdr" TEXT NOT NULL,

    CONSTRAINT "teamFinanceTokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_token_mint_contract" ON "teamFinanceTokens"("address");

-- CreateIndex
CREATE INDEX "idx_token_mint_ledger" ON "teamFinanceTokens"("blockHeight");

-- CreateIndex
CREATE UNIQUE INDEX "teamFinanceTokens_txHash_address_blockHeight_key" ON "teamFinanceTokens"("txHash", "address", "blockHeight");
