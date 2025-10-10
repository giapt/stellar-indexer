/*
  Warnings:

  - Added the required column `depositId` to the `DepositDetail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lockContractAddress` to the `DepositDetail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `token_decimals` to the `DepositDetail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `token_name` to the `DepositDetail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `token_symbol` to the `DepositDetail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `token_totalSupply` to the `DepositDetail` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DepositDetail" ADD COLUMN     "depositId" TEXT NOT NULL,
ADD COLUMN     "lockContractAddress" TEXT NOT NULL,
ADD COLUMN     "token_decimals" INTEGER NOT NULL,
ADD COLUMN     "token_ipfs" TEXT,
ADD COLUMN     "token_name" TEXT NOT NULL,
ADD COLUMN     "token_owner" TEXT,
ADD COLUMN     "token_symbol" TEXT NOT NULL,
ADD COLUMN     "token_totalSupply" TEXT NOT NULL,
ALTER COLUMN "tokenAmount" SET DATA TYPE TEXT;
