import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/database/prisma.service';
import { CreateTransferDto, TransferQueryDto, UpdateTransferDto } from './dto/payloads/transfer.dto';
import { Prisma } from 'src/generated/prisma/client';
import { calculatePaginationMeta, getPaginationParams } from 'src/common/common.exports';

const TRANSFER_SELECT = {
  id: true,
  userId: true,
  fromAccountId: true,
  toAccountId: true,
  amount: true,
  note: true,
  transferDate: true,
  createdAt: true,
  fromAccount: { select: { id: true, name: true } },
  toAccount: { select: { id: true, name: true } },
} satisfies Prisma.TransferSelect;

type RawTransfer = Prisma.TransferGetPayload<{ select: typeof TRANSFER_SELECT }>;

function formatTransfer(raw: RawTransfer) {
  return {
    ...raw,
    amount: Number(raw.amount),
  };
}

@Injectable()
export class TransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTransferDto) {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException('transfer.errors.sameAccount');
    }

    const [fromAccount, toAccount] = await Promise.all([
      this.prisma.account.findUnique({ where: { id: dto.fromAccountId } }),
      this.prisma.account.findUnique({ where: { id: dto.toAccountId } }),
    ]);

    if (!fromAccount || !toAccount) {
      throw new NotFoundException('transfer.errors.invalidAccount');
    }

    if (fromAccount.userId !== userId || toAccount.userId !== userId) {
      throw new ForbiddenException('transfer.errors.forbidden');
    }

    if (
      fromAccount.type === 'FIXED_DEPOSIT' ||
      toAccount.type === 'FIXED_DEPOSIT'
    ) {
      throw new UnprocessableEntityException('transfer.errors.fdLocked');
    }

    const raw = await this.prisma.$transaction(async (tx) => {
      return tx.transfer.create({
        data: {
          userId,
          fromAccountId: dto.fromAccountId,
          toAccountId: dto.toAccountId,
          amount: dto.amount,
          note: dto.note,
          transferDate: new Date(dto.transferDate),
        },
        select: TRANSFER_SELECT,
      });
    });

    return formatTransfer(raw);
  }

  async findAll(userId: string, query: TransferQueryDto) {
    const { page, limit, skip } = getPaginationParams(query);
    const { startDate, endDate, orderBy = 'transferDate', order = 'desc' } = query;

    const where: Prisma.TransferWhereInput = {
      userId,
      ...(startDate || endDate
        ? {
            transferDate: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
    };

    const [transfers, total] = await this.prisma.$transaction([
      this.prisma.transfer.findMany({
        where,
        select: TRANSFER_SELECT,
        orderBy: { [orderBy]: order },
        skip,
        take: limit,
      }),
      this.prisma.transfer.count({ where }),
    ]);

    return {
      data: transfers.map(formatTransfer),
      meta: calculatePaginationMeta(total, page, limit),
    };
  }

  async findOne(userId: string, id: string) {
    const raw = await this.prisma.transfer.findUnique({
      where: { id },
      select: TRANSFER_SELECT,
    });

    if (!raw) {
      throw new NotFoundException('transfer.errors.notFound');
    }

    if (raw.userId !== userId) {
      throw new ForbiddenException('transfer.errors.forbidden');
    }

    return formatTransfer(raw);
  }

  async update(userId: string, id: string, dto: UpdateTransferDto) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id },
    });

    if (!transfer) {
      throw new NotFoundException('transfer.errors.notFound');
    }

    if (transfer.userId !== userId) {
      throw new ForbiddenException('transfer.errors.forbidden');
    }

    if (dto.fromAccountId || dto.toAccountId) {
      const fromId = dto.fromAccountId || transfer.fromAccountId;
      const toId = dto.toAccountId || transfer.toAccountId;

      if (fromId === toId) {
        throw new BadRequestException('transfer.errors.sameAccount');
      }

      const [fromAccount, toAccount] = await Promise.all([
        this.prisma.account.findUnique({ where: { id: fromId } }),
        this.prisma.account.findUnique({ where: { id: toId } }),
      ]);

      if (!fromAccount || !toAccount) {
        throw new NotFoundException('transfer.errors.invalidAccount');
      }

      if (fromAccount.userId !== userId || toAccount.userId !== userId) {
        throw new ForbiddenException('transfer.errors.forbidden');
      }
    }

    const raw = await this.prisma.transfer.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.transferDate && { transferDate: new Date(dto.transferDate) }),
      },
      select: TRANSFER_SELECT,
    });

    return formatTransfer(raw);
  }

  async remove(userId: string, id: string) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id },
    });

    if (!transfer) {
      throw new NotFoundException('transfer.errors.notFound');
    }

    if (transfer.userId !== userId) {
      throw new ForbiddenException('transfer.errors.forbidden');
    }

    const raw = await this.prisma.transfer.delete({
      where: { id },
      select: TRANSFER_SELECT,
    });

    return formatTransfer(raw);
  }
}
