import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  NotEquals,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { PaymentMethod, TransactionType } from 'src/generated/prisma/enums';
import { i18nValidationMessage } from 'nestjs-i18n';

// ─── Create ───────────────────────────────────────────────────────────────────

export class CreateTransactionDto {
  @ApiProperty({ example: 'Grocery shopping' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title: string;

  @ApiProperty({ enum: TransactionType, description: 'TRANSFER type is not allowed here' })
  @IsEnum(TransactionType)
  @NotEquals(TransactionType.TRANSFER, {
    message: 'Use the /transfers endpoint for transfer transactions',
  })
  type: TransactionType;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message: i18nValidationMessage(
        'transactions.validation.amount_number',
      ),
    }
  )
  @Min(0.01, {
    message: i18nValidationMessage(
      'transactions.validation.amount_min',
    ),
  })
  amount: number;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  @IsDateString()
  transactionDate: string;

  @ApiProperty({ example: 'uuid-of-account' })
  @IsUUID()
  accountId: string;

  @ApiPropertyOptional({ example: 'uuid-of-category' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ example: 'Bought vegetables and fruits' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ example: 'D-Mart, Mumbai' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Catch-up only: keep today\'s cash/bank snapshot unchanged for past/future dates. Ignored for today — live spends always update the selected account. Set false to also update the snapshot on a catch-up date.',
  })
  @IsOptional()
  @IsBoolean()
  preserveCurrentBalance?: boolean;
}

// ─── Update ───────────────────────────────────────────────────────────────────

// Omit type from partial — type changes are too risky after creation
// (would silently affect balance computations and reports).
// If a user made the wrong type, they should delete and re-create.
export class UpdateTransactionDto extends PartialType(CreateTransactionDto) { }

export class BulkCreateTransactionsDto {
  @ApiProperty({ type: [CreateTransactionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionDto)
  transactions: CreateTransactionDto[];
}

// ─── Query / Filters ──────────────────────────────────────────────────────────

export class TransactionQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'uuid-of-account', description: 'Filter by account' })
  @IsOptional()
  @IsUUID(undefined, {
    message: i18nValidationMessage(
      'transactions.validation.account_id_invalid',
    ),
  })
  accountId: string;

  @ApiPropertyOptional({ example: 'uuid-of-category', description: 'Filter by category' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: TransactionType, description: 'Filter by transaction type' })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({ enum: PaymentMethod, description: 'Filter by payment method' })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ example: '2024-01-01', description: 'Start date (inclusive)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2024-01-31', description: 'End date (inclusive)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'grocery', description: 'Search by title' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @ApiPropertyOptional({ example: 100, description: 'Minimum amount filter' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional({ example: 5000, description: 'Maximum amount filter' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxAmount?: number;

  @ApiPropertyOptional({
    enum: ['transactionDate', 'amount', 'createdAt'],
    default: 'transactionDate',
  })
  @IsOptional()
  @IsEnum(['transactionDate', 'amount', 'createdAt'])
  orderBy?: 'transactionDate' | 'amount' | 'createdAt' = 'transactionDate';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}