import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryType } from 'src/generated/prisma/enums';

export class CategoryResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  userId: string;

  @ApiProperty({ example: 'Food & Dining' })
  name: string;

  @ApiProperty({ enum: CategoryType, example: CategoryType.EXPENSE })
  type: CategoryType;

  @ApiPropertyOptional({ example: '🍔' })
  icon: string | null;

  @ApiPropertyOptional({ example: '#FF5733' })
  color: string | null;

  @ApiProperty({ example: false })
  isArchived: boolean;

  @ApiProperty({ example: 42 })
  transactionCount: number;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;
}