import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
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
} from 'class-validator';
import { PaginationDto } from 'src/common/common.exports';
import {
  PaymentMethod,
  RecurringFrequency,
  TransactionType,
} from 'src/generated/prisma/client';

export class CreateAutomationDto {
  @ApiProperty({ example: 'HDFC Index SIP' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title: string;

  @ApiProperty({ example: 4000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @ApiProperty()
  @IsUUID()
  accountId: string;

  @ApiProperty()
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.UPI })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod = PaymentMethod.UPI;

  @ApiPropertyOptional({ enum: TransactionType, default: TransactionType.EXPENSE })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType = TransactionType.EXPENSE;

  @ApiPropertyOptional({
    enum: RecurringFrequency,
    default: RecurringFrequency.MONTHLY,
  })
  @IsOptional()
  @IsEnum(RecurringFrequency)
  frequency?: RecurringFrequency = RecurringFrequency.MONTHLY;

  @ApiProperty({
    example: '2026-08-15',
    description: 'First / next deduction date',
  })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2027-08-15' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateAutomationDto extends PartialType(CreateAutomationDto) {
  @ApiPropertyOptional({
    example: '2026-09-15',
    description: 'Change the next deduction date',
  })
  @IsOptional()
  @IsDateString()
  nextRunDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AutomationQueryDto extends PaginationDto {}
