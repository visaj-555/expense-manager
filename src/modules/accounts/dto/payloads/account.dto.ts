import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AccountType, FdCompounding } from 'src/generated/prisma/client';
import { PaginationDto } from 'src/common/common.exports';
import { i18nValidationMessage } from 'nestjs-i18n';
import { ToBooleanQuery } from 'src/common/helpers/to-boolean-query';

const isFd = (o: { type?: AccountType }) => o.type === AccountType.FIXED_DEPOSIT;

export class CreateAccountDto {
  @IsString({
    message: i18nValidationMessage('accounts.validation.name_string'),
  })
  @IsNotEmpty({
    message: i18nValidationMessage('accounts.validation.name_required'),
  })
  name: string;

  @IsEnum(AccountType, {
    message: i18nValidationMessage('accounts.validation.invalid_type'),
  })
  type: AccountType;

  @ApiProperty({
    description:
      'Live cash/bank snapshot, or FD principal (the amount you deposited).',
  })
  @IsNumber(
    {},
    {
      message: i18nValidationMessage(
        'accounts.validation.current_balance_number',
      ),
    },
  )
  @Min(0, {
    message: i18nValidationMessage('accounts.validation.current_balance_min'),
  })
  currentBalance: number;

  @ApiPropertyOptional({ example: 7.25, description: 'Annual interest rate %' })
  @ValidateIf(isFd)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.01)
  @Max(30)
  interestRate?: number;

  @ApiPropertyOptional({ example: '2026-04-01' })
  @ValidateIf(isFd)
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: 12, description: 'Tenure in months' })
  @ValidateIf(isFd)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  tenureMonths?: number;

  @ApiPropertyOptional({ enum: FdCompounding, default: FdCompounding.QUARTERLY })
  @ValidateIf(isFd)
  @IsOptional()
  @IsEnum(FdCompounding)
  compounding?: FdCompounding;
}

export class UpdateAccountDto {
  @ApiPropertyOptional({ example: 'Updated Name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: AccountType })
  @IsEnum(AccountType)
  @IsOptional()
  type?: AccountType;

  @ApiPropertyOptional({ example: 500.0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  currentBalance?: number;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isArchived?: boolean;

  @ApiPropertyOptional({ example: 7.25 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.01)
  @Max(30)
  interestRate?: number;

  @ApiPropertyOptional({ example: '2026-04-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  tenureMonths?: number;

  @ApiPropertyOptional({ enum: FdCompounding })
  @IsOptional()
  @IsEnum(FdCompounding)
  compounding?: FdCompounding;
}

export class AccountQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: AccountType, description: 'Filter by account type' })
  @IsOptional()
  @IsEnum(AccountType)
  type?: AccountType;

  @ApiPropertyOptional({ example: false, description: 'Filter archived accounts' })
  @IsOptional()
  @ToBooleanQuery(false)
  @IsBoolean()
  isArchived?: boolean = false;

  @ApiPropertyOptional({ example: 'hdfc', description: 'Search by account name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: ['name', 'createdAt', 'updatedAt'],
    default: 'createdAt',
    description: 'Field to sort by',
  })
  @IsOptional()
  @IsEnum(['name', 'createdAt', 'updatedAt'])
  orderBy?: 'name' | 'createdAt' | 'updatedAt' = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}
