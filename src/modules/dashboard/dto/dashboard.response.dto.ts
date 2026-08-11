import { ApiProperty } from '@nestjs/swagger';

export class DashboardOverviewDto {
  @ApiProperty({ description: 'Sum of BANK account balances' })
  currentBalance: number;

  @ApiProperty({ description: 'Sum of WALLET (cash) account balances' })
  currentWalletBalance: number;

  @ApiProperty()
  monthlyIncome: number;

  @ApiProperty()
  monthlyExpense: number;

  @ApiProperty()
  monthlySavings: number;

  @ApiProperty({ description: 'Total amount in SIP category' })
  monthlyInvestments: number;

  @ApiProperty()
  netCashFlow: number;

  @ApiProperty()
  savingsRate: number;
}

export class DashboardAccountDistributionDto {
  @ApiProperty()
  account: string;

  @ApiProperty()
  balance: number;
}

export class DashboardCategoryAmountDto {
  @ApiProperty()
  category: string;

  @ApiProperty()
  amount: number;
}

export class DashboardMonthlySummaryDto {
  @ApiProperty({ type: [DashboardCategoryAmountDto] })
  topCategories: DashboardCategoryAmountDto[];
}

export class DashboardRecentTransactionDto {
  @ApiProperty()
  title: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  type: string;

  @ApiProperty()
  category: string;

  @ApiProperty({ format: 'date-time' })
  transactionDate: Date;
}

export class DashboardGoalProgressDto {
  @ApiProperty()
  goalName: string;

  @ApiProperty()
  targetAmount: number;

  @ApiProperty()
  currentAmount: number;

  @ApiProperty()
  progress: number;
}

export class DashboardBudgetSummaryDto {
  @ApiProperty()
  category: string;

  @ApiProperty()
  budget: number;

  @ApiProperty()
  spent: number;

  @ApiProperty()
  remaining: number;

  @ApiProperty()
  percentageUsed: number;
}

export class DashboardSpendingTrendDto {
  @ApiProperty()
  month: string;

  @ApiProperty()
  expense: number;
}

export class DashboardResponseDto {
  @ApiProperty()
  overview: DashboardOverviewDto;

  @ApiProperty({ type: [DashboardAccountDistributionDto] })
  accountDistribution: DashboardAccountDistributionDto[];

  @ApiProperty()
  monthlySummary: DashboardMonthlySummaryDto;

  @ApiProperty({ type: [DashboardRecentTransactionDto] })
  recentTransactions: DashboardRecentTransactionDto[];

  @ApiProperty({ type: [DashboardGoalProgressDto] })
  goalsProgress: DashboardGoalProgressDto[];

  @ApiProperty({ type: [DashboardBudgetSummaryDto] })
  budgetSummary: DashboardBudgetSummaryDto[];

  @ApiProperty({ type: [DashboardSpendingTrendDto] })
  spendingTrend: DashboardSpendingTrendDto[];

  @ApiProperty({ type: [String] })
  insights: string[];
}
