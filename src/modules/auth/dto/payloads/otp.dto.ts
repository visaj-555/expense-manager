// src/modules/auth/dto/verify-otp.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsString, Length } from 'class-validator';
import { OtpType } from 'src/generated/prisma/enums';

export class VerifyOtpDto {
  @ApiProperty({
    example: 'visaj.cilans@gmail.com',
    description: 'Registered email address',
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

  @ApiProperty({
    example: '123456',
    description: 'OTP received via email',
  })
  @IsNotEmpty({
    message: 'auth.validation.otp_required',
  })
  @IsString({
    message: 'auth.validation.otp_string',
  })
  @Length(6, 6, {
    message: 'auth.validation.otp_length',
  })
  otp: string;
}

export class VerifyForgotOtpDto {
  @ApiProperty({
    description: 'Registered email address',
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

  @ApiProperty({
    description: '6 digit OTP sent to email',
    example: '123456',
  })
  @IsNotEmpty({
    message: 'auth.validation.otp_required',
  })
  @IsString({
    message: 'auth.validation.otp_string',
  })
  @Length(6, 6, {
    message: 'auth.validation.otp_length',
  })
  otp: string;
}

export class ResendOtpDto {
  @ApiProperty({
    example: 'visaj.cilans@gmail.com',
    description: 'Registered email address',
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

  @ApiProperty({
    enum: OtpType,
    example: 'EMAIL_VERIFICATION',
    description: 'Type of OTP to resend',
  })
  @IsNotEmpty({
    message: 'auth.validation.otp_type_required',
  })
  @IsEnum(OtpType, {
    message: 'auth.validation.invalid_otp_type',
  })
  otpType: OtpType;
}
