import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from 'src/generated/prisma/enums';

export class RegisterDto {
  @ApiProperty({
    example: 'John',
    description: 'User first name',
    minLength: 2,
    maxLength: 30,
  })
  @IsString({ message: 'auth.validation.first_name_string' })
  @IsNotEmpty({ message: 'auth.validation.first_name_required' })
  @MinLength(2, {
    message: 'auth.validation.first_name_min_length',
  })
  @MaxLength(30, {
    message: 'auth.validation.first_name_max_length',
  })
  name: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsNotEmpty({ message: 'auth.validation.email_required' })
  @IsEmail({}, { message: 'auth.validation.invalid_email' })
  email: string;

  @ApiProperty({
    example: 'Test@123',
    description: 'User password',
    minLength: 8,
    maxLength: 20,
  })
  @IsString({ message: 'auth.validation.password_string' })
  @IsNotEmpty({ message: 'auth.validation.password_required' })
  @MinLength(8, {
    message: 'auth.validation.password_min_length',
  })
  @MaxLength(20, {
    message: 'auth.validation.password_max_length',
  })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
    {
      message: 'auth.validation.password_pattern',
    },
  )
  password: string;

  @IsOptional()
  @IsEnum(Role, {
    message: 'auth.validation.invalid_role',
  })
  role?: Role;
}
