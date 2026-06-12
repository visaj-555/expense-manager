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
import { TransfersService } from './transfers.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { TransferResponseDto } from './dto/transfer.response.dto';
import { GetUser } from 'src/common/decorators/get-user';
import { CreateTransferDto, TransferQueryDto, UpdateTransferDto } from './dto/payloads/transfer.dto';
import { ApiResponse } from 'src/common/common.exports';

@ApiTags('Transfers')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) { }

  @Post()
  @ApiOperation({ summary: 'Create a new transfer' })
  @ApiCreatedResponse({ type: TransferResponseDto })
  async create(
    @GetUser('userId') userId: string,
    @Body() dto: CreateTransferDto,
    @I18n() i18n: I18nContext,
  ) {
    const transfer = await this.transfersService.create(userId, dto);
    return ApiResponse.created(transfer, i18n.t('transfer.success.created'));
  }

  @Get()
  @ApiOperation({ summary: 'Get all transfers (paginated + filtered)' })
  @ApiOkResponse({ type: [TransferResponseDto] })
  async findAll(
    @GetUser('userId') userId: string,
    @Query() query: TransferQueryDto,
    @I18n() i18n: I18nContext,
  ) {
    const result = await this.transfersService.findAll(userId, query);
    return ApiResponse.success(result, i18n.t('transfer.success.fetched'));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single transfer by ID' })
  @ApiOkResponse({ type: TransferResponseDto })
  async findOne(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @I18n() i18n: I18nContext,
  ) {
    const transfer = await this.transfersService.findOne(userId, id);
    return ApiResponse.success(transfer, i18n.t('transfer.success.fetched'));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a transfer' })
  @ApiOkResponse({ type: TransferResponseDto })
  async update(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransferDto,
    @I18n() i18n: I18nContext,
  ) {
    const transfer = await this.transfersService.update(userId, id, dto);
    return ApiResponse.success(transfer, i18n.t('transfer.success.updated'));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a transfer' })
  @ApiOkResponse({ type: TransferResponseDto })
  async remove(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @I18n() i18n: I18nContext,
  ) {
    const transfer = await this.transfersService.remove(userId, id);
    return ApiResponse.success(transfer, i18n.t('transfer.success.deleted'));
  }
}
