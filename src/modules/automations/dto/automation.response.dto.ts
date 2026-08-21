import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PaymentMethod,
  RecurringFrequency,
  TransactionType,
} from 'src/generated/prisma/client';

export class AutomationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty() title: string;
  @ApiProperty() amount: number;
  @ApiProperty({ enum: TransactionType }) type: TransactionType;
  @ApiProperty({ enum: PaymentMethod }) paymentMethod: PaymentMethod;
  @ApiProperty({ enum: RecurringFrequency }) frequency: RecurringFrequency;
  @ApiProperty() startDate: Date;
  @ApiPropertyOptional() endDate: Date | null;
  @ApiPropertyOptional() lastProcessed: Date | null;
  @ApiProperty() nextRunDate: Date;
  @ApiProperty() isActive: boolean;
  @ApiPropertyOptional() notes: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty()
  account: { id: string; name: string; type: string };
  @ApiPropertyOptional()
  category: { id: string; name: string; icon: string | null; color: string | null } | null;
}
