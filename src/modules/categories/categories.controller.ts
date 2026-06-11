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
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { GetUser } from 'src/common/decorators/get-user';
import type { JwtPayload } from '../auth/interfaces/auth.interface';
import { ApiResponse } from 'src/common/common.exports';
import { CategoryQueryDto, CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CategoryResponseDto } from './dto/category.response.dto';

@ApiTags('Categories')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) { }

  @Post()
  @ApiOperation({ summary: 'Create a new category' })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  async create(
    @GetUser() user: JwtPayload,
    @Body() dto: CreateCategoryDto,
    @I18n() i18n: I18nContext,
  ) {
    const category = await this.categoriesService.create(user.userId, dto);
    return ApiResponse.created(category, i18n.t('categories.success.created'));
  }

  @Get()
  @ApiOperation({ summary: 'Get all categories (paginated + filtered)' })
  @ApiOkResponse({ type: [CategoryResponseDto] })
  async findAll(
    @GetUser('userId') userId: string,
    @Query() query: CategoryQueryDto,
    @I18n() i18n: I18nContext,
  ) {
    const result = await this.categoriesService.findAll(userId, query);
    return ApiResponse.success(result, i18n.t('categories.success.fetched'));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single category by ID' })
  @ApiOkResponse({ type: CategoryResponseDto })
  async findOne(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @I18n() i18n: I18nContext,
  ) {
    const category = await this.categoriesService.findOne(userId, id);
    return ApiResponse.success(category, i18n.t('categories.success.fetched'));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a category' })
  @ApiOkResponse({ type: CategoryResponseDto })
  async update(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
    @I18n() i18n: I18nContext,
  ) {
    const category = await this.categoriesService.update(userId, id, dto);
    return ApiResponse.success(category, i18n.t('categories.success.updated'));
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive (soft-delete) a category' })
  @ApiOkResponse({ type: CategoryResponseDto })
  async archive(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @I18n() i18n: I18nContext,
  ) {
    const category = await this.categoriesService.archive(userId, id);
    return ApiResponse.success(category, i18n.t('categories.success.archived'));
  }

  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restore an archived category' })
  @ApiOkResponse({ type: CategoryResponseDto })
  async restore(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @I18n() i18n: I18nContext,
  ) {
    const category = await this.categoriesService.restore(userId, id);
    return ApiResponse.success(category, i18n.t('categories.success.restored'));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Permanently delete a category (blocked if in use)' })
  @ApiOkResponse({ type: CategoryResponseDto })
  async remove(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @I18n() i18n: I18nContext,
  ) {
    const category = await this.categoriesService.remove(userId, id);
    return ApiResponse.success(category, i18n.t('categories.success.deleted'));
  }
}