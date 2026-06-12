import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/database/prisma.service';
import { DashboardResponseDto } from './dto/dashboard.response.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: string): Promise<DashboardResponseDto> {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [
      accounts,
      currentMonthIncomeAgg,
      currentMonthExpenseAgg,
      lastMonthExpenseAgg,
      savingsTransfersAgg,
      investmentsTransfersAgg,
      topCategoriesAgg,
      recentTransactionsRaw,
      goalsRaw,
      budgetsRaw,
    ] = await Promise.all([
      // 1. All accounts for Distribution & Total Balance
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

      // 2. Monthly Income
      this.prisma.transaction.aggregate({
        where: { userId, type: 'INCOME', transactionDate: { gte: startOfCurrentMonth, lte: endOfCurrentMonth } },
        _sum: { amount: true },
      }),

      // 3. Monthly Expense
      this.prisma.transaction.aggregate({
        where: { userId, type: 'EXPENSE', transactionDate: { gte: startOfCurrentMonth, lte: endOfCurrentMonth } },
        _sum: { amount: true },
      }),

      // 4. Last Month Expense (for insights)
      this.prisma.transaction.aggregate({
        where: { userId, type: 'EXPENSE', transactionDate: { gte: startOfLastMonth, lte: endOfLastMonth } },
        _sum: { amount: true },
      }),

      // 5. Savings (Transfers to SAVINGS accounts)
      this.prisma.transfer.aggregate({
        where: { userId, transferDate: { gte: startOfCurrentMonth, lte: endOfCurrentMonth }, toAccount: { type: 'SAVINGS' } },
        _sum: { amount: true },
      }),

      // 6. Investments (Transfers to INVESTMENT accounts)
      this.prisma.transfer.aggregate({
        where: { userId, transferDate: { gte: startOfCurrentMonth, lte: endOfCurrentMonth }, toAccount: { type: 'INVESTMENT' } },
        _sum: { amount: true },
      }),

      // 7. Top Categories (Expense grouped by category)
      this.prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { userId, type: 'EXPENSE', transactionDate: { gte: startOfCurrentMonth, lte: endOfCurrentMonth } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 5,
      }),

      // 8. Recent Transactions
      this.prisma.transaction.findMany({
        where: { userId },
        orderBy: { transactionDate: 'desc' },
        take: 10,
        include: { category: { select: { name: true } } },
      }),

      // 9. Goals
      this.prisma.goal.findMany({
        where: { userId },
      }),

      // 10. Budgets
      this.prisma.budget.findMany({
        where: { userId },
        include: { category: { select: { name: true, id: true } } },
      }),
    ]);

    // Calculate Balances
    let totalBalance = 0;
    const accountDistribution = accounts.map((acc) => {
      const txDelta = acc.transactions.reduce((sum, tx) => {
        const amt = Number(tx.amount);
        return tx.type === 'INCOME' ? sum + amt : sum - amt;
      }, 0);
      const transfersOut = acc.transfersFrom.reduce((sum, tr) => sum + Number(tr.amount), 0);
      const transfersIn = acc.transfersTo.reduce((sum, tr) => sum + Number(tr.amount), 0);
      const balance = Number(acc.openingBalance) + txDelta - transfersOut + transfersIn;
      
      totalBalance += balance;
      return { account: acc.name, balance };
    });

    // Compute Overview
    const monthlyIncome = Number(currentMonthIncomeAgg._sum.amount || 0);
    const monthlyExpense = Number(currentMonthExpenseAgg._sum.amount || 0);
    const lastMonthExpense = Number(lastMonthExpenseAgg._sum.amount || 0);
    const monthlySavings = Number(savingsTransfersAgg._sum.amount || 0);
    const monthlyInvestments = Number(investmentsTransfersAgg._sum.amount || 0);
    const netCashFlow = monthlyIncome - monthlyExpense;
    const savingsRate = monthlyIncome > 0 ? (netCashFlow / monthlyIncome) * 100 : 0;

    const overview = {
      totalBalance,
      monthlyIncome,
      monthlyExpense,
      monthlySavings,
      monthlyInvestments,
      netCashFlow,
      savingsRate: Math.round(savingsRate * 100) / 100,
    };

    // Monthly Summary (Top Categories mapping)
    // We need category names for the IDs returned by groupBy
    const categoryIds = topCategoriesAgg.map(tc => tc.categoryId).filter(id => id !== null) as string[];
    const categoriesRaw = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });
    const categoryMap = new Map(categoriesRaw.map(c => [c.id, c.name]));

    const topCategories = topCategoriesAgg.map(tc => ({
      category: tc.categoryId ? categoryMap.get(tc.categoryId) || 'Uncategorized' : 'Uncategorized',
      amount: Number(tc._sum.amount || 0),
    }));

    // Recent Transactions
    const recentTransactions = recentTransactionsRaw.map(tx => ({
      title: tx.title,
      amount: Number(tx.amount),
      type: tx.type,
      category: tx.category?.name || 'Uncategorized',
      transactionDate: tx.transactionDate,
    }));

    // Goals Progress
    const goalsProgress = goalsRaw.map(goal => {
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

    // Budget Summary
    // For each budget, we need to find how much was spent this month.
    // We could do it with a query per budget, or fetch all expenses and sum them up.
    // Fetch all current month expenses by category
    const expensesByCategoryAgg = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId, type: 'EXPENSE', transactionDate: { gte: startOfCurrentMonth, lte: endOfCurrentMonth } },
      _sum: { amount: true },
    });
    const expenseByCatMap = new Map(expensesByCategoryAgg.map(e => [e.categoryId, Number(e._sum.amount || 0)]));

    const budgetSummary = budgetsRaw.map(b => {
      const budgetAmount = Number(b.amount);
      const spent = expenseByCatMap.get(b.categoryId) || 0;
      const percentageUsed = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
      return {
        category: b.category.name,
        budget: budgetAmount,
        spent,
        remaining: Math.max(0, budgetAmount - spent),
        percentageUsed: Math.round(percentageUsed * 100) / 100,
      };
    });

    // Spending Trend (Last 6 Months)
    const trendPromises = Array.from({ length: 6 }).map((_, i) => {
      // i = 0 represents 5 months ago, i = 5 represents current month
      const offset = 5 - i;
      const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59, 999);
      
      return this.prisma.transaction.aggregate({
        where: { userId, type: 'EXPENSE', transactionDate: { gte: start, lte: end } },
        _sum: { amount: true }
      }).then(res => ({
        month: start.toLocaleString('en-US', { month: 'short' }),
        expense: Number(res._sum.amount || 0)
      }));
    });
    const spendingTrend = await Promise.all(trendPromises);

    // Insights Generation
    const insights: string[] = [];
    
    // Insight 1: MoM Expense comparison
    const expenseDiff = monthlyExpense - lastMonthExpense;
    if (lastMonthExpense > 0) {
      if (expenseDiff > 0) {
        insights.push(`You spent ₹${expenseDiff} more than last month.`);
      } else if (expenseDiff < 0) {
        insights.push(`You spent ₹${Math.abs(expenseDiff)} less than last month. Great job!`);
      }
    }

    // Insight 2: Goal Progress
    const nearingGoal = goalsProgress.find(g => g.progress >= 75 && g.progress < 100);
    if (nearingGoal) {
      insights.push(`Almost there! ${nearingGoal.goalName} reached ${nearingGoal.progress}% of target.`);
    }

    const completedGoal = goalsProgress.find(g => g.progress >= 100);
    if (completedGoal) {
       insights.push(`Congratulations! ${completedGoal.goalName} target has been reached.`);
    }

    // Insight 3: Budget Overrun
    const overrunBudget = budgetSummary.find(b => b.percentageUsed >= 90);
    if (overrunBudget) {
      insights.push(`Warning: You have used ${overrunBudget.percentageUsed}% of your ${overrunBudget.category} budget.`);
    }

    // Insight 4: Savings Rate
    if (savingsRate > 20) {
      insights.push(`Excellent savings rate this month at ${Math.round(savingsRate)}%.`);
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
