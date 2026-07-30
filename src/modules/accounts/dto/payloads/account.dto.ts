import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { AccountType } from 'src/generated/prisma/client';
import { PaginationDto } from 'src/common/common.exports';
import { i18nValidationMessage } from 'nestjs-i18n';
import { ToBooleanQuery } from 'src/common/helpers/to-boolean-query';

export class CreateAccountDto {
 @IsString({
  message: i18nValidationMessage('accounts.validation.name_string'),
})
@IsNotEmpty({
  message: i18nValidationMessage('accounts.validation.name_required'),
})
name: string;

    @IsEnum(AccountType, {
  message: i18nValidationMessage('accounts.validation.invalid_type'),
})
type: AccountType;

@IsNumber({}, {
  message: i18nValidationMessage('accounts.validation.opening_balance_number'),
})
@Min(0, {
  message: i18nValidationMessage('accounts.validation.opening_balance_min'),
})
openingBalance: number;
}

export class UpdateAccountDto {
  @ApiPropertyOptional({ example: 'Updated Name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: AccountType })
  @IsEnum(AccountType)
  @IsOptional()
  type?: AccountType;

  @ApiPropertyOptional({ example: 500.00 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  openingBalance?: number;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isArchived?: boolean;
}

export class AccountQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: AccountType, description: 'Filter by account type' })
  @IsOptional()
  @IsEnum(AccountType)
  type?: AccountType;
 
  @ApiPropertyOptional({ example: false, description: 'Filter archived accounts' })
  @IsOptional()
  @ToBooleanQuery(false)
  @IsBoolean()
  isArchived?: boolean = false;
 
  @ApiPropertyOptional({ example: 'hdfc', description: 'Search by account name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
 
  @ApiPropertyOptional({
    enum: ['name', 'createdAt', 'updatedAt'],
    default: 'createdAt',
    description: 'Field to sort by',
  })
  @IsOptional()
  @IsEnum(['name', 'createdAt', 'updatedAt'])
  orderBy?: 'name' | 'createdAt' | 'updatedAt' = 'createdAt';
 
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}