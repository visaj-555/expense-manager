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
import { GoalsService } from './goals.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { GoalResponseDto } from './dto/goal.response.dto';
import { GetUser } from 'src/common/decorators/get-user';
import { CreateGoalDto, GoalQueryDto, UpdateGoalDto } from './dto/payloads/goal.dto';
import { ApiResponse } from 'src/common/common.exports';

@ApiTags('Goals')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new goal' })
  @ApiCreatedResponse({ type: GoalResponseDto })
  async create(
    @GetUser('userId') userId: string,
    @Body() dto: CreateGoalDto,
    @I18n() i18n: I18nContext,
  ) {
    const goal = await this.goalsService.create(userId, dto);
    return ApiResponse.created(goal, i18n.t('goals.success.created'));
  }

  @Get()
  @ApiOperation({ summary: 'Get all goals of the logged-in user' })
  @ApiOkResponse({ type: [GoalResponseDto] })
  async findAll(
    @GetUser('userId') userId: string,
    @Query() query: GoalQueryDto,
    @I18n() i18n: I18nContext,
  ) {
    const result = await this.goalsService.findAll(userId, query);
    return ApiResponse.success(result, i18n.t('goals.success.fetched'));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single goal by ID' })
  @ApiOkResponse({ type: GoalResponseDto })
  async findOne(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @I18n() i18n: I18nContext,
  ) {
    const goal = await this.goalsService.findOne(userId, id);
    return ApiResponse.success(goal, i18n.t('goals.success.fetched'));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a goal' })
  @ApiOkResponse({ type: GoalResponseDto })
  async update(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGoalDto,
    @I18n() i18n: I18nContext,
  ) {
    const goal = await this.goalsService.update(userId, id, dto);
    return ApiResponse.success(goal, i18n.t('goals.success.updated'));
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Mark a goal as completed' })
  @ApiOkResponse({ type: GoalResponseDto })
  async complete(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @I18n() i18n: I18nContext,
  ) {
    const goal = await this.goalsService.complete(userId, id);
    return ApiResponse.success(goal, i18n.t('goals.success.completed'));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a goal' })
  @ApiOkResponse({ type: GoalResponseDto })
  async remove(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @I18n() i18n: I18nContext,
  ) {
    const goal = await this.goalsService.remove(userId, id);
    return ApiResponse.success(goal, i18n.t('goals.success.deleted'));
  }
}
