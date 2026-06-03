import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorDto {
  @ApiPropertyOptional({
    description: 'Application-specific error code',
    example: 'EMAIL_EXISTS',
  })
  code?: string;

  @ApiPropertyOptional({
    description: 'Additional error details',
  })
  details?: unknown;
}
