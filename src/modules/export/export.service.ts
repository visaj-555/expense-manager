import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/common/database/prisma.service';
import type { ExportQueryDto, ExportRange } from './dto/export.query.dto';

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return null;
  return Number(value);
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function dateRange(range: ExportRange, year?: number, month?: number) {
  if (range === 'all') {
    return { from: null as Date | null, to: null as Date | null };
  }

  if (!year) {
    throw new BadRequestException('Year is required for year and month exports');
  }

  if (range === 'year') {
    return {
      from: new Date(year, 0, 1),
      to: new Date(year + 1, 0, 1),
    };
  }

  if (!month) {
    throw new BadRequestException('Month is required for month exports');
  }

  return {
    from: new Date(year, month - 1, 1),
    to: new Date(year, month, 1),
  };
}

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  async build(userId: string, query: ExportQueryDto) {
    const range: ExportRange = query.range ?? 'all';
    const { from, to } = dateRange(range, query.year, query.month);
    const datedWhere =
      from && to
        ? { gte: from, lt: to }
        : undefined;

    const [user, accounts, categories, transactions, transfers, goals, automations] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            name: true,
            currencyCode: true,
            timezone: true,
            createdAt: true,
            auth: { select: { email: true } },
          },
        }),
        this.prisma.account.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.category.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.transaction.findMany({
          where: {
            userId,
            ...(datedWhere ? { transactionDate: datedWhere } : {}),
          },
          orderBy: { transactionDate: 'asc' },
          include: {
            account: { select: { id: true, name: true, type: true } },
            category: { select: { id: true, name: true, type: true } },
          },
        }),
        this.prisma.transfer.findMany({
          where: {
            userId,
            ...(datedWhere ? { transferDate: datedWhere } : {}),
          },
          orderBy: { transferDate: 'asc' },
          include: {
            fromAccount: { select: { id: true, name: true } },
            toAccount: { select: { id: true, name: true } },
          },
        }),
        this.prisma.goal.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.recurringTransaction.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
          include: {
            account: { select: { id: true, name: true } },
            category: { select: { id: true, name: true } },
          },
        }),
      ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      period: {
        range,
        year: range === 'all' ? undefined : query.year,
        month: range === 'month' ? query.month : undefined,
        from: toIso(from),
        to: toIso(to),
      },
      user: {
        name: user.name,
        email: user.auth.email,
        currencyCode: user.currencyCode,
        timezone: user.timezone,
        createdAt: toIso(user.createdAt),
      },
      accounts: accounts.map((account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        openingBalance: toNumber(account.openingBalance),
        isArchived: account.isArchived,
        fdInterestRate: toNumber(account.fdInterestRate),
        fdStartDate: toIso(account.fdStartDate),
        fdTenureMonths: account.fdTenureMonths,
        fdCompounding: account.fdCompounding,
        createdAt: toIso(account.createdAt),
      })),
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        type: category.type,
        isArchived: category.isArchived,
        createdAt: toIso(category.createdAt),
      })),
      transactions: transactions.map((transaction) => ({
        id: transaction.id,
        title: transaction.title,
        type: transaction.type,
        amount: toNumber(transaction.amount),
        transactionDate: toIso(transaction.transactionDate),
        paymentMethod: transaction.paymentMethod,
        notes: transaction.notes,
        location: transaction.location,
        accountId: transaction.accountId,
        accountName: transaction.account.name,
        categoryId: transaction.categoryId,
        categoryName: transaction.category?.name ?? null,
        createdAt: toIso(transaction.createdAt),
      })),
      transfers: transfers.map((transfer) => ({
        id: transfer.id,
        amount: toNumber(transfer.amount),
        note: transfer.note,
        transferDate: toIso(transfer.transferDate),
        fromAccountId: transfer.fromAccountId,
        fromAccountName: transfer.fromAccount.name,
        toAccountId: transfer.toAccountId,
        toAccountName: transfer.toAccount.name,
        createdAt: toIso(transfer.createdAt),
      })),
      goals: goals.map((goal) => ({
        id: goal.id,
        name: goal.name,
        targetAmount: toNumber(goal.targetAmount),
        currentAmount: toNumber(goal.currentAmount),
        targetDate: toIso(goal.targetDate),
        isCompleted: goal.isCompleted,
        createdAt: toIso(goal.createdAt),
      })),
      automations: automations.map((automation) => ({
        id: automation.id,
        title: automation.title,
        type: automation.type,
        amount: toNumber(automation.amount),
        paymentMethod: automation.paymentMethod,
        frequency: automation.frequency,
        notes: automation.notes,
        startDate: toIso(automation.startDate),
        endDate: toIso(automation.endDate),
        nextRunDate: toIso(automation.nextRunDate),
        lastProcessed: toIso(automation.lastProcessed),
        isActive: automation.isActive,
        accountId: automation.accountId,
        accountName: automation.account.name,
        categoryId: automation.categoryId,
        categoryName: automation.category?.name ?? null,
        createdAt: toIso(automation.createdAt),
      })),
    };

    return {
      ...payload,
      summary: {
        accounts: payload.accounts.length,
        categories: payload.categories.length,
        transactions: payload.transactions.length,
        transfers: payload.transfers.length,
        goals: payload.goals.length,
        automations: payload.automations.length,
      },
    };
  }
}
