import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

config({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

const USER_ID = '8d72c90c-b582-4480-8d8f-f5f076321383';
const BANK_ACCOUNT_ID = 'e552ae38-1a46-4d0b-a787-98789167cd05';
const WALLET_ACCOUNT_ID = '273a4c2b-c75b-45f3-90e6-e949627ff72f';
const TRANSFER_NOTE = 'Office travel (wallet top-up)';
const TARGET_BANK_BALANCE = 740;
const TARGET_WALLET_BALANCE = 1200;

async function computeCurrentBalance(accountId: string) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: {
      name: true,
      openingBalance: true,
      transactions: {
        where: { type: { in: ['INCOME', 'EXPENSE'] } },
        select: { type: true, amount: true },
      },
      transfersFrom: { select: { amount: true } },
      transfersTo: { select: { amount: true } },
    },
  });

  if (!account) return null;

  const txDelta = account.transactions.reduce((sum, tx) => {
    const amt = Number(tx.amount);
    return tx.type === 'INCOME' ? sum + amt : sum - amt;
  }, 0);
  const transfersOut = account.transfersFrom.reduce(
    (sum, tr) => sum + Number(tr.amount),
    0,
  );
  const transfersIn = account.transfersTo.reduce(
    (sum, tr) => sum + Number(tr.amount),
    0,
  );

  return {
    name: account.name,
    openingBalance: Number(account.openingBalance),
    currentBalance:
      Number(account.openingBalance) + txDelta - transfersOut + transfersIn,
  };
}

async function pinAccountBalance(accountId: string, target: number) {
  const account = await computeCurrentBalance(accountId);
  if (!account) return;

  const delta = account.currentBalance - account.openingBalance;
  await prisma.account.update({
    where: { id: accountId },
    data: { openingBalance: target - delta },
  });
}

async function main() {
  const [wallet, officeTravel] = await Promise.all([
    prisma.account.findFirst({
      where: { id: WALLET_ACCOUNT_ID, userId: USER_ID },
      select: { id: true, name: true, type: true },
    }),
    prisma.category.findFirst({
      where: {
        userId: USER_ID,
        name: { equals: 'Office Travel', mode: 'insensitive' },
        type: 'EXPENSE',
      },
      select: { id: true, name: true },
    }),
  ]);

  if (!wallet) {
    throw new Error('Cash (wallet) account not found.');
  }

  if (wallet.name !== 'Cash') {
    await prisma.account.update({
      where: { id: wallet.id },
      data: { name: 'Cash' },
    });
  }
  if (!officeTravel) {
    throw new Error('Office Travel category not found.');
  }

  const officeTravelTxs = await prisma.transaction.findMany({
    where: { userId: USER_ID, categoryId: officeTravel.id, type: 'EXPENSE' },
    select: {
      id: true,
      accountId: true,
      amount: true,
      title: true,
      transactionDate: true,
    },
    orderBy: { transactionDate: 'asc' },
  });

  if (officeTravelTxs.length === 0) {
    console.log('No Office Travel expenses found. Nothing to do.');
    return;
  }

  const moved = await prisma.transaction.updateMany({
    where: {
      userId: USER_ID,
      categoryId: officeTravel.id,
      type: 'EXPENSE',
      accountId: { not: wallet.id },
    },
    data: {
      accountId: wallet.id,
      paymentMethod: 'CASH',
    },
  });

  await prisma.transfer.deleteMany({
    where: {
      userId: USER_ID,
      fromAccountId: BANK_ACCOUNT_ID,
      toAccountId: wallet.id,
      note: TRANSFER_NOTE,
    },
  });

  await prisma.transfer.createMany({
    data: officeTravelTxs.map((tx) => ({
      userId: USER_ID,
      fromAccountId: BANK_ACCOUNT_ID,
      toAccountId: wallet.id,
      amount: tx.amount,
      note: TRANSFER_NOTE,
      transferDate: tx.transactionDate,
    })),
  });

  await pinAccountBalance(BANK_ACCOUNT_ID, TARGET_BANK_BALANCE);
  await pinAccountBalance(wallet.id, TARGET_WALLET_BALANCE);

  const total = officeTravelTxs.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const bank = await computeCurrentBalance(BANK_ACCOUNT_ID);
  const walletBal = await computeCurrentBalance(wallet.id);

  console.log(`Office Travel expenses: ${officeTravelTxs.length}`);
  console.log(`  Moved onto Cash: ${moved.count}`);
  console.log(
    `  Bank → Cash top-ups: ${officeTravelTxs.length}  (₹${total.toLocaleString('en-IN')})`,
  );
  if (bank) {
    console.log(
      `  ${bank.name}: current ₹${bank.currentBalance.toLocaleString('en-IN')}`,
    );
  }
  if (walletBal) {
    console.log(
      `  ${walletBal.name}: current ₹${walletBal.currentBalance.toLocaleString('en-IN')}`,
    );
  }
}

main()
  .catch((error) => {
    console.error('Office-travel wallet seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
