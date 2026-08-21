import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { calculatePaginationMeta, getPaginationParams } from 'src/common/common.exports';
import { PrismaService } from 'src/common/database/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { CreateTransactionDto, TransactionQueryDto, UpdateTransactionDto } from './dto/transaction.payload.dto';
import {
  getAccountCurrentBalance,
  pinAccountCurrentBalance,
  shouldPreserveCurrentBalance,
} from 'src/common/helpers/account-ledger';


// ─── Selects ──────────────────────────────────────────────────────────────────

const TRANSACTION_SELECT = {
  id: true,
  userId: true,
  title: true,
  type: true,
  amount: true,
  transactionDate: true,
  paymentMethod: true,
  notes: true,
  location: true,
  createdAt: true,
  updatedAt: true,
  account: {
    select: { id: true, name: true, type: true },
  },
  category: {
    select: { id: true, name: true, icon: true, color: true },
  },
} satisfies Prisma.TransactionSelect;

// ─── Types ────────────────────────────────────────────────────────────────────

type RawTransaction = Prisma.TransactionGetPayload<{
  select: typeof TRANSACTION_SELECT;
}>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTransaction(raw: RawTransaction) {
  const { ...rest } = raw;
  return {
    ...rest,
    amount: Number(rest.amount),
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) { }

  // ── Create ──────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateTransactionDto) {
    await this.assertAccountOwnership(userId, dto.accountId)

    if (dto.categoryId) {
      await this.assertCategoryOwnership(userId, dto.categoryId);
    }

    const transactionDate = new Date(dto.transactionDate);
    const preserve = shouldPreserveCurrentBalance(
      transactionDate,
      dto.preserveCurrentBalance,
    );
    const snapshot = preserve
      ? await getAccountCurrentBalance(this.prisma, dto.accountId)
      : null;

    const raw = await this.prisma.transaction.create({
      data: {
        userId,
        accountId: dto.accountId,
        categoryId: dto.categoryId ?? null,
        type: dto.type,
        amount: dto.amount,
        title: dto.title,
        notes: dto.notes ?? null,
        transactionDate,
        paymentMethod: dto.paymentMethod ?? null,
        location: dto.location ?? null,
      },
      select: TRANSACTION_SELECT,
    });

    if (snapshot != null) {
      await pinAccountCurrentBalance(this.prisma, dto.accountId, snapshot);
    }

    return formatTransaction(raw);
  }

  // ── List ────────────────────────────────────────────────────────────────────

  async findAll(userId: string, query: TransactionQueryDto) {
    const { page, limit, skip } = getPaginationParams(query);
    const {
      accountId,
      categoryId,
      type,
      paymentMethod,
      startDate,
      endDate,
      search,
      minAmount,
      maxAmount,
      orderBy = 'transactionDate',
      order = 'desc',
    } = query;

    // Validate date range if both provided
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      throw new BadRequestException('transactions.errors.invalidDateRange');
    }

    // Validate amount range if both provided
    if (minAmount !== undefined && maxAmount !== undefined && minAmount > maxAmount) {
      throw new BadRequestException('transactions.errors.invalidAmountRange');
    }

    // If filtering by account, verify ownership
    if (accountId) {
      await this.assertAccountOwnership(userId, accountId);
    }

    // If filtering by category, verify ownership
    if (categoryId) {
      await this.assertCategoryOwnership(userId, categoryId);
    }

    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(accountId && { accountId }),
      ...(categoryId && { categoryId }),
      ...(type && { type }),
      ...(paymentMethod && { paymentMethod }),
      ...(search && { title: { contains: search, mode: 'insensitive' } }),
      ...(startDate || endDate
        ? {
          transactionDate: {
            ...(startDate && { gte: new Date(startDate) }),
            ...(endDate && { lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) }),
          },
        }
        : {}),
      ...(minAmount !== undefined || maxAmount !== undefined
        ? {
          amount: {
            ...(minAmount !== undefined && { gte: minAmount }),
            ...(maxAmount !== undefined && { lte: maxAmount }),
          },
        }
        : {}),
    };

    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        select: TRANSACTION_SELECT,
        orderBy: { [orderBy]: order },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: transactions.map(formatTransaction),
      meta: calculatePaginationMeta(total, page, limit),
    };
  }

  // ── Find one ────────────────────────────────────────────────────────────────

  async findOne(userId: string, id: string) {
    const raw = await this.prisma.transaction.findUnique({
      where: { id },
      select: TRANSACTION_SELECT,
    });

    if (!raw) throw new NotFoundException('transactions.errors.notFound');

    if (raw.userId !== userId) {
      throw new ForbiddenException('transactions.errors.forbidden');
    }

    return formatTransaction(raw);
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    await this.assertOwnership(userId, id);

    if (dto.accountId) {
      await this.assertAccountOwnership(userId, dto.accountId);
    }

    if (dto.categoryId) {
      await this.assertCategoryOwnership(userId, dto.categoryId);
    }

    const existing = await this.prisma.transaction.findUnique({
      where: { id },
      select: { accountId: true, transactionDate: true },
    });
    if (!existing) throw new NotFoundException('transactions.errors.notFound');

    const nextDate = dto.transactionDate
      ? new Date(dto.transactionDate)
      : existing.transactionDate;
    const affectedIds = new Set<string>([existing.accountId]);
    if (dto.accountId) affectedIds.add(dto.accountId);

    const preserve =
      dto.preserveCurrentBalance ??
      (shouldPreserveCurrentBalance(existing.transactionDate) ||
        shouldPreserveCurrentBalance(nextDate));

    const snapshots = preserve
      ? await this.snapshotCurrents([...affectedIds])
      : null;

    const { preserveCurrentBalance: _preserve, ...rest } = dto;

    const raw = await this.prisma.transaction.update({
      where: { id },
      data: {
        ...rest,
        ...(rest.transactionDate && {
          transactionDate: new Date(rest.transactionDate),
        }),
      },
      select: TRANSACTION_SELECT,
    });

    if (snapshots) {
      await this.restoreCurrents(snapshots);
    }

    return formatTransaction(raw);
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  async remove(userId: string, id: string) {
    await this.assertOwnership(userId, id);

    const existing = await this.prisma.transaction.findUnique({
      where: { id },
      select: { accountId: true, transactionDate: true },
    });
    if (!existing) throw new NotFoundException('transactions.errors.notFound');

    const preserveToday = shouldPreserveCurrentBalance(existing.transactionDate)
      ? await getAccountCurrentBalance(this.prisma, existing.accountId)
      : null;

    const raw = await this.prisma.transaction.delete({
      where: { id },
      select: TRANSACTION_SELECT,
    });

    if (preserveToday != null) {
      await pinAccountCurrentBalance(
        this.prisma,
        existing.accountId,
        preserveToday,
      );
    }

    return formatTransaction(raw);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async snapshotCurrents(accountIds: string[]) {
    const entries = await Promise.all(
      accountIds.map(async (accountId) => {
        const current = await getAccountCurrentBalance(this.prisma, accountId);
        return [accountId, current] as const;
      }),
    );
    return new Map(entries.filter(([, current]) => current != null) as [string, number][]);
  }

  private async restoreCurrents(snapshots: Map<string, number>) {
    for (const [accountId, current] of snapshots) {
      await pinAccountCurrentBalance(this.prisma, accountId, current);
    }
  }

  private async assertOwnership(userId: string, id: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!tx) throw new NotFoundException('transactions.errors.notFound');

    if (tx.userId !== userId) {
      throw new ForbiddenException('transactions.errors.forbidden');
    }
  }

  private async assertAccountOwnership(userId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, userId: true, isArchived: true },
    });

    if (!account) {
      throw new NotFoundException('transactions.errors.accountNotFound');
    }

    if (account.userId !== userId) {
      throw new ForbiddenException('transactions.errors.accountForbidden');
    }

    if (account.isArchived) {
      throw new UnprocessableEntityException(
        'transactions.errors.accountArchived',
      );
    }
  }

  private async assertCategoryOwnership(userId: string, categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, userId: true, isArchived: true },
    });

    if (!category) {
      throw new NotFoundException('transactions.errors.categoryNotFound');
    }

    if (category.userId !== userId) {
      throw new ForbiddenException('transactions.errors.categoryForbidden');
    }

    if (category.isArchived) {
      throw new UnprocessableEntityException(
        'transactions.errors.categoryArchived',
      );
    }
  }
}