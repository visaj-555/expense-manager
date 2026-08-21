import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/database/prisma.service';
import {
  CreateAccountDto,
  UpdateAccountDto,
  AccountQueryDto,
} from './dto/payloads/account.dto';
import { AccountType, FdCompounding, Prisma } from 'src/generated/prisma/client';
import { calculatePaginationMeta, getPaginationParams } from 'src/common/common.exports';
import {
  computeFixedDeposit,
  toFdResponse,
  type FdCompounding as FdCompoundingName,
} from 'src/common/helpers/fixed-deposit';

const ACCOUNT_SELECT = {
  id: true,
  userId: true,
  name: true,
  type: true,
  openingBalance: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
  fdInterestRate: true,
  fdStartDate: true,
  fdTenureMonths: true,
  fdCompounding: true,
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

function snapshotFd(raw: {
  type: AccountType;
  openingBalance: Prisma.Decimal | number;
  fdInterestRate: Prisma.Decimal | number | null;
  fdStartDate: Date | null;
  fdTenureMonths: number | null;
  fdCompounding: FdCompounding | null;
}) {
  if (raw.type !== AccountType.FIXED_DEPOSIT) return null;
  if (
    raw.fdInterestRate == null ||
    !raw.fdStartDate ||
    raw.fdTenureMonths == null
  ) {
    return null;
  }

  return computeFixedDeposit({
    principal: Number(raw.openingBalance),
    interestRate: Number(raw.fdInterestRate),
    startDate: raw.fdStartDate,
    tenureMonths: raw.fdTenureMonths,
    compounding: (raw.fdCompounding ??
      'QUARTERLY') as FdCompoundingName,
  });
}

function formatAccount(raw: RawAccountWithBalance) {
  const delta = computeDelta(raw);
  const fd = snapshotFd(raw);
  const {
    transactions: _transactions,
    transfersFrom: _transfersFrom,
    transfersTo: _transfersTo,
    _count,
    openingBalance,
    fdInterestRate: _rate,
    fdStartDate: _start,
    fdTenureMonths: _tenure,
    fdCompounding: _compounding,
    ...rest
  } = raw;

  return {
    ...rest,
    currentBalance: fd ? fd.currentValue : Number(openingBalance) + delta,
    transactionCount: _count.transactions,
    fd: fd ? toFdResponse(fd) : null,
  };
}

function fdCreateData(dto: CreateAccountDto) {
  if (dto.type !== AccountType.FIXED_DEPOSIT) {
    return {
      fdInterestRate: null,
      fdStartDate: null,
      fdTenureMonths: null,
      fdCompounding: null,
    };
  }

  if (
    dto.interestRate == null ||
    !dto.startDate ||
    dto.tenureMonths == null
  ) {
    throw new BadRequestException('accounts.errors.fdDetailsRequired');
  }

  return {
    fdInterestRate: dto.interestRate,
    fdStartDate: new Date(dto.startDate),
    fdTenureMonths: dto.tenureMonths,
    fdCompounding: dto.compounding ?? FdCompounding.QUARTERLY,
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
        openingBalance: dto.currentBalance,
        ...fdCreateData(dto),
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

    const existing = await this.prisma.account.findUnique({
      where: { id },
      select: ACCOUNT_WITH_BALANCE_SELECT,
    });

    if (!existing) throw new NotFoundException('accounts.errors.notFound');

    const nextType = dto.type ?? existing.type;
    const {
      currentBalance,
      interestRate,
      startDate,
      tenureMonths,
      compounding,
      ...rest
    } = dto;
    const data: Prisma.AccountUpdateInput = { ...rest };

    if (nextType === AccountType.FIXED_DEPOSIT) {
      if (currentBalance !== undefined) {
        data.openingBalance = currentBalance;
      }
      if (interestRate !== undefined) data.fdInterestRate = interestRate;
      if (startDate !== undefined) data.fdStartDate = new Date(startDate);
      if (tenureMonths !== undefined) data.fdTenureMonths = tenureMonths;
      if (compounding !== undefined) data.fdCompounding = compounding;

      const mergedRate = interestRate ?? existing.fdInterestRate;
      const mergedStart = startDate
        ? new Date(startDate)
        : existing.fdStartDate;
      const mergedTenure = tenureMonths ?? existing.fdTenureMonths;
      if (mergedRate == null || !mergedStart || mergedTenure == null) {
        throw new BadRequestException('accounts.errors.fdDetailsRequired');
      }
    } else {
      if (dto.type && dto.type !== AccountType.FIXED_DEPOSIT) {
        data.fdInterestRate = null;
        data.fdStartDate = null;
        data.fdTenureMonths = null;
        data.fdCompounding = null;
      }
      if (currentBalance !== undefined) {
        const delta = computeDelta(existing);
        data.openingBalance = currentBalance - delta;
      }
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
