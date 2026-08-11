import { PrismaService } from 'src/common/database/prisma.service';

/**
 * Today's cash is a snapshot. Catching up history (backdated txs) must not
 * rewrite that snapshot — leftover / debt already lived in real life.
 */
export function isBackdated(date: Date, now = new Date()): boolean {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  return date < startOfToday;
}

export async function getAccountCurrentBalance(
  prisma: PrismaService,
  accountId: string,
): Promise<number | null> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: {
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

  return Number(account.openingBalance) + txDelta - transfersOut + transfersIn;
}

/** Adjust opening so computed currentBalance stays at `targetCurrent`. */
export async function pinAccountCurrentBalance(
  prisma: PrismaService,
  accountId: string,
  targetCurrent: number,
): Promise<void> {
  const current = await getAccountCurrentBalance(prisma, accountId);
  if (current == null) return;

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { openingBalance: true },
  });
  if (!account) return;

  const delta = current - Number(account.openingBalance);
  await prisma.account.update({
    where: { id: accountId },
    data: { openingBalance: targetCurrent - delta },
  });
}
