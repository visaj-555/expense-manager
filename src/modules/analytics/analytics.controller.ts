import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { I18n, I18nContext } from 'nestjs-i18n';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { GetUser } from 'src/common/decorators/get-user';
import { MonthlyQueryDto, YearlyQueryDto } from './dto/payloads/analytics.query.dto';
import { CategoryAnalysisResponseDto, TrendAmountDto, CashflowTrendDto, TopExpenseDto } from './dto/analytics.response.dto';
import { ApiResponse } from 'src/common/common.exports';

@ApiTags('Analytics')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('monthly-category-analysis')
  @ApiOperation({ summary: 'Get monthly category analysis' })
  @ApiOkResponse({ type: CategoryAnalysisResponseDto })
  async getMonthlyCategoryAnalysis(
    @GetUser('userId') userId: string,
    @Query() query: MonthlyQueryDto,
    @I18n() i18n: I18nContext,
  ) {
    const data = await this.analyticsService.getMonthlyCategoryAnalysis(userId, query.month, query.year);
    return ApiResponse.success(data, i18n.t('analytics.success.monthlyCategoryAnalysisFetched'));
  }

  @Get('yearly-category-analysis')
  @ApiOperation({ summary: 'Get yearly category analysis' })
  @ApiOkResponse({ type: CategoryAnalysisResponseDto })
  async getYearlyCategoryAnalysis(
    @GetUser('userId') userId: string,
    @Query() query: YearlyQueryDto,
    @I18n() i18n: I18nContext,
  ) {
    const data = await this.analyticsService.getYearlyCategoryAnalysis(userId, query.year);
    return ApiResponse.success(data, i18n.t('analytics.success.yearlyCategoryAnalysisFetched'));
  }

  @Get('category-trend/:categoryId')
  @ApiOperation({ summary: 'Get category trend (Trailing 6 months)' })
  @ApiOkResponse({ type: [TrendAmountDto] })
  async getCategoryTrend(
    @GetUser('userId') userId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @I18n() i18n: I18nContext,
  ) {
    const data = await this.analyticsService.getCategoryTrend(userId, categoryId);
    return ApiResponse.success(data, i18n.t('analytics.success.categoryTrendFetched'));
  }

  @Get('cashflow-trend')
  @ApiOperation({ summary: 'Get cashflow trend (Trailing 6 months)' })
  @ApiOkResponse({ type: [CashflowTrendDto] })
  async getCashflowTrend(
    @GetUser('userId') userId: string,
    @I18n() i18n: I18nContext,
  ) {
    const data = await this.analyticsService.getCashflowTrend(userId);
    return ApiResponse.success(data, i18n.t('analytics.success.cashflowTrendFetched'));
  }

  @Get('top-expenses')
  @ApiOperation({ summary: 'Get top 10 expenses' })
  @ApiOkResponse({ type: [TopExpenseDto] })
  async getTopExpenses(
    @GetUser('userId') userId: string,
    @I18n() i18n: I18nContext,
  ) {
    const data = await this.analyticsService.getTopExpenses(userId);
    return ApiResponse.success(data, i18n.t('analytics.success.topExpensesFetched'));
  }
}
