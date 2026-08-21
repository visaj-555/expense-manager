export type FdCompounding = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

const TIMES_PER_YEAR: Record<FdCompounding, number> = {
  MONTHLY: 12,
  QUARTERLY: 4,
  YEARLY: 1,
};

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function addCalendarMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function daysBetween(from: Date, to: Date): number {
  const start = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((end - start) / 86_400_000);
}

export function compoundAmount(
  principal: number,
  annualRatePercent: number,
  years: number,
  compounding: FdCompounding,
): number {
  if (years <= 0) return roundMoney(principal);
  const n = TIMES_PER_YEAR[compounding];
  const r = annualRatePercent / 100;
  return roundMoney(principal * (1 + r / n) ** (n * years));
}

export interface FdInput {
  principal: number;
  interestRate: number;
  startDate: Date;
  tenureMonths: number;
  compounding: FdCompounding;
  now?: Date;
}

export interface FdSnapshot {
  principal: number;
  interestRate: number;
  startDate: Date;
  tenureMonths: number;
  compounding: FdCompounding;
  maturityDate: Date;
  maturityValue: number;
  currentValue: number;
  accruedInterest: number;
  daysElapsed: number;
  daysRemaining: number;
  totalDays: number;
  isMatured: boolean;
  progressPercent: number;
}

/**
 * Live FD value. No cron — call this whenever the account is fetched
 * (login, dashboard, accounts list). Growth is a function of start date,
 * rate, compounding, and "now".
 */
export function computeFixedDeposit(input: FdInput): FdSnapshot {
  const compounding = input.compounding ?? 'QUARTERLY';
  const now = input.now ?? new Date();
  const startDate = input.startDate;
  const maturityDate = addCalendarMonths(startDate, input.tenureMonths);
  const maturityYears = input.tenureMonths / 12;
  const maturityValue = compoundAmount(
    input.principal,
    input.interestRate,
    maturityYears,
    compounding,
  );

  const totalDays = Math.max(daysBetween(startDate, maturityDate), 1);
  const rawElapsed = daysBetween(startDate, now);
  const isMatured = rawElapsed >= totalDays;
  const daysElapsed = Math.min(Math.max(rawElapsed, 0), totalDays);
  const daysRemaining = Math.max(totalDays - daysElapsed, 0);
  const elapsedYears = Math.min(
    Math.max(rawElapsed, 0) / 365.25,
    maturityYears,
  );

  const currentValue = isMatured
    ? maturityValue
    : rawElapsed <= 0
      ? roundMoney(input.principal)
      : compoundAmount(
          input.principal,
          input.interestRate,
          elapsedYears,
          compounding,
        );

  return {
    principal: roundMoney(input.principal),
    interestRate: input.interestRate,
    startDate,
    tenureMonths: input.tenureMonths,
    compounding,
    maturityDate,
    maturityValue,
    currentValue,
    accruedInterest: roundMoney(currentValue - input.principal),
    daysElapsed,
    daysRemaining,
    totalDays,
    isMatured,
    progressPercent: roundMoney((daysElapsed / totalDays) * 100),
  };
}

export function toFdResponse(snapshot: FdSnapshot) {
  return {
    principal: snapshot.principal,
    interestRate: snapshot.interestRate,
    startDate: snapshot.startDate,
    tenureMonths: snapshot.tenureMonths,
    compounding: snapshot.compounding,
    maturityDate: snapshot.maturityDate,
    maturityValue: snapshot.maturityValue,
    accruedInterest: snapshot.accruedInterest,
    daysElapsed: snapshot.daysElapsed,
    daysRemaining: snapshot.daysRemaining,
    totalDays: snapshot.totalDays,
    isMatured: snapshot.isMatured,
    progressPercent: snapshot.progressPercent,
  };
}
