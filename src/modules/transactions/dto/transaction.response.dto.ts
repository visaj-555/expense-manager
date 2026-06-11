import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, TransactionType } from 'src/generated/prisma/enums';

export class AccountSummaryDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'HDFC Savings' })
  name: string;

  @ApiProperty({ example: 'BANK' })
  type: string;
}

export class CategorySummaryDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Food & Dining' })
  name: string;

  @ApiPropertyOptional({ example: '🍔' })
  icon: string | null;

  @ApiPropertyOptional({ example: '#FF5733' })
  color: string | null;
}

export class TransactionResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'uuid' })
  userId: string;

  @ApiProperty({ example: 'Grocery shopping' })
  title: string;

  @ApiProperty({ enum: TransactionType })
  type: TransactionType;

  @ApiProperty({ example: 1500.00 })
  amount: number;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  transactionDate: Date;

  @ApiPropertyOptional({ enum: PaymentMethod })
  paymentMethod: PaymentMethod | null;

  @ApiPropertyOptional({ example: 'Bought vegetables and fruits' })
  notes: string | null;

  @ApiPropertyOptional({ example: 'D-Mart, Mumbai' })
  location: string | null;

  @ApiProperty({ type: () => AccountSummaryDto })
  account: AccountSummaryDto;

  @ApiPropertyOptional({ type: () => CategorySummaryDto })
  category: CategorySummaryDto | null;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  updatedAt: Date;
}