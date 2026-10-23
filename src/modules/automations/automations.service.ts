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
  CreateAutomationDto,
  AutomationQueryDto,
  UpdateAutomationDto,
} from './dto/payloads/automation.dto';
import {
  addFrequency,
  currentDueDate,
  todayUtc,
  toUtcDay,
} from './automation-dates';

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
    const nextRunDate = currentDueDate(startDate, frequency, todayUtc());

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

    await this.processDue(userId);
    return formatAutomation(
      (await this.prisma.recurringTransaction.findUnique({
        where: { id },
        select: AUTOMATION_SELECT,
      })) ?? raw,
    );
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
    const today = todayUtc();
    const active = await this.prisma.recurringTransaction.findMany({
      where: { userId, isActive: true },
      select: AUTOMATION_SELECT,
    });

    let posted = 0;
    for (const row of active) {
      const nextRun = toUtcDay(row.nextRunDate);
      const dueDate = currentDueDate(row.startDate, row.frequency, today);
      const lastProcessed = row.lastProcessed
        ? toUtcDay(row.lastProcessed)
        : null;

      // Create used to skip an already-due cycle (e.g. rent on the 1st,
      // created on the 23rd) and park nextRunDate in the following month.
      if (
        nextRun > today &&
        dueDate <= today &&
        (!lastProcessed || lastProcessed < dueDate)
      ) {
        posted += await this.processOne({ ...row, nextRunDate: dueDate });
        continue;
      }

      if (nextRun <= today) {
        posted += await this.processOne(row);
      }
    }
    return posted;
  }

  private async processOne(row: RawAutomation) {
    if (!row.isActive) return 0;

    const today = todayUtc();
    let nextRun = toUtcDay(row.nextRunDate);
    const endDate = row.endDate ? toUtcDay(row.endDate) : null;
    const anchorDay = toUtcDay(row.startDate).getUTCDate();
    const occurrences: Date[] = [];

    for (let i = 0; i < 36 && nextRun <= today; i += 1) {
      if (endDate && nextRun > endDate) break;
      occurrences.push(nextRun);
      nextRun = addFrequency(nextRun, row.frequency, anchorDay);
    }

    if (occurrences.length === 0 && !(endDate && nextRun > endDate)) {
      return 0;
    }

    const ended = Boolean(endDate && nextRun > endDate);
    const amount = Number(row.amount);

    await this.prisma.$transaction(async (tx) => {
      for (const when of occurrences) {
        await tx.transaction.create({
          data: {
            userId: row.userId,
            accountId: row.accountId,
            categoryId: row.categoryId,
            type: row.type === 'TRANSFER' ? 'EXPENSE' : row.type,
            amount,
            title: row.title,
            notes: row.notes ?? 'Automated deduction',
            transactionDate: when,
            paymentMethod: row.paymentMethod,
          },
        });
      }

      await tx.recurringTransaction.update({
        where: { id: row.id },
        data: {
          lastProcessed: occurrences.length > 0 ? today : row.lastProcessed,
          nextRunDate: nextRun,
          isActive: ended ? false : row.isActive,
        },
      });
    });

    return occurrences.length;
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
      select: { userId: true, isArchived: true, type: true },
    });
    if (!account) throw new NotFoundException('automations.errors.accountNotFound');
    if (account.userId !== userId) {
      throw new ForbiddenException('automations.errors.forbidden');
    }
    if (account.isArchived) {
      throw new UnprocessableEntityException('automations.errors.accountArchived');
    }
    if (account.type === 'FIXED_DEPOSIT') {
      throw new UnprocessableEntityException('automations.errors.fdLocked');
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
