import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { I18n, I18nContext } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { GetUser } from 'src/common/decorators/get-user';
import { ApiResponse } from 'src/common/common.exports';
import { AutomationsService } from './automations.service';
import { AutomationResponseDto } from './dto/automation.response.dto';
import {
  AutomationQueryDto,
  CreateAutomationDto,
  UpdateAutomationDto,
} from './dto/payloads/automation.dto';

@ApiTags('Automations')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('automations')
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a scheduled UPI / SIP deduction' })
  @ApiCreatedResponse({ type: AutomationResponseDto })
  async create(
    @GetUser('userId') userId: string,
    @Body() dto: CreateAutomationDto,
    @I18n() i18n: I18nContext,
  ) {
    const automation = await this.automationsService.create(userId, dto);
    return ApiResponse.created(automation, i18n.t('automations.success.created'));
  }

  @Get()
  @ApiOperation({ summary: 'List automations (also posts any due deductions)' })
  @ApiOkResponse({ type: [AutomationResponseDto] })
  async findAll(
    @GetUser('userId') userId: string,
    @Query() query: AutomationQueryDto,
    @I18n() i18n: I18nContext,
  ) {
    const result = await this.automationsService.findAll(userId, query);
    return ApiResponse.success(result, i18n.t('automations.success.fetched'));
  }

  @Post(':id/run')
  @ApiOperation({ summary: 'Post this automation if its deduction date is due' })
  @ApiOkResponse({ type: AutomationResponseDto })
  async run(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @I18n() i18n: I18nContext,
  ) {
    const automation = await this.automationsService.runDue(userId, id);
    return ApiResponse.success(automation, i18n.t('automations.success.processed'));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one automation' })
  @ApiOkResponse({ type: AutomationResponseDto })
  async findOne(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @I18n() i18n: I18nContext,
  ) {
    const automation = await this.automationsService.findOne(userId, id);
    return ApiResponse.success(automation, i18n.t('automations.success.fetched'));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update amount, date, category, or pause' })
  @ApiOkResponse({ type: AutomationResponseDto })
  async update(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAutomationDto,
    @I18n() i18n: I18nContext,
  ) {
    const automation = await this.automationsService.update(userId, id, dto);
    return ApiResponse.success(automation, i18n.t('automations.success.updated'));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an automation' })
  @ApiOkResponse({ type: AutomationResponseDto })
  async remove(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @I18n() i18n: I18nContext,
  ) {
    const automation = await this.automationsService.remove(userId, id);
    return ApiResponse.success(automation, i18n.t('automations.success.deleted'));
  }
}
