import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Account email address',
    example: 'user@example.com',
  })
  @IsNotEmpty({
    message: 'auth.validation.email_required',
  })
  @IsEmail(
    {},
    {
      message: 'auth.validation.invalid_email',
    },
  )
  email: string;
}
