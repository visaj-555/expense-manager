import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/database/prisma.service';
import { CreateGoalDto, GoalQueryDto, UpdateGoalDto } from './dto/payloads/goal.dto';
import { Prisma } from 'src/generated/prisma/client';
import { calculatePaginationMeta, getPaginationParams } from 'src/common/common.exports';

const GOAL_SELECT = {
  id: true,
  userId: true,
  name: true,
  isCompleted: true,
  targetAmount: true,
  currentAmount: true,
  targetDate: true,
  createdAt: true,
} satisfies Prisma.GoalSelect;

type RawGoal = Prisma.GoalGetPayload<{ select: typeof GOAL_SELECT }>;

function formatGoal(raw: RawGoal) {
  const currentAmt = Number(raw.currentAmount);
  const targetAmt = Number(raw.targetAmount);

  let progress = 0;
  if (targetAmt > 0) {
    progress = (currentAmt / targetAmt) * 100;
  }
  
  // Cap at 100% just in case, though it's nice to see >100 sometimes. 
  // We'll leave it uncapped to show overachievement, but ensure it's rounded cleanly.
  progress = Math.round(progress * 100) / 100;

  return {
    id: raw.id,
    userId: raw.userId,
    name: raw.name,
    targetAmount: targetAmt,
    currentAmount: currentAmt,
    targetDate: raw.targetDate,
    progress,
    status: raw.isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
    createdAt: raw.createdAt,
  };
}

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateGoalDto) {
    const raw = await this.prisma.goal.create({
      data: {
        userId,
        name: dto.name,
        targetAmount: dto.targetAmount,
        currentAmount: dto.currentAmount || 0,
        ...(dto.targetDate && { targetDate: new Date(dto.targetDate) }),
      },
      select: GOAL_SELECT,
    });

    return formatGoal(raw);
  }

  async findAll(userId: string, query: GoalQueryDto) {
    const { page, limit, skip } = getPaginationParams(query);
    const { orderBy = 'createdAt', order = 'desc' } = query;

    const where: Prisma.GoalWhereInput = {
      userId,
    };

    const [goals, total] = await this.prisma.$transaction([
      this.prisma.goal.findMany({
        where,
        select: GOAL_SELECT,
        orderBy: { [orderBy]: order },
        skip,
        take: limit,
      }),
      this.prisma.goal.count({ where }),
    ]);

    return {
      data: goals.map(formatGoal),
      meta: calculatePaginationMeta(total, page, limit),
    };
  }

  async findOne(userId: string, id: string) {
    const raw = await this.prisma.goal.findUnique({
      where: { id },
      select: GOAL_SELECT,
    });

    if (!raw) {
      throw new NotFoundException('goals.errors.notFound');
    }

    if (raw.userId !== userId) {
      throw new ForbiddenException('goals.errors.forbidden');
    }

    return formatGoal(raw);
  }

  async update(userId: string, id: string, dto: UpdateGoalDto) {
    const goal = await this.prisma.goal.findUnique({
      where: { id },
    });

    if (!goal) {
      throw new NotFoundException('goals.errors.notFound');
    }

    if (goal.userId !== userId) {
      throw new ForbiddenException('goals.errors.forbidden');
    }

    const raw = await this.prisma.goal.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.targetDate !== undefined && { 
          targetDate: dto.targetDate ? new Date(dto.targetDate) : null 
        }),
      },
      select: GOAL_SELECT,
    });

    return formatGoal(raw);
  }

  async complete(userId: string, id: string) {
    const goal = await this.prisma.goal.findUnique({
      where: { id },
    });

    if (!goal) {
      throw new NotFoundException('goals.errors.notFound');
    }

    if (goal.userId !== userId) {
      throw new ForbiddenException('goals.errors.forbidden');
    }

    const raw = await this.prisma.goal.update({
      where: { id },
      data: {
        isCompleted: true,
      },
      select: GOAL_SELECT,
    });

    return formatGoal(raw);
  }

  async remove(userId: string, id: string) {
    const goal = await this.prisma.goal.findUnique({
      where: { id },
    });

    if (!goal) {
      throw new NotFoundException('goals.errors.notFound');
    }

    if (goal.userId !== userId) {
      throw new ForbiddenException('goals.errors.forbidden');
    }

    const raw = await this.prisma.goal.delete({
      where: { id },
      select: GOAL_SELECT,
    });

    return formatGoal(raw);
  }
}
