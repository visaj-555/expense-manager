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
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { GetUser } from 'src/common/decorators/get-user';
import { ApiResponse } from 'src/common/common.exports';
import { TransactionResponseDto } from './dto/transaction.response.dto';
import { CreateTransactionDto, TransactionQueryDto, UpdateTransactionDto } from './dto/transaction.payload.dto';

@ApiTags('Transactions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new transaction' })
  @ApiCreatedResponse({ type: TransactionResponseDto })
  async create(
    @GetUser('userId') userId: string,
    @Body() dto: CreateTransactionDto,
    @I18n() i18n: I18nContext,
  ) {
    const transaction = await this.transactionsService.create(userId, dto);
    return ApiResponse.created(transaction, i18n.t('transactions.success.created'));
  }

  @Get()
  @ApiOperation({ summary: 'Get all transactions (paginated + filtered)' })
  @ApiOkResponse({ type: [TransactionResponseDto] })
  async findAll(
    @GetUser('userId') userId: string,
    @Query() query: TransactionQueryDto,
    @I18n() i18n: I18nContext,
  ) {
    const result = await this.transactionsService.findAll(userId, query);
    return ApiResponse.success(result, i18n.t('transactions.success.fetched'));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single transaction by ID' })
  @ApiOkResponse({ type: TransactionResponseDto })
  async findOne(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @I18n() i18n: I18nContext,
  ) {
    const transaction = await this.transactionsService.findOne(userId, id);
    return ApiResponse.success(transaction, i18n.t('transactions.success.fetched'));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a transaction' })
  @ApiOkResponse({ type: TransactionResponseDto })
  async update(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
    @I18n() i18n: I18nContext,
  ) {
    const transaction = await this.transactionsService.update(userId, id, dto);
    return ApiResponse.success(transaction, i18n.t('transactions.success.updated'));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a transaction' })
  @ApiOkResponse({ type: TransactionResponseDto })
  async remove(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @I18n() i18n: I18nContext,
  ) {
    const transaction = await this.transactionsService.remove(userId, id);
    return ApiResponse.success(transaction, i18n.t('transactions.success.deleted'));
  }
}