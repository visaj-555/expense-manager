import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export enum AnalyticsPeriod {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export class MonthlyQueryDto {
  @ApiPropertyOptional({ description: 'Month (1-12)', example: 6 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month?: number;

  @ApiPropertyOptional({ description: 'Year (YYYY)', example: 2026 })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  @Type(() => Number)
  year?: number;
}

export class YearlyQueryDto {
  @ApiPropertyOptional({ description: 'Year (YYYY)', example: 2026 })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  @Type(() => Number)
  year?: number;
}

export class DeepInsightsQueryDto {
  @ApiPropertyOptional({ enum: AnalyticsPeriod, default: AnalyticsPeriod.MONTHLY })
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod = AnalyticsPeriod.MONTHLY;

  @ApiPropertyOptional({ description: 'Month (1-12)', example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month?: number;

  @ApiPropertyOptional({ description: 'Year (YYYY)', example: 2026 })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  @Type(() => Number)
  year?: number;

  @ApiPropertyOptional({ description: 'Optional expense category drill-down' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
