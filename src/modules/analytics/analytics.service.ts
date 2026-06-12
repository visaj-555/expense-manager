import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/common/database/prisma.service';

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
}
