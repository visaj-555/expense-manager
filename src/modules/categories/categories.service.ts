import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/database/prisma.service';


import { Prisma } from 'src/generated/prisma/client';
import { CategoryQueryDto, CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { calculatePaginationMeta, getPaginationParams } from 'src/common/common.exports';

// ─── Selects ──────────────────────────────────────────────────────────────────

const CATEGORY_SELECT = {
  id: true,
  userId: true,
  name: true,
  type: true,
  icon: true,
  color: true,
  isArchived: true,
  createdAt: true,
  _count: {
    select: { transactions: true },
  },
} satisfies Prisma.CategorySelect;

// ─── Types ────────────────────────────────────────────────────────────────────

type RawCategory = Prisma.CategoryGetPayload<{
  select: typeof CATEGORY_SELECT;
}>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCategory(raw: RawCategory) {
  const { _count, ...rest } = raw;
  return {
    ...rest,
    transactionCount: _count.transactions,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Create ──────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateCategoryDto) {
    const raw = await this.prisma.category.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        icon: dto.icon,
        color: dto.color,
      },
      select: CATEGORY_SELECT,
    });

    return formatCategory(raw);
  }

  // ── List ────────────────────────────────────────────────────────────────────

  async findAll(userId: string, query: CategoryQueryDto) {
    const { page, limit, skip } = getPaginationParams(query);
    const { type, isArchived = false, search, orderBy = 'createdAt', order = 'asc' } = query;

    const where: Prisma.CategoryWhereInput = {
      userId,
      isArchived,
      ...(type && { type }),
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    };

    const [categories, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        select: CATEGORY_SELECT,
        orderBy: { [orderBy]: order },
        skip,
        take: limit,
      }),
      this.prisma.category.count({ where }),
    ]);

    return {
      data: categories.map(formatCategory),
      meta: calculatePaginationMeta(total, page, limit),
    };
  }

  // ── Find one ────────────────────────────────────────────────────────────────

  async findOne(userId: string, id: string) {
    const raw = await this.prisma.category.findUnique({
      where: { id },
      select: CATEGORY_SELECT,
    });

    if (!raw) throw new NotFoundException('categories.errors.notFound');

    if (raw.userId !== userId) {
      throw new ForbiddenException('categories.errors.forbidden');
    }

    return formatCategory(raw);
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  async update(userId: string, id: string, dto: UpdateCategoryDto) {
    await this.assertOwnership(userId, id);

    const raw = await this.prisma.category.update({
      where: { id },
      data: dto,
      select: CATEGORY_SELECT,
    });

    return formatCategory(raw);
  }

  // ── Archive (soft delete) ────────────────────────────────────────────────────

  async archive(userId: string, id: string) {
    await this.assertOwnership(userId, id);

    const raw = await this.prisma.category.update({
      where: { id },
      data: { isArchived: true },
      select: CATEGORY_SELECT,
    });

    return formatCategory(raw);
  }

  // ── Restore ──────────────────────────────────────────────────────────────────

  async restore(userId: string, id: string) {
    await this.assertOwnership(userId, id);

    const raw = await this.prisma.category.update({
      where: { id },
      data: { isArchived: false },
      select: CATEGORY_SELECT,
    });

    return formatCategory(raw);
  }

  // ── Hard delete ──────────────────────────────────────────────────────────────

  /**
   * Blocked if category has any transactions or budgets attached.
   * Callers should archive instead, or reassign linked records first.
   */
  async remove(userId: string, id: string) {
    await this.assertOwnership(userId, id);

    const [txCount, budgetCount] = await this.prisma.$transaction([
      this.prisma.transaction.count({ where: { categoryId: id } }),
      this.prisma.budget.count({ where: { categoryId: id } }),
    ]);

    if (txCount > 0 || budgetCount > 0) {
      throw new ConflictException('categories.errors.inUse');
    }

    const raw = await this.prisma.category.delete({
      where: { id },
      select: CATEGORY_SELECT,
    });

    return formatCategory(raw);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async assertOwnership(userId: string, id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!category) throw new NotFoundException('categories.errors.notFound');

    if (category.userId !== userId) {
      throw new ForbiddenException('categories.errors.forbidden');
    }
  }
}