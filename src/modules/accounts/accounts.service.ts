import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/database/prisma.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/payloads/account.dto';

const ACCOUNT_SELECT = {
  id: true,
  userId: true,
  name: true,
  type: true,
  openingBalance: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) { }

  async create(userId: string, dto: CreateAccountDto) {
    return this.prisma.account.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        openingBalance: dto.openingBalance,
      },
      select: ACCOUNT_SELECT,
    });
  }

  async findAll(userId: string) {
    return this.prisma.account.findMany({
      where: { userId },
      select: ACCOUNT_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      select: ACCOUNT_SELECT,
    });

    if (!account) {
      throw new NotFoundException('accounts.errors.notFound');
    }

    if (account.userId !== userId) {
      throw new ForbiddenException('accounts.errors.forbidden');
    }

    return account;
  }

  async update(userId: string, id: string, dto: UpdateAccountDto) {
    await this.findOne(userId, id); // ownership check

    return this.prisma.account.update({
      where: { id },
      data: dto,
      select: ACCOUNT_SELECT,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id); // ownership check

    return this.prisma.account.delete({
      where: { id },
      select: ACCOUNT_SELECT,
    });
  }
}