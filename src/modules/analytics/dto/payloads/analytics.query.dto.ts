import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

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
