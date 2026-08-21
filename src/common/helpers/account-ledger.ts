import { PrismaService } from 'src/common/database/prisma.service';

const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export function calendarDateInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Stored tx dates are UTC midnight of the calendar day the user picked.
 * Compare that day to "today" in the user's timezone.
 */
export function isLiveToday(
  date: Date,
  timeZone = DEFAULT_TIMEZONE,
  now = new Date(),
): boolean {
  return (
    calendarDateInTimeZone(date, 'UTC') ===
    calendarDateInTimeZone(now, timeZone)
  );
}

/**
 * Today's cash/bank is a snapshot. Catch-up (past or future dates) must not
 * rewrite that number — leftover / debt already lived in real life.
 */
export function shouldPreserveCurrentBalance(
  date: Date,
  override?: boolean,
  timeZone = DEFAULT_TIMEZONE,
  now = new Date(),
): boolean {
  if (override !== undefined) return override;
  return !isLiveToday(date, timeZone, now);
}

/** @deprecated Use shouldPreserveCurrentBalance — also true for future dates. */
export function isBackdated(
  date: Date,
  now = new Date(),
  timeZone = DEFAULT_TIMEZONE,
): boolean {
  return !isLiveToday(date, timeZone, now);
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
