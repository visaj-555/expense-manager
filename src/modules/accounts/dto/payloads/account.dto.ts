import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { AccountType } from 'src/generated/prisma/client';

export class CreateAccountDto {
    @ApiProperty({ example: 'My Bank Account' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ enum: AccountType })
    @IsEnum(AccountType)
    type: AccountType;

    @ApiProperty({ example: 1000.00 })
    @IsNumber()
    @Min(0)
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