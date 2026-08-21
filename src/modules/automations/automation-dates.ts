import { RecurringFrequency } from 'src/generated/prisma/client';
import { calendarDateInTimeZone } from 'src/common/helpers/account-ledger';

const TIMEZONE = 'Asia/Kolkata';

export function toUtcDay(dateInput: string | Date): Date {
  if (typeof dateInput === 'string') {
    const day = dateInput.slice(0, 10);
    return new Date(`${day}T00:00:00.000Z`);
  }
  return new Date(
    Date.UTC(
      dateInput.getUTCFullYear(),
      dateInput.getUTCMonth(),
      dateInput.getUTCDate(),
    ),
  );
}

export function todayUtc(now = new Date()): Date {
  const today = calendarDateInTimeZone(now, TIMEZONE);
  return new Date(`${today}T00:00:00.000Z`);
}

export function addFrequency(date: Date, frequency: RecurringFrequency): Date {
  const next = toUtcDay(date);

  if (frequency === 'DAILY') {
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }
  if (frequency === 'WEEKLY') {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }
  if (frequency === 'YEARLY') {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
    return next;
  }

  const day = next.getUTCDate();
  next.setUTCMonth(next.getUTCMonth() + 1);
  if (next.getUTCDate() !== day) {
    next.setUTCDate(0);
  }
  return next;
}
