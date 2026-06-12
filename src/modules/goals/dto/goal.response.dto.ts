import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GoalResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  targetAmount: number;

  @ApiProperty()
  currentAmount: number;

  @ApiPropertyOptional({ format: 'date-time' })
  targetDate: Date | null;

  @ApiProperty({ description: 'Progress percentage (0-100)', example: 25 })
  progress: number;

  @ApiProperty({ enum: ['COMPLETED', 'IN_PROGRESS'] })
  status: 'COMPLETED' | 'IN_PROGRESS';

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}
