import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsBoolean,
    MaxLength,
} from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CategoryType } from 'src/generated/prisma/enums';
import { i18nValidationMessage } from 'nestjs-i18n';
import { ToBooleanQuery } from 'src/common/helpers/to-boolean-query';

// ─── Create ───────────────────────────────────────────────────────────────────

export class CreateCategoryDto {
    @ApiProperty({ example: 'Food & Dining' })
    @IsNotEmpty({
        message: i18nValidationMessage('categories.validation.name_required'),
    })
    @IsString({
        message: i18nValidationMessage('categories.validation.name_string'),
    })
    @MaxLength(100, {
        message: i18nValidationMessage('categories.validation.name_max_length'),
    })
    name: string;

    @IsEnum(CategoryType, {
        message: i18nValidationMessage('categories.validation.invalid_type'),
    })
    type: CategoryType;

    @ApiPropertyOptional({ example: '🍔' })
    @IsOptional()
    @IsString()
    @MaxLength(10)
    icon?: string;

    @ApiPropertyOptional({ example: '#FF5733' })
    @IsOptional()
    @IsString()
    @MaxLength(7)
    color?: string;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) { }

// ─── Query / Filters ──────────────────────────────────────────────────────────

export class CategoryQueryDto extends PaginationDto {
    @ApiPropertyOptional({ enum: CategoryType, description: 'Filter by category type' })
    @IsOptional()
    @IsEnum(CategoryType)
    type?: CategoryType;

    @ApiPropertyOptional({ example: false, description: 'Filter archived categories' })
    @IsOptional()
    @ToBooleanQuery(false)
    @IsBoolean({
        message: i18nValidationMessage('categories.validation.is_archived_boolean'),
    })
    isArchived?: boolean = false;

    @ApiPropertyOptional({ example: 'food', description: 'Search by category name' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    search?: string;

    @ApiPropertyOptional({
        enum: ['name', 'createdAt'],
        default: 'createdAt',
        description: 'Field to sort by',
    })
    @IsOptional()
    @IsEnum(['name', 'createdAt'])
    orderBy?: 'name' | 'createdAt' = 'createdAt';

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
    @IsOptional()
    @IsEnum(['asc', 'desc'])
    order?: 'asc' | 'desc' = 'asc';
}