import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from 'src/common/common.exports';

export class CreateGoalDto {
  @ApiProperty({ description: 'Name of the goal', example: 'Emergency Fund' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  name: string;

  @ApiProperty({ description: 'Target amount for the goal', minimum: 0.01 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  targetAmount: number;

  @ApiPropertyOptional({ description: 'Current saved amount', default: 0, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  currentAmount?: number = 0;

  @ApiPropertyOptional({ description: 'Target date to reach the goal', example: '2027-12-31' })
  @IsDateString()
  @IsOptional()
  targetDate?: string;
}

export class UpdateGoalDto extends PartialType(CreateGoalDto) {}

export class GoalQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc';
}
