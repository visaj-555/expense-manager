import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class TransferAccountDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;
}

export class TransferResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ format: 'uuid' })
  fromAccountId: string;

  @ApiProperty({ format: 'uuid' })
  toAccountId: string;

  @ApiProperty()
  amount: number;

  @ApiPropertyOptional()
  note: string | null;

  @ApiProperty({ format: 'date-time' })
  transferDate: Date;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiPropertyOptional({ type: () => TransferAccountDto })
  fromAccount?: TransferAccountDto;

  @ApiPropertyOptional({ type: () => TransferAccountDto })
  toAccount?: TransferAccountDto;
}
