import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { I18n, I18nContext } from 'nestjs-i18n';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { GetUser } from 'src/common/decorators/get-user';
import { DashboardResponseDto } from './dto/dashboard.response.dto';
import { ApiResponse } from 'src/common/common.exports';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get comprehensive financial dashboard data' })
  @ApiOkResponse({ type: DashboardResponseDto })
  async getDashboard(
    @GetUser('userId') userId: string,
    @I18n() i18n: I18nContext,
  ) {
    const data = await this.dashboardService.getDashboard(userId);
    return ApiResponse.success(data, i18n.t('dashboard.success.fetched'));
  }
}
