import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType, FdCompounding } from 'src/generated/prisma/client';

export class AccountFdDto {
  @ApiProperty() principal: number;
  @ApiProperty({ description: 'Annual interest rate %' }) interestRate: number;
  @ApiProperty() startDate: Date;
  @ApiProperty() tenureMonths: number;
  @ApiProperty({ enum: FdCompounding }) compounding: FdCompounding;
  @ApiProperty() maturityDate: Date;
  @ApiProperty() maturityValue: number;
  @ApiProperty() accruedInterest: number;
  @ApiProperty() daysElapsed: number;
  @ApiProperty() daysRemaining: number;
  @ApiProperty() totalDays: number;
  @ApiProperty() isMatured: boolean;
  @ApiProperty() progressPercent: number;
}

export class AccountResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: AccountType }) type: AccountType;
  @ApiProperty({
    description:
      'Computed live balance. For FD this is principal + interest accrued until today.',
  })
  currentBalance: number;
  @ApiProperty() transactionCount: number;
  @ApiProperty() isArchived: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional({ type: AccountFdDto, nullable: true })
  fd: AccountFdDto | null;
}
