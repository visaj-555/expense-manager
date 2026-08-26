import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export const EXPORT_RANGES = ['all', 'year', 'month'] as const;
export type ExportRange = (typeof EXPORT_RANGES)[number];

export class ExportQueryDto {
  @ApiPropertyOptional({ enum: EXPORT_RANGES, default: 'all' })
  @IsOptional()
  @IsIn(EXPORT_RANGES)
  range?: ExportRange = 'all';

  @ApiPropertyOptional({ description: 'Required when range is year or month', example: 2026 })
  @ValidateIf((query: ExportQueryDto) => query.range === 'year' || query.range === 'month')
  @IsInt()
  @Min(2000)
  @Max(2100)
  @Type(() => Number)
  year?: number;

  @ApiPropertyOptional({ description: 'Required when range is month (1-12)', example: 8 })
  @ValidateIf((query: ExportQueryDto) => query.range === 'month')
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month?: number;
}
