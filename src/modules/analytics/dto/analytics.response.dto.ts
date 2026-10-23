import { ApiProperty } from '@nestjs/swagger';

export class CategoryAmountDto {
  @ApiProperty()
  category: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  percentage: number;
}

export class CategoryAnalysisResponseDto {
  @ApiProperty()
  totalExpense: number;

  @ApiProperty({ type: [CategoryAmountDto] })
  categories: CategoryAmountDto[];
}

export class TrendAmountDto {
  @ApiProperty()
  month: string;

  @ApiProperty()
  amount: number;
}

export class CashflowTrendDto {
  @ApiProperty()
  month: string;

  @ApiProperty()
  income: number;

  @ApiProperty()
  expense: number;
}

export class TopExpenseDto {
  @ApiProperty()
  title: string;

  @ApiProperty()
  amount: number;
}

export class DeepInsightItemDto {
  @ApiProperty()
  tone: 'positive' | 'warning' | 'neutral';

  @ApiProperty()
  text: string;
}

export class DeepInsightsResponseDto {
  @ApiProperty()
  period: Record<string, unknown>;

  @ApiProperty()
  summary: Record<string, unknown>;

  @ApiProperty()
  previous: Record<string, unknown>;

  @ApiProperty({ type: [Object] })
  categories: unknown[];

  @ApiProperty({ type: [Object] })
  incomeSources: unknown[];

  @ApiProperty({ type: [Object] })
  trend: unknown[];

  @ApiProperty({ type: [Object] })
  daily: unknown[];

  @ApiProperty({ type: [Object] })
  weekday: unknown[];

  @ApiProperty({ type: [Object] })
  accounts: unknown[];

  @ApiProperty({ type: [Object] })
  topExpenses: unknown[];

  @ApiProperty()
  transfers: Record<string, unknown>;

  @ApiProperty({ type: [DeepInsightItemDto] })
  insights: DeepInsightItemDto[];
}
