import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/database/prisma.service';
import { DashboardResponseDto } from './dto/dashboard.response.dto';
import { AutomationsService } from '../automations/automations.service';
import { computeFixedDeposit } from 'src/common/helpers/fixed-deposit';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly automationsService: AutomationsService,
  ) {}

  async getDashboard(userId: string): Promise<DashboardResponseDto> {
    await this.automationsService.processDue(userId);

    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfCurrentMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
      999,
    );

    // Top categories: prefer current month; fall back to all-time so charts
    // stay useful when this month has little/no spend yet.
    const [
      accounts,
      currentMonthIncomeAgg,
      currentMonthExpenseAgg,
      lastMonthExpenseAgg,
      savingsTransfersAgg,
      sipInvestmentsAgg,
      topCategoriesMonthAgg,
      topCategoriesAllTimeAgg,
      recentTransactionsRaw,
      goalsRaw,
      budgetsRaw,
    ] = await Promise.all([
      this.prisma.account.findMany({
        where: { userId, isArchived: false },
        include: {
          transactions: {
            where: { type: { in: ['INCOME', 'EXPENSE'] } },
            select: { type: true, amount: true },
          },
          transfersFrom: { select: { amount: true } },
          transfersTo: { select: { amount: true } },
        },
      }),

      this.prisma.transaction.aggregate({
        where: {
          userId,
          type: 'INCOME',
          transactionDate: { gte: startOfCurrentMonth, lte: endOfCurrentMonth },
        },
        _sum: { amount: true },
      }),

      this.prisma.transaction.aggregate({
        where: {
          userId,
          type: 'EXPENSE',
          transactionDate: { gte: startOfCurrentMonth, lte: endOfCurrentMonth },
        },
        _sum: { amount: true },
      }),

      this.prisma.transaction.aggregate({
        where: {
          userId,
          type: 'EXPENSE',
          transactionDate: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
        _sum: { amount: true },
      }),

      this.prisma.transfer.aggregate({
        where: {
          userId,
          transferDate: { gte: startOfCurrentMonth, lte: endOfCurrentMonth },
          toAccount: { type: 'SAVINGS' },
        },
        _sum: { amount: true },
      }),

      this.prisma.transaction.aggregate({
        where: {
          userId,
          category: { name: { equals: 'SIP', mode: 'insensitive' } },
        },
        _sum: { amount: true },
      }),

      this.prisma.transaction.groupBy({
        by: ['categoryId'],
        where: {
          userId,
          type: 'EXPENSE',
          categoryId: { not: null },
          transactionDate: {
            gte: startOfCurrentMonth,
            lte: endOfCurrentMonth,
          },
        },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 5,
      }),

      this.prisma.transaction.groupBy({
        by: ['categoryId'],
        where: {
          userId,
          type: 'EXPENSE',
          categoryId: { not: null },
        },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 5,
      }),

      this.prisma.transaction.findMany({
        where: { userId },
        orderBy: { transactionDate: 'desc' },
        take: 10,
        include: { category: { select: { name: true } } },
      }),

      this.prisma.goal.findMany({
        where: { userId },
      }),

      this.prisma.budget.findMany({
        where: { userId },
        include: { category: { select: { name: true, id: true } } },
      }),
    ]);

    const topCategoriesAgg =
      topCategoriesMonthAgg.length > 0
        ? topCategoriesMonthAgg
        : topCategoriesAllTimeAgg;

    let currentBalance = 0;
    let currentWalletBalance = 0;
    let currentFdBalance = 0;
    const maturedFdNames: string[] = [];

    const accountDistribution = accounts.map((acc) => {
      const txDelta = acc.transactions.reduce((sum, tx) => {
        const amt = Number(tx.amount);
        return tx.type === 'INCOME' ? sum + amt : sum - amt;
      }, 0);
      const transfersOut = acc.transfersFrom.reduce(
        (sum, tr) => sum + Number(tr.amount),
        0,
      );
      const transfersIn = acc.transfersTo.reduce(
        (sum, tr) => sum + Number(tr.amount),
        0,
      );
      const ledgerBalance =
        Number(acc.openingBalance) + txDelta - transfersOut + transfersIn;

      const fd =
        acc.type === 'FIXED_DEPOSIT' &&
        acc.fdInterestRate != null &&
        acc.fdStartDate &&
        acc.fdTenureMonths != null
          ? computeFixedDeposit({
              principal: Number(acc.openingBalance),
              interestRate: Number(acc.fdInterestRate),
              startDate: acc.fdStartDate,
              tenureMonths: acc.fdTenureMonths,
              compounding: acc.fdCompounding ?? 'QUARTERLY',
            })
          : null;

      const balance = fd ? fd.currentValue : ledgerBalance;

      if (acc.type === 'BANK') {
        currentBalance += balance;
      } else if (acc.type === 'WALLET') {
        currentWalletBalance += balance;
      } else if (acc.type === 'FIXED_DEPOSIT') {
        currentFdBalance += balance;
        if (fd?.isMatured) {
          maturedFdNames.push(acc.name);
        }
      }

      return { account: acc.name, balance };
    });

    const monthlyIncome = Number(currentMonthIncomeAgg._sum.amount || 0);
    const monthlyExpense = Number(currentMonthExpenseAgg._sum.amount || 0);
    const lastMonthExpense = Number(lastMonthExpenseAgg._sum.amount || 0);
    const monthlySavings = Number(savingsTransfersAgg._sum.amount || 0);
    const monthlyInvestments = Number(sipInvestmentsAgg._sum.amount || 0);
    const netCashFlow = monthlyIncome - monthlyExpense;
    const savingsRate =
      monthlyIncome > 0 ? (netCashFlow / monthlyIncome) * 100 : 0;

    const overview = {
      currentBalance,
      currentWalletBalance,
      currentFdBalance,
      monthlyIncome,
      monthlyExpense,
      monthlySavings,
      monthlyInvestments,
      netCashFlow,
      savingsRate: Math.round(savingsRate * 100) / 100,
    };

    const categoryIds = topCategoriesAgg
      .map((tc) => tc.categoryId)
      .filter((id): id is string => id !== null);

    const categoriesRaw = categoryIds.length
      ? await this.prisma.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        })
      : [];

    const categoryMap = new Map(categoriesRaw.map((c) => [c.id, c.name]));

    const topCategories = topCategoriesAgg.map((tc) => ({
      category: tc.categoryId
        ? categoryMap.get(tc.categoryId) || 'Uncategorized'
        : 'Uncategorized',
      amount: Number(tc._sum.amount || 0),
    }));

    const recentTransactions = recentTransactionsRaw.map((tx) => ({
      title: tx.title,
      amount: Number(tx.amount),
      type: tx.type,
      category: tx.category?.name || 'Uncategorized',
      transactionDate: tx.transactionDate,
    }));

    const goalsProgress = goalsRaw.map((goal) => {
      const target = Number(goal.targetAmount);
      const current = Number(goal.currentAmount);
      const progress = target > 0 ? (current / target) * 100 : 0;
      return {
        goalName: goal.name,
        targetAmount: target,
        currentAmount: current,
        progress: Math.round(progress * 100) / 100,
      };
    });

    const expensesByCategoryAgg = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: 'EXPENSE',
        transactionDate: { gte: startOfCurrentMonth, lte: endOfCurrentMonth },
      },
      _sum: { amount: true },
    });
    const expenseByCatMap = new Map(
      expensesByCategoryAgg.map((e) => [
        e.categoryId,
        Number(e._sum.amount || 0),
      ]),
    );

    const budgetSummary = budgetsRaw.map((b) => {
      const budgetAmount = Number(b.amount);
      const spent = expenseByCatMap.get(b.categoryId) || 0;
      const percentageUsed =
        budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
      return {
        category: b.category.name,
        budget: budgetAmount,
        spent,
        remaining: Math.max(0, budgetAmount - spent),
        percentageUsed: Math.round(percentageUsed * 100) / 100,
      };
    });

    const trendPromises = Array.from({ length: 6 }).map((_, i) => {
      const offset = 5 - i;
      const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const end = new Date(
        now.getFullYear(),
        now.getMonth() - offset + 1,
        0,
        23,
        59,
        59,
        999,
      );

      return this.prisma.transaction
        .aggregate({
          where: {
            userId,
            type: 'EXPENSE',
            transactionDate: { gte: start, lte: end },
          },
          _sum: { amount: true },
        })
        .then((res) => ({
          month: start.toLocaleString('en-US', { month: 'short' }),
          expense: Number(res._sum.amount || 0),
        }));
    });
    const spendingTrend = await Promise.all(trendPromises);

    const insights: string[] = [];

    const expenseDiff = monthlyExpense - lastMonthExpense;
    if (lastMonthExpense > 0) {
      if (expenseDiff > 0) {
        insights.push(`You spent ₹${expenseDiff} more than last month.`);
      } else if (expenseDiff < 0) {
        insights.push(
          `You spent ₹${Math.abs(expenseDiff)} less than last month. Great job!`,
        );
      }
    }

    const nearingGoal = goalsProgress.find(
      (g) => g.progress >= 75 && g.progress < 100,
    );
    if (nearingGoal) {
      insights.push(
        `Almost there! ${nearingGoal.goalName} reached ${nearingGoal.progress}% of target.`,
      );
    }

    const completedGoal = goalsProgress.find((g) => g.progress >= 100);
    if (completedGoal) {
      insights.push(
        `Congratulations! ${completedGoal.goalName} target has been reached.`,
      );
    }

    const overrunBudget = budgetSummary.find((b) => b.percentageUsed >= 90);
    if (overrunBudget) {
      insights.push(
        `Warning: You have used ${overrunBudget.percentageUsed}% of your ${overrunBudget.category} budget.`,
      );
    }

    if (savingsRate > 20) {
      insights.push(
        `Excellent savings rate this month at ${Math.round(savingsRate)}%.`,
      );
    }

    if (maturedFdNames.length > 0) {
      insights.push(
        `${maturedFdNames.join(', ')} matured. Move the amount to bank or cash when you receive it.`,
      );
    }

    return {
      overview,
      accountDistribution,
      monthlySummary: { topCategories },
      recentTransactions,
      goalsProgress,
      budgetSummary,
      spendingTrend,
      insights,
    };
  }
}
