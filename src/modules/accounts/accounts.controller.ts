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
import { AccountsService } from './accounts.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { AccountResponseDto } from './dto/account.response.dto';
import { GetUser } from 'src/common/decorators/get-user';
import {
  CreateAccountDto,
  UpdateAccountDto,
  AccountQueryDto,
} from './dto/payloads/account.dto';
import { ApiResponse } from 'src/common/common.exports';

@ApiTags('Accounts')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) { }

  @Post()
  @ApiOperation({ summary: 'Create a new account' })
  @ApiCreatedResponse({ type: AccountResponseDto })
  async create(
    @GetUser('userId') userId: string,
    @Body() dto: CreateAccountDto,
    @I18n() i18n: I18nContext,
  ) {
    const account = await this.accountsService.create(userId, dto);
    return ApiResponse.created(account, i18n.t('accounts.success.created'));
  }

  @Get()
  @ApiOperation({ summary: 'Get all accounts (paginated + filtered)' })
  @ApiOkResponse({ type: [AccountResponseDto] })
  async findAll(
    @GetUser('userId') userId: string,
    @Query() query: AccountQueryDto,
    @I18n() i18n: I18nContext,
  ) {
    const result = await this.accountsService.findAll(userId, query);
    return ApiResponse.success(result, i18n.t('accounts.success.fetched'));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single account by ID' })
  @ApiOkResponse({ type: AccountResponseDto })
  async findOne(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @I18n() i18n: I18nContext,
  ) {
    const account = await this.accountsService.findOne(userId, id);
    return ApiResponse.success(account, i18n.t('accounts.success.fetched'));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an account' })
  @ApiOkResponse({ type: AccountResponseDto })
  async update(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
    @I18n() i18n: I18nContext,
  ) {
    const account = await this.accountsService.update(userId, id, dto);
    return ApiResponse.success(account, i18n.t('accounts.success.updated'));
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive (soft-delete) an account' })
  @ApiOkResponse({ type: AccountResponseDto })
  async archive(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @I18n() i18n: I18nContext,
  ) {
    const account = await this.accountsService.archive(userId, id);
    return ApiResponse.success(account, i18n.t('accounts.success.archived'));
  }

  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restore an archived account' })
  @ApiOkResponse({ type: AccountResponseDto })
  async restore(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @I18n() i18n: I18nContext,
  ) {
    const account = await this.accountsService.restore(userId, id);
    return ApiResponse.success(account, i18n.t('accounts.success.restored'));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Permanently delete an account (blocked if transactions exist)' })
  @ApiOkResponse({ type: AccountResponseDto })
  async remove(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @I18n() i18n: I18nContext,
  ) {
    const account = await this.accountsService.remove(userId, id);
    return ApiResponse.success(account, i18n.t('accounts.success.deleted'));
  }
}