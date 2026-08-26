import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { I18n, I18nContext } from 'nestjs-i18n';
import { ApiResponse } from 'src/common/common.exports';
import { GetUser } from 'src/common/decorators/get-user';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { ExportQueryDto } from './dto/export.query.dto';
import { ExportPayloadDto } from './dto/export.response.dto';
import { ExportService } from './export.service';

@ApiTags('Export')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get()
  @ApiOperation({
    summary: 'Export finance data for a month, a year, or everything',
  })
  @ApiOkResponse({ type: ExportPayloadDto })
  async export(
    @GetUser('userId') userId: string,
    @Query() query: ExportQueryDto,
    @I18n() i18n: I18nContext,
  ) {
    const data = await this.exportService.build(userId, query);
    return ApiResponse.success(data, i18n.t('export.success.fetched'));
  }
}
