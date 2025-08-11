-- CreateTable
CREATE TABLE "SorobanEvent" (
    "id" BIGSERIAL NOT NULL,
    "txHash" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "ledger" INTEGER NOT NULL,
    "topicSignature" TEXT NOT NULL,
    "topics" JSONB NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SorobanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_events_ledger" ON "SorobanEvent"("ledger");

-- CreateIndex
CREATE INDEX "idx_events_contract" ON "SorobanEvent"("contractId");

-- CreateIndex
CREATE INDEX "idx_events_signature" ON "SorobanEvent"("topicSignature");

-- CreateIndex
CREATE UNIQUE INDEX "SorobanEvent_txHash_contractId_ledger_topicSignature_key" ON "SorobanEvent"("txHash", "contractId", "ledger", "topicSignature");
