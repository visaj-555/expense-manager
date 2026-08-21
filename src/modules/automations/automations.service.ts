import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/database/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import {
  calculatePaginationMeta,
  getPaginationParams,
} from 'src/common/common.exports';
import {
  getAccountCurrentBalance,
  isLiveToday,
  pinAccountCurrentBalance,
} from 'src/common/helpers/account-ledger';
import {
  CreateAutomationDto,
  AutomationQueryDto,
  UpdateAutomationDto,
} from './dto/payloads/automation.dto';
import { addFrequency, todayUtc, toUtcDay } from './automation-dates';

const AUTOMATION_SELECT = {
  id: true,
  userId: true,
  accountId: true,
  categoryId: true,
  type: true,
  amount: true,
  title: true,
  notes: true,
  paymentMethod: true,
  frequency: true,
  startDate: true,
  endDate: true,
  lastProcessed: true,
  nextRunDate: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  account: { select: { id: true, name: true, type: true } },
  category: { select: { id: true, name: true, icon: true, color: true } },
} satisfies Prisma.RecurringTransactionSelect;

type RawAutomation = Prisma.RecurringTransactionGetPayload<{
  select: typeof AUTOMATION_SELECT;
}>;

function formatAutomation(raw: RawAutomation) {
  return {
    ...raw,
    amount: Number(raw.amount),
  };
}

@Injectable()
export class AutomationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateAutomationDto) {
    await this.assertAccount(userId, dto.accountId);
    await this.assertCategory(userId, dto.categoryId);

    const frequency = dto.frequency ?? 'MONTHLY';
    const startDate = toUtcDay(dto.startDate);
    const today = todayUtc();
    let nextRunDate = startDate;
    let guard = 0;
    while (nextRunDate < today && guard < 36) {
      nextRunDate = addFrequency(nextRunDate, frequency);
      guard += 1;
    }

    const raw = await this.prisma.recurringTransaction.create({
      data: {
        userId,
        title: dto.title,
        amount: dto.amount,
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        paymentMethod: dto.paymentMethod ?? 'UPI',
        type: dto.type && dto.type !== 'TRANSFER' ? dto.type : 'EXPENSE',
        frequency,
        startDate,
        nextRunDate,
        endDate: dto.endDate ? toUtcDay(dto.endDate) : null,
        notes: dto.notes ?? null,
      },
      select: AUTOMATION_SELECT,
    });

    await this.processDue(userId);
    return formatAutomation(
      (await this.prisma.recurringTransaction.findUnique({
        where: { id: raw.id },
        select: AUTOMATION_SELECT,
      })) ?? raw,
    );
  }

  async findAll(userId: string, query: AutomationQueryDto) {
    await this.processDue(userId);

    const { page, limit, skip } = getPaginationParams(query);
    const where: Prisma.RecurringTransactionWhereInput = {
      userId,
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.recurringTransaction.findMany({
        where,
        select: AUTOMATION_SELECT,
        orderBy: [{ isActive: 'desc' }, { nextRunDate: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.recurringTransaction.count({ where }),
    ]);

    return {
      data: rows.map(formatAutomation),
      meta: calculatePaginationMeta(total, page, limit),
    };
  }

  async findOne(userId: string, id: string) {
    return formatAutomation(await this.getOwned(userId, id));
  }

  async update(userId: string, id: string, dto: UpdateAutomationDto) {
    await this.getOwned(userId, id);
    if (dto.accountId) await this.assertAccount(userId, dto.accountId);
    if (dto.categoryId) await this.assertCategory(userId, dto.categoryId);

    const { startDate, endDate, nextRunDate, type, ...rest } = dto;
    const raw = await this.prisma.recurringTransaction.update({
      where: { id },
      data: {
        ...rest,
        ...(type && type !== 'TRANSFER' ? { type } : {}),
        ...(startDate && { startDate: toUtcDay(startDate) }),
        ...(nextRunDate && { nextRunDate: toUtcDay(nextRunDate) }),
        ...(endDate !== undefined && {
          endDate: endDate ? toUtcDay(endDate) : null,
        }),
      },
      select: AUTOMATION_SELECT,
    });

    return formatAutomation(raw);
  }

  async remove(userId: string, id: string) {
    await this.getOwned(userId, id);
    const raw = await this.prisma.recurringTransaction.delete({
      where: { id },
      select: AUTOMATION_SELECT,
    });
    return formatAutomation(raw);
  }

  async runDue(userId: string, id: string) {
    const existing = await this.getOwned(userId, id);
    const posted = await this.processOne(existing);
    if (posted === 0) {
      throw new UnprocessableEntityException('automations.errors.notDue');
    }
    return formatAutomation(await this.getOwned(userId, id));
  }

  async processDue(userId: string) {
    const due = await this.prisma.recurringTransaction.findMany({
      where: {
        userId,
        isActive: true,
        nextRunDate: { lte: todayUtc() },
      },
      select: AUTOMATION_SELECT,
    });

    let posted = 0;
    for (const row of due) {
      posted += await this.processOne(row);
    }
    return posted;
  }

  private async processOne(row: RawAutomation) {
    if (!row.isActive) return 0;

    const today = todayUtc();
    let nextRun = toUtcDay(row.nextRunDate);
    const endDate = row.endDate ? toUtcDay(row.endDate) : null;
    let posted = 0;

    for (let i = 0; i < 36 && nextRun <= today; i += 1) {
      if (endDate && nextRun > endDate) break;

      const amount = Number(row.amount);
      const preserve = !isLiveToday(nextRun);
      const snapshot = preserve
        ? await getAccountCurrentBalance(this.prisma, row.accountId)
        : null;

      await this.prisma.transaction.create({
        data: {
          userId: row.userId,
          accountId: row.accountId,
          categoryId: row.categoryId,
          type: row.type === 'TRANSFER' ? 'EXPENSE' : row.type,
          amount,
          title: row.title,
          notes: row.notes ?? 'Automated deduction',
          transactionDate: nextRun,
          paymentMethod: row.paymentMethod,
        },
      });

      if (snapshot != null) {
        await pinAccountCurrentBalance(this.prisma, row.accountId, snapshot);
      }

      posted += 1;
      nextRun = addFrequency(nextRun, row.frequency);
    }

    const ended = Boolean(endDate && nextRun > endDate);
    await this.prisma.recurringTransaction.update({
      where: { id: row.id },
      data: {
        lastProcessed: posted > 0 ? today : row.lastProcessed,
        nextRunDate: nextRun,
        isActive: ended ? false : row.isActive,
      },
    });

    return posted;
  }

  private async getOwned(userId: string, id: string) {
    const raw = await this.prisma.recurringTransaction.findUnique({
      where: { id },
      select: AUTOMATION_SELECT,
    });
    if (!raw) throw new NotFoundException('automations.errors.notFound');
    if (raw.userId !== userId) {
      throw new ForbiddenException('automations.errors.forbidden');
    }
    return raw;
  }

  private async assertAccount(userId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { userId: true, isArchived: true },
    });
    if (!account) throw new NotFoundException('automations.errors.accountNotFound');
    if (account.userId !== userId) {
      throw new ForbiddenException('automations.errors.forbidden');
    }
    if (account.isArchived) {
      throw new UnprocessableEntityException('automations.errors.accountArchived');
    }
  }

  private async assertCategory(userId: string, categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { userId: true, isArchived: true },
    });
    if (!category) throw new NotFoundException('automations.errors.categoryNotFound');
    if (category.userId !== userId) {
      throw new ForbiddenException('automations.errors.forbidden');
    }
    if (category.isArchived) {
      throw new UnprocessableEntityException('automations.errors.categoryArchived');
    }
  }
}
