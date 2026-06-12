import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { PaginationDto } from 'src/common/common.exports';

export class CreateTransferDto {
  @ApiProperty({ description: 'ID of the account to transfer money from' })
  @IsUUID()
  @IsNotEmpty()
  fromAccountId: string;

  @ApiProperty({ description: 'ID of the account to transfer money to' })
  @IsUUID()
  @IsNotEmpty()
  toAccountId: string;

  @ApiProperty({ description: 'Amount to transfer', minimum: 0.01 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional({ description: 'Optional note for the transfer' })
  @IsString()
  @IsOptional()
  @MinLength(1)
  note?: string;

  @ApiProperty({ description: 'Date of the transfer', example: '2026-06-04T10:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  transferDate: string;
}

export class UpdateTransferDto extends PartialType(CreateTransferDto) {}

export class TransferQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by start date (ISO string)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter by end date (ISO string)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc';
}
