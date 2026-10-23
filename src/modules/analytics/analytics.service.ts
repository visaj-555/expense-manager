import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/common/database/prisma.service';
import { AnalyticsPeriod } from './dto/payloads/analytics.query.dto';
import { calendarDateInTimeZone } from 'src/common/helpers/account-ledger';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

function changePct(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMonthlyCategoryAnalysis(userId: string, monthParam?: number, yearParam?: number) {
    const now = new Date();
    const year = yearParam || now.getFullYear();
    const month = monthParam ? monthParam - 1 : now.getMonth(); // 0-indexed month

    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const expensesAgg = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: 'EXPENSE',
        transactionDate: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });

    const totalExpense = expensesAgg.reduce((sum, item) => sum + Number(item._sum.amount || 0), 0);

    const categoryIds = expensesAgg.map((e) => e.categoryId).filter((id) => id !== null) as string[];
    const categoriesRaw = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });
    const categoryMap = new Map(categoriesRaw.map((c) => [c.id, c.name]));

    const categories = expensesAgg.map((item) => {
      const amount = Number(item._sum.amount || 0);
      const percentage = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
      return {
        category: item.categoryId ? categoryMap.get(item.categoryId) || 'Uncategorized' : 'Uncategorized',
        amount,
        percentage: Math.round(percentage * 100) / 100,
      };
    });

    categories.sort((a, b) => b.amount - a.amount);

    return { totalExpense, categories };
  }

  async getYearlyCategoryAnalysis(userId: string, yearParam?: number) {
    const now = new Date();
    const year = yearParam || now.getFullYear();

    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);

    const expensesAgg = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: 'EXPENSE',
        transactionDate: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });

    const totalExpense = expensesAgg.reduce((sum, item) => sum + Number(item._sum.amount || 0), 0);

    const categoryIds = expensesAgg.map((e) => e.categoryId).filter((id) => id !== null) as string[];
    const categoriesRaw = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });
    const categoryMap = new Map(categoriesRaw.map((c) => [c.id, c.name]));

    const categories = expensesAgg.map((item) => {
      const amount = Number(item._sum.amount || 0);
      const percentage = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
      return {
        category: item.categoryId ? categoryMap.get(item.categoryId) || 'Uncategorized' : 'Uncategorized',
        amount,
        percentage: Math.round(percentage * 100) / 100,
      };
    });

    categories.sort((a, b) => b.amount - a.amount);

    return { totalExpense, categories };
  }

  async getCategoryTrend(userId: string, categoryId: string) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundException('Category not found');
    if (category.userId !== userId) throw new ForbiddenException('Forbidden');

    const now = new Date();
    
    // Trailing 6 months
    const trendPromises = Array.from({ length: 6 }).map((_, i) => {
      const offset = 5 - i;
      const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59, 999);
      
      return this.prisma.transaction.aggregate({
        where: { userId, categoryId, type: 'EXPENSE', transactionDate: { gte: start, lte: end } },
        _sum: { amount: true }
      }).then(res => ({
        month: start.toLocaleString('en-US', { month: 'short' }),
        amount: Number(res._sum.amount || 0)
      }));
    });
    
    return Promise.all(trendPromises);
  }

  async getCashflowTrend(userId: string) {
    const now = new Date();
    
    // Trailing 6 months
    const trendPromises = Array.from({ length: 6 }).map((_, i) => {
      const offset = 5 - i;
      const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59, 999);
      
      return Promise.all([
        this.prisma.transaction.aggregate({
          where: { userId, type: 'INCOME', transactionDate: { gte: start, lte: end } },
          _sum: { amount: true }
        }),
        this.prisma.transaction.aggregate({
          where: { userId, type: 'EXPENSE', transactionDate: { gte: start, lte: end } },
          _sum: { amount: true }
        })
      ]).then(([incomeAgg, expenseAgg]) => ({
        month: start.toLocaleString('en-US', { month: 'short' }),
        income: Number(incomeAgg._sum.amount || 0),
        expense: Number(expenseAgg._sum.amount || 0),
      }));
    });
    
    return Promise.all(trendPromises);
  }

  async getTopExpenses(userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: { userId, type: 'EXPENSE' },
      orderBy: { amount: 'desc' },
      take: 10,
    });

    return transactions.map(tx => ({
      title: tx.title,
      amount: Number(tx.amount),
    }));
  }

  async getDeepInsights(
    userId: string,
    query: {
      period?: AnalyticsPeriod;
      month?: number;
      year?: number;
      categoryId?: string;
    },
  ) {
    const now = new Date();
    const period = query.period ?? AnalyticsPeriod.MONTHLY;
    const year = query.year ?? now.getFullYear();
    const monthIndex = (query.month ?? now.getMonth() + 1) - 1;

    if (query.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: query.categoryId },
        select: { id: true, userId: true, name: true },
      });
      if (!category) throw new NotFoundException('analytics.errors.categoryNotFound');
      if (category.userId !== userId) {
        throw new ForbiddenException('analytics.errors.forbidden');
      }
    }

    const isMonthly = period === AnalyticsPeriod.MONTHLY;
    const periodStart = isMonthly
      ? new Date(year, monthIndex, 1)
      : new Date(year, 0, 1);
    const periodEnd = isMonthly
      ? new Date(year, monthIndex + 1, 0, 23, 59, 59, 999)
      : new Date(year, 11, 31, 23, 59, 59, 999);
    const previousStart = isMonthly
      ? new Date(year, monthIndex - 1, 1)
      : new Date(year - 1, 0, 1);
    const previousEnd = isMonthly
      ? new Date(year, monthIndex, 0, 23, 59, 59, 999)
      : new Date(year - 1, 11, 31, 23, 59, 59, 999);
    const trendStart = isMonthly
      ? new Date(year, monthIndex - 11, 1)
      : new Date(year, 0, 1);

    const [transactions, transfers] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          userId,
          type: { in: ['INCOME', 'EXPENSE'] },
          transactionDate: { gte: trendStart, lte: periodEnd },
        },
        select: {
          id: true,
          title: true,
          type: true,
          amount: true,
          transactionDate: true,
          accountId: true,
          categoryId: true,
          account: { select: { id: true, name: true, type: true } },
          category: {
            select: { id: true, name: true, icon: true, color: true },
          },
        },
      }),
      this.prisma.transfer.findMany({
        where: {
          userId,
          transferDate: { gte: periodStart, lte: periodEnd },
        },
        select: { amount: true },
      }),
    ]);

    const inRange = (
      date: Date,
      start: Date,
      end: Date,
    ) => date >= start && date <= end;

    const matchesCategory = (categoryId: string | null) =>
      !query.categoryId || categoryId === query.categoryId;

    const currentTx = transactions.filter((tx) =>
      inRange(tx.transactionDate, periodStart, periodEnd),
    );
    const previousTx = transactions.filter((tx) =>
      inRange(tx.transactionDate, previousStart, previousEnd),
    );

    const sumBy = (
      rows: typeof transactions,
      type: 'INCOME' | 'EXPENSE',
      filterCategory = false,
    ) =>
      rows.reduce((sum, tx) => {
        if (tx.type !== type) return sum;
        if (filterCategory && type === 'EXPENSE' && !matchesCategory(tx.categoryId)) {
          return sum;
        }
        return sum + Number(tx.amount);
      }, 0);

    const income = sumBy(currentTx, 'INCOME');
    const expense = sumBy(currentTx, 'EXPENSE', true);
    const prevIncome = sumBy(previousTx, 'INCOME');
    const prevExpense = sumBy(previousTx, 'EXPENSE', true);
    const net = income - expense;
    const prevNet = prevIncome - prevExpense;
    const savingsRate = income > 0 ? round2((net / income) * 100) : 0;

    const expenseRows = currentTx.filter(
      (tx) => tx.type === 'EXPENSE' && matchesCategory(tx.categoryId),
    );
    const incomeRows = currentTx.filter((tx) => tx.type === 'INCOME');

    const daysInPeriod = isMonthly
      ? periodEnd.getDate()
      : Math.round((periodEnd.getTime() - periodStart.getTime()) / 86_400_000) + 1;
    const isCurrentPeriod = now >= periodStart && now <= periodEnd;
    const elapsedDays = isCurrentPeriod
      ? isMonthly
        ? now.getDate()
        : Math.max(
            1,
            Math.round((now.getTime() - periodStart.getTime()) / 86_400_000) + 1,
          )
      : daysInPeriod;

    const largest = [...expenseRows].sort(
      (a, b) => Number(b.amount) - Number(a.amount),
    )[0];

    const groupCategories = (
      rows: typeof transactions,
    ) => {
      const map = new Map<
        string,
        {
          categoryId: string | null;
          name: string;
          icon: string | null;
          color: string | null;
          amount: number;
          count: number;
        }
      >();
      for (const tx of rows) {
        const key = tx.categoryId ?? 'uncategorized';
        const existing = map.get(key);
        const amount = Number(tx.amount);
        if (existing) {
          existing.amount += amount;
          existing.count += 1;
        } else {
          map.set(key, {
            categoryId: tx.categoryId,
            name: tx.category?.name ?? 'Uncategorized',
            icon: tx.category?.icon ?? null,
            color: tx.category?.color ?? null,
            amount,
            count: 1,
          });
        }
      }
      const total = [...map.values()].reduce((s, c) => s + c.amount, 0);
      return [...map.values()]
        .map((item) => ({
          ...item,
          amount: round2(item.amount),
          avgAmount: round2(item.amount / item.count),
          percentage: total > 0 ? round2((item.amount / total) * 100) : 0,
        }))
        .sort((a, b) => b.amount - a.amount);
    };

    const trend: {
      key: string;
      label: string;
      income: number;
      expense: number;
      net: number;
      savingsRate: number;
    }[] = [];

    if (isMonthly) {
      for (let i = 11; i >= 0; i -= 1) {
        const start = new Date(year, monthIndex - i, 1);
        const end = new Date(year, monthIndex - i + 1, 0, 23, 59, 59, 999);
        const bucket = transactions.filter((tx) =>
          inRange(tx.transactionDate, start, end),
        );
        const inc = sumBy(bucket, 'INCOME');
        const exp = sumBy(bucket, 'EXPENSE', true);
        trend.push({
          key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
          label: `${MONTH_LABELS[start.getMonth()]} ${String(start.getFullYear()).slice(2)}`,
          income: round2(inc),
          expense: round2(exp),
          net: round2(inc - exp),
          savingsRate: inc > 0 ? round2(((inc - exp) / inc) * 100) : 0,
        });
      }
    } else {
      for (let m = 0; m < 12; m += 1) {
        const start = new Date(year, m, 1);
        const end = new Date(year, m + 1, 0, 23, 59, 59, 999);
        const bucket = transactions.filter((tx) =>
          inRange(tx.transactionDate, start, end),
        );
        const inc = sumBy(bucket, 'INCOME');
        const exp = sumBy(bucket, 'EXPENSE', true);
        trend.push({
          key: `${year}-${String(m + 1).padStart(2, '0')}`,
          label: MONTH_LABELS[m],
          income: round2(inc),
          expense: round2(exp),
          net: round2(inc - exp),
          savingsRate: inc > 0 ? round2(((inc - exp) / inc) * 100) : 0,
        });
      }
    }

    const dailyMap = new Map<string, { income: number; expense: number }>();
    if (isMonthly) {
      const days = periodEnd.getDate();
      for (let d = 1; d <= days; d += 1) {
        const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        dailyMap.set(key, { income: 0, expense: 0 });
      }
      for (const tx of currentTx) {
        const key = calendarDateInTimeZone(tx.transactionDate, 'UTC');
        const bucket = dailyMap.get(key);
        if (!bucket) continue;
        if (tx.type === 'INCOME') bucket.income += Number(tx.amount);
        if (tx.type === 'EXPENSE' && matchesCategory(tx.categoryId)) {
          bucket.expense += Number(tx.amount);
        }
      }
    }

    const weekdayTotals = WEEKDAYS.map((weekday) => ({
      weekday,
      amount: 0,
      count: 0,
    }));
    for (const tx of expenseRows) {
      const day = tx.transactionDate.getUTCDay();
      weekdayTotals[day].amount += Number(tx.amount);
      weekdayTotals[day].count += 1;
    }

    const accountMap = new Map<
      string,
      { accountId: string; name: string; type: string; outflow: number; inflow: number }
    >();
    for (const tx of currentTx) {
      if (tx.type === 'EXPENSE' && !matchesCategory(tx.categoryId)) continue;
      const existing = accountMap.get(tx.accountId) ?? {
        accountId: tx.account.id,
        name: tx.account.name,
        type: tx.account.type,
        outflow: 0,
        inflow: 0,
      };
      if (tx.type === 'EXPENSE') existing.outflow += Number(tx.amount);
      else existing.inflow += Number(tx.amount);
      accountMap.set(tx.accountId, existing);
    }

    const transferAmount = transfers.reduce((s, t) => s + Number(t.amount), 0);
    const topCategory = groupCategories(expenseRows)[0];
    const busiestWeekday = [...weekdayTotals].sort((a, b) => b.amount - a.amount)[0];

    const insights: { tone: 'positive' | 'warning' | 'neutral'; text: string }[] = [];
    const periodLabel = isMonthly
      ? `${MONTH_LABELS[monthIndex]} ${year}`
      : String(year);

    if (topCategory && expense > 0) {
      insights.push({
        tone: topCategory.percentage >= 35 ? 'warning' : 'neutral',
        text: `${topCategory.name} is ${topCategory.percentage.toFixed(0)}% of spend in ${periodLabel}.`,
      });
    }
    const expenseDelta = changePct(expense, prevExpense);
    if (prevExpense > 0) {
      insights.push({
        tone: expenseDelta > 8 ? 'warning' : expenseDelta < -8 ? 'positive' : 'neutral',
        text:
          expenseDelta === 0
            ? `Spending is flat versus the previous ${isMonthly ? 'month' : 'year'}.`
            : `Spending is ${Math.abs(expenseDelta)}% ${expenseDelta > 0 ? 'higher' : 'lower'} than the previous ${isMonthly ? 'month' : 'year'}.`,
      });
    }
    if (income > 0) {
      insights.push({
        tone: savingsRate >= 20 ? 'positive' : savingsRate < 0 ? 'warning' : 'neutral',
        text:
          savingsRate < 0
            ? `You spent ${formatInr(Math.abs(net))} more than you earned.`
            : `Savings rate is ${savingsRate.toFixed(0)}% (${formatInr(net)} kept).`,
      });
    }
    if (busiestWeekday && busiestWeekday.amount > 0) {
      insights.push({
        tone: 'neutral',
        text: `${busiestWeekday.weekday} is your heaviest spend day.`,
      });
    }
    if (transferAmount > 0) {
      insights.push({
        tone: 'neutral',
        text: `Moved ${formatInr(transferAmount)} between accounts (${transfers.length} transfer${transfers.length === 1 ? '' : 's'}).`,
      });
    }

    return {
      period: {
        type: period,
        month: isMonthly ? monthIndex + 1 : null,
        year,
        label: periodLabel,
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
      },
      summary: {
        income: round2(income),
        expense: round2(expense),
        net: round2(net),
        savingsRate,
        transactionCount: currentTx.length,
        expenseCount: expenseRows.length,
        incomeCount: incomeRows.length,
        avgDailySpend: round2(expense / Math.max(elapsedDays, 1)),
        avgExpense: expenseRows.length
          ? round2(expense / expenseRows.length)
          : 0,
        incomeChangePct: changePct(income, prevIncome),
        expenseChangePct: expenseDelta,
        netChangePct: changePct(net, prevNet),
        largestExpense: largest
          ? {
              id: largest.id,
              title: largest.title,
              amount: round2(Number(largest.amount)),
              date: largest.transactionDate.toISOString(),
              category: largest.category?.name ?? 'Uncategorized',
            }
          : null,
      },
      previous: {
        income: round2(prevIncome),
        expense: round2(prevExpense),
        net: round2(prevNet),
      },
      categories: groupCategories(expenseRows),
      incomeSources: groupCategories(incomeRows),
      trend,
      daily: [...dailyMap.entries()].map(([date, value]) => ({
        date,
        day: Number(date.slice(-2)),
        income: round2(value.income),
        expense: round2(value.expense),
        net: round2(value.income - value.expense),
      })),
      weekday: weekdayTotals.map((row) => ({
        ...row,
        amount: round2(row.amount),
      })),
      accounts: [...accountMap.values()]
        .map((row) => ({
          ...row,
          outflow: round2(row.outflow),
          inflow: round2(row.inflow),
        }))
        .sort((a, b) => b.outflow - a.outflow),
      topExpenses: [...expenseRows]
        .sort((a, b) => Number(b.amount) - Number(a.amount))
        .slice(0, 8)
        .map((tx) => ({
          id: tx.id,
          title: tx.title,
          amount: round2(Number(tx.amount)),
          date: tx.transactionDate.toISOString(),
          category: tx.category?.name ?? 'Uncategorized',
          account: tx.account.name,
        })),
      transfers: {
        count: transfers.length,
        amount: round2(transferAmount),
      },
      insights,
    };
  }
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
