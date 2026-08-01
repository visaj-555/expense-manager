import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/database/prisma.service';
import {
  CreateAccountDto,
  UpdateAccountDto,
  AccountQueryDto,
} from './dto/payloads/account.dto';
import { Prisma } from 'src/generated/prisma/client';
import { calculatePaginationMeta, getPaginationParams } from 'src/common/common.exports';

const ACCOUNT_SELECT = {
  id: true,
  userId: true,
  name: true,
  type: true,
  openingBalance: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AccountSelect;

const ACCOUNT_WITH_BALANCE_SELECT = {
  ...ACCOUNT_SELECT,
  _count: {
    select: { transactions: true },
  },
  transactions: {
    where: { type: { in: ['INCOME', 'EXPENSE'] } },
    select: { type: true, amount: true },
  },
  transfersFrom: {
    select: { amount: true },
  },
  transfersTo: {
    select: { amount: true },
  },
} satisfies Prisma.AccountSelect;

type RawAccountWithBalance = Prisma.AccountGetPayload<{
  select: typeof ACCOUNT_WITH_BALANCE_SELECT;
}>;

function computeDelta(raw: RawAccountWithBalance): number {
  const txDelta = raw.transactions.reduce((sum, tx) => {
    const amt = Number(tx.amount);
    return tx.type === 'INCOME' ? sum + amt : sum - amt;
  }, 0);

  const transfersOut =
    raw.transfersFrom?.reduce((sum, tr) => sum + Number(tr.amount), 0) || 0;
  const transfersIn =
    raw.transfersTo?.reduce((sum, tr) => sum + Number(tr.amount), 0) || 0;

  return txDelta - transfersOut + transfersIn;
}

function formatAccount(raw: RawAccountWithBalance) {
  const delta = computeDelta(raw);
  const {
    transactions: _transactions,
    transfersFrom: _transfersFrom,
    transfersTo: _transfersTo,
    _count,
    openingBalance,
    ...rest
  } = raw;

  return {
    ...rest,
    currentBalance: Number(openingBalance) + delta,
    transactionCount: _count.transactions,
  };
}

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateAccountDto) {
    const raw = await this.prisma.account.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        // User enters live balance; stored as opening baseline (no txs yet).
        openingBalance: dto.currentBalance,
      },
      select: ACCOUNT_WITH_BALANCE_SELECT,
    });

    return formatAccount(raw);
  }

  async findAll(userId: string, query: AccountQueryDto) {
    const { page, limit, skip } = getPaginationParams(query);
    const {
      type,
      isArchived = false,
      search,
      orderBy = 'createdAt',
      order = 'desc',
    } = query;

    const where: Prisma.AccountWhereInput = {
      userId,
      isArchived,
      ...(type && { type }),
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    };

    const [accounts, total] = await this.prisma.$transaction([
      this.prisma.account.findMany({
        where,
        select: ACCOUNT_WITH_BALANCE_SELECT,
        orderBy: { [orderBy]: order },
        skip,
        take: limit,
      }),
      this.prisma.account.count({ where }),
    ]);

    return {
      data: accounts.map(formatAccount),
      meta: calculatePaginationMeta(total, page, limit),
    };
  }

  async findOne(userId: string, id: string) {
    const raw = await this.prisma.account.findUnique({
      where: { id },
      select: ACCOUNT_WITH_BALANCE_SELECT,
    });

    if (!raw) throw new NotFoundException('accounts.errors.notFound');

    if (raw.userId !== userId) {
      throw new ForbiddenException('accounts.errors.forbidden');
    }

    return formatAccount(raw);
  }

  async update(userId: string, id: string, dto: UpdateAccountDto) {
    await this.assertOwnership(userId, id);

    const { currentBalance, ...rest } = dto;
    const data: Prisma.AccountUpdateInput = { ...rest };

    if (currentBalance !== undefined) {
      const existing = await this.prisma.account.findUnique({
        where: { id },
        select: ACCOUNT_WITH_BALANCE_SELECT,
      });

      if (!existing) throw new NotFoundException('accounts.errors.notFound');

      // Keep computed currentBalance equal to what the user entered.
      const delta = computeDelta(existing);
      data.openingBalance = currentBalance - delta;
    }

    const raw = await this.prisma.account.update({
      where: { id },
      data,
      select: ACCOUNT_WITH_BALANCE_SELECT,
    });

    return formatAccount(raw);
  }

  async archive(userId: string, id: string) {
    await this.assertOwnership(userId, id);

    const raw = await this.prisma.account.update({
      where: { id },
      data: { isArchived: true },
      select: ACCOUNT_WITH_BALANCE_SELECT,
    });

    return formatAccount(raw);
  }

  async restore(userId: string, id: string) {
    await this.assertOwnership(userId, id);

    const raw = await this.prisma.account.update({
      where: { id },
      data: { isArchived: false },
      select: ACCOUNT_WITH_BALANCE_SELECT,
    });

    return formatAccount(raw);
  }

  async remove(userId: string, id: string) {
    await this.assertOwnership(userId, id);

    const txCount = await this.prisma.transaction.count({
      where: { accountId: id },
    });

    if (txCount > 0) {
      throw new ConflictException('accounts.errors.hasTransactions');
    }

    const raw = await this.prisma.account.delete({
      where: { id },
      select: ACCOUNT_WITH_BALANCE_SELECT,
    });

    return formatAccount(raw);
  }

  private async assertOwnership(userId: string, id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!account) throw new NotFoundException('accounts.errors.notFound');

    if (account.userId !== userId) {
      throw new ForbiddenException('accounts.errors.forbidden');
    }
  }
}
