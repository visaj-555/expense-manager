import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { CreateAccountDto, UpdateAccountDto } from './dto/payloads/account.dto';
import {
  ApiResponse,
  PaginationDto,
  PaginationMeta,
} from 'src/common/common.exports';


@ApiTags('Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new account' })
  @ApiCreatedResponse({ type: AccountResponseDto })
  async create(
    @GetUser('userId') userId: string,
    @Body() dto: CreateAccountDto,
    @I18n() i18n: I18nContext,
  ) {
    const account = await this.accountsService.create(userId, dto);
    return ApiResponse.created(account, i18n.t('accounts.created'));
  }

  @Get()
  @ApiOperation({ summary: 'Get all accounts for current user' })
  @ApiOkResponse({ type: [AccountResponseDto] })
  async findAll(
    @GetUser('userId') userId: string,
    @I18n() i18n: I18nContext,
  ) {
    const accounts = await this.accountsService.findAll(userId);
    return ApiResponse.success(accounts, i18n.t('accounts.fetched'));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single account by ID' })
  @ApiOkResponse({ type: AccountResponseDto })
  async findOne(
    @GetUser('userId') userId: string,
    @Param('id') id: string,
    @I18n() i18n: I18nContext,
  ) {
    const account = await this.accountsService.findOne(userId, id);
    return ApiResponse.success(account, i18n.t('accounts.fetched'));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an account' })
  @ApiOkResponse({ type: AccountResponseDto })
  async update(
    @GetUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
    @I18n() i18n: I18nContext,
  ) {
    const account = await this.accountsService.update(userId, id, dto);
    return ApiResponse.success(account, i18n.t('accounts.updated'));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an account' })
  @ApiOkResponse({ type: AccountResponseDto })
  async remove(
    @GetUser('userId') userId: string,
    @Param('id') id: string,
    @I18n() i18n: I18nContext,
  ) {
    const account = await this.accountsService.remove(userId, id);
    return ApiResponse.success(account, i18n.t('accounts.deleted'));
  }
}