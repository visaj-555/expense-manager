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

function addMonthsClamped(date: Date, months: number, anchorDay: number): Date {
  const monthIndex = date.getUTCMonth() + months;
  const year = date.getUTCFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(anchorDay, lastDay)));
}

export function addFrequency(
  date: Date,
  frequency: RecurringFrequency,
  anchorDay = toUtcDay(date).getUTCDate(),
): Date {
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
    return addMonthsClamped(next, 12, anchorDay);
  }

  return addMonthsClamped(next, 1, anchorDay);
}

/**
 * Walk from startDate to the current cycle: keep a due date that is already
 * on/before today, but do not jump over it to the next future occurrence.
 */
export function currentDueDate(
  startDate: Date,
  frequency: RecurringFrequency,
  today: Date,
): Date {
  let nextRunDate = toUtcDay(startDate);
  const todayDay = toUtcDay(today);
  const anchorDay = toUtcDay(startDate).getUTCDate();
  let guard = 0;

  while (nextRunDate < todayDay && guard < 120) {
    const following = addFrequency(nextRunDate, frequency, anchorDay);
    if (following > todayDay) break;
    nextRunDate = following;
    guard += 1;
  }

  return nextRunDate;
}
