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
