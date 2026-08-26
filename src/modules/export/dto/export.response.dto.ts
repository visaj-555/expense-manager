import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExportPeriodDto {
  @ApiProperty({ enum: ['all', 'year', 'month'] })
  range: string;

  @ApiPropertyOptional()
  year?: number;

  @ApiPropertyOptional()
  month?: number;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  from?: string | null;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00.000Z' })
  to?: string | null;
}

export class ExportSummaryDto {
  @ApiProperty()
  accounts: number;

  @ApiProperty()
  categories: number;

  @ApiProperty()
  transactions: number;

  @ApiProperty()
  transfers: number;

  @ApiProperty()
  goals: number;

  @ApiProperty()
  automations: number;
}

export class ExportPayloadDto {
  @ApiProperty()
  exportedAt: string;

  @ApiProperty({ type: ExportPeriodDto })
  period: ExportPeriodDto;

  @ApiProperty({ type: ExportSummaryDto })
  summary: ExportSummaryDto;

  @ApiProperty()
  user: Record<string, unknown>;

  @ApiProperty({ type: [Object] })
  accounts: unknown[];

  @ApiProperty({ type: [Object] })
  categories: unknown[];

  @ApiProperty({ type: [Object] })
  transactions: unknown[];

  @ApiProperty({ type: [Object] })
  transfers: unknown[];

  @ApiProperty({ type: [Object] })
  goals: unknown[];

  @ApiProperty({ type: [Object] })
  automations: unknown[];
}
