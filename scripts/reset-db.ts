import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚨 Truncating all data...');
  // Turn off FK checks, truncate, turn back on
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "teamFinanceTokens", "SorobanEvent", "deposits", "token", "DepositDetail", "stakingPools", "multisendTokens", "vestings",
    "nftDeposits", "lpDeposits", "lockDurationExtendeds", "lockSplits", "transferLocks", "logNftWithdrawals", 
    "logTokenWithdrawals", "vestingClaims", "UserVesting", "stakingClaims", "stakingDeposits", "stakingWithdraws"  RESTART IDENTITY CASCADE;`);

  console.log('📦 Re-applying migrations...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });

  console.log('✅ Done.');
}

main()
  .catch((err) => {
    console.error('Error resetting DB:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
