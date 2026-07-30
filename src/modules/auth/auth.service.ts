import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from 'src/common/mail/mail.service';
import { PrismaService } from 'src/common/database/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  TooManyRequestsException,
  UnauthorizedException,
} from 'src/common/exceptions';
import { generateOtp, hashOtp, verifyOtpHash } from 'src/common/helpers/otp';
import {
  ResendOtpDto,
  VerifyForgotOtpDto,
  VerifyOtpDto,
} from './dto/payloads/otp.dto';
import { TokenService } from './token.service';
import { LoginDto } from './dto/payloads/login.dto';
import { AuthPublic } from './interfaces/auth.interface';
import { LoginDataDto } from './dto/responses/login-data.dto';
import {
  ChangePasswordDto,
  ResetPasswordDto,
} from './dto/payloads/password.dto';
import { RedisService } from '../redis/redis.service';
import { RegisterDto } from './dto/payloads/register.dto';
import * as bcrypt from 'bcrypt';
import { Role } from 'src/generated/prisma/enums';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly tokenService: TokenService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) { }

  // ============== REGISTER ============== //

  async create(dto: RegisterDto): Promise<AuthPublic> {
    // ------------ CHECK EXISTING AUTH ------------ //

    const existingAuth = await this.prisma.auth.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        refreshToken: true,
        refreshTokenExp: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // ------------ verify AUTH ------------ //
    if (existingAuth?.isEmailVerified) {
      throw new ConflictException('auth.errors.emailAlreadyExists');
    }

    // -----------3. UNVERIFIED ACCOUNT → RESEND OTP (rate-limited) -------------- //

    if (existingAuth && !existingAuth.isEmailVerified) {
      const recentOtp = await this.prisma.otp.findFirst({
        where: {
          authId: existingAuth.id,
          otpType: 'EMAIL_VERIFICATION',
          createdAt: { gte: new Date(Date.now() - 60 * 1000) },
        },
      });

      if (recentOtp) {
        throw new TooManyRequestsException('auth.errors.otpRateLimitExceeded');
      }

      const otp = generateOtp();
      const otpHash = await hashOtp(otp);

      await this.prisma.$transaction(async (tx) => {
        await tx.otp.deleteMany({
          where: { authId: existingAuth.id, otpType: 'EMAIL_VERIFICATION' },
        });

        await tx.otp.create({
          data: {
            email: existingAuth.email,
            authId: existingAuth.id,
            codeHash: otpHash,
            otpType: 'EMAIL_VERIFICATION',
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          },
        });
      });

      await this.mailService.sendOtp(existingAuth.email, otp);

      return existingAuth;
    }

    // -----------4. FRESH REGISTRATION -------------- //

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);

    const auth = await this.prisma.$transaction(async (tx) => {

      // Create auth record
      const authRecord = await tx.auth.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          role: dto.role ?? Role.USER,
          isActive: true,
          isEmailVerified: false,
        },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          refreshToken: true,
          refreshTokenExp: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Create user profile
      await tx.user.create({
        data: {
          authId: authRecord.id,
          name: dto.name,
        },
      });

      // Persist OTP hash only — plain OTP never stored
      await tx.otp.create({
        data: {
          email: authRecord.email,
          authId: authRecord.id,
          codeHash: otpHash,
          otpType: 'EMAIL_VERIFICATION',
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      return authRecord;
    });

    await this.mailService.sendOtp(auth.email, otp);

    return auth;
  }

  // ============== VERIFY OTP ============== //

  async verifyOtp(dto: VerifyOtpDto): Promise<void> {
    // ------------ FIND AUTH ------------ //
    const auth = await this.prisma.auth.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        refreshToken: true,
        refreshTokenExp: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!auth) {
      throw new NotFoundException(
        'ACCOUNT_NOT_FOUND',
        'common.errors.notFound',
      );
    }

    // ------------ FIND OTP ------------ //
    const otpRecord = await this.prisma.otp.findFirst({
      where: {
        email: dto.email,
        otpType: 'EMAIL_VERIFICATION',
        verifiedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException('INVALID_OTP', 'auth.otp.invalid');
    }

    // ------------ CHECK EXPIRY ------------ //
    if (otpRecord.expiresAt < new Date()) {
      throw new BadRequestException('OTP_EXPIRED', 'auth.otp.expired');
    }

    // ------------ CHECK ATTEMPTS ------------ //
    if (otpRecord.attempts >= 5) {
      throw new BadRequestException(
        'OTP_ATTEMPTS_EXCEEDED',
        'auth.errors.otpTooManyAttempts',
      );
    }

    // ------------ VERIFY OTP ------------ //
    const isValidOtp = await verifyOtpHash(dto.otp, otpRecord.codeHash);

    if (!isValidOtp) {
      await this.prisma.otp.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });

      throw new BadRequestException('INVALID_OTP', 'auth.otp.invalid');
    }

    // ------------ MARK OTP VERIFIED ------------ //
    await this.prisma.otp.update({
      where: { id: otpRecord.id },
      data: { verifiedAt: new Date() },
    });

    // ------------ ACTIVATE ACCOUNT ------------ //
    await this.prisma.auth.update({
      where: { id: auth.id },
      data: {
        isActive: true,
        isEmailVerified: true,
      },
    });
  }

  // ============== RESEND OTP ============== //

  async resendOtp(dto: ResendOtpDto): Promise<void> {
    const normalizedEmail = dto.email.toLowerCase();

    // ------------ FIND AUTH ------------ //
    const auth = await this.prisma.auth.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true },
    });

    if (!auth) {
      throw new NotFoundException(
        'ACCOUNT_NOT_FOUND',
        'common.errors.notFound',
      );
    }

    // ------------ GENERATE OTP ------------ //
    const otp = generateOtp();
    console.log(
      `[RESEND OTP GENERATED] Email: ${normalizedEmail}, OTP: ${otp}, Type: ${dto.otpType}`,
    );
    const otpHash = await hashOtp(otp);

    await this.prisma.$transaction(async (tx) => {
      await tx.otp.deleteMany({
        where: {
          authId: auth.id,
          otpType: dto.otpType,
        },
      });

      await tx.otp.create({
        data: {
          email: normalizedEmail,
          authId: auth.id,
          codeHash: otpHash,
          otpType: dto.otpType,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });
    });

    // ------------ SEND OTP EMAIL ------------ //
    if (dto.otpType === 'EMAIL_VERIFICATION') {
      await this.mailService.sendOtp(normalizedEmail, otp);
    } else if (dto.otpType === 'FORGOT_PASSWORD') {
      await this.mailService.sendForgotPasswordOtp(normalizedEmail, otp);
    }
  }

  // ============== LOGIN ============== //

  async login(dto: LoginDto): Promise<LoginDataDto> {
    // ------------ FIND USER BY EMAIL ------------ //
    const normalizedEmail = dto.email.toLowerCase();

    const auth = await this.prisma.auth.findUnique({
      where: { email: normalizedEmail },

      include: {
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!auth) {
      throw new NotFoundException(
        'ACCOUNT_NOT_FOUND',
        'common.errors.notFound',
      );
    }

    if (!auth?.user) {
      throw new NotFoundException('USER_NOT_FOUND', 'common.errors.notFound');
    }

    // ------------ CHECK ACCOUNT ACTIVE ------------ //
    if (!auth.isActive) {
      throw new UnauthorizedException(
        'ACCOUNT_NOT_ACTIVE',
        'auth.errors.inactive',
      );
    }

    // ------------ RESTRICT ADMIN SIGN IN ------------ //
    if (auth.role === Role.ADMIN) {
      throw new ForbiddenException(
        'ADMIN_LOGIN_RESTRICTED',
        'auth.errors.adminLoginRestricted',
      );
    }

    // ------------ VERIFY PASSWORD ------------ //
    const isPasswordValid = await verifyOtpHash(
      dto.password,
      auth.password || '',
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'INVALID_CREDENTIALS',
        'auth.errors.invalidCredentials',
      );
    }

    // ------------ GENERATE TOKENS ------------ //
    const accessToken = this.tokenService.generateAccessToken({
      authId: auth.id,
      role: auth.role,
      userId: auth.user.id,
    });

    const refreshToken = this.tokenService.generateRefreshToken({
      authId: auth.id,
      role: auth.role,
      userId: auth.user.id,
    });

    // ------------ STORE REFRESH TOKEN IN REDIS ------------ //
    const refreshTokenKey = `refreshToken:${auth.id}`;
    const refreshTokenTTL = this.configService.get<number>(
      'JWT_REFRESH_TTL_SECONDS',
    );

    await this.redisService.set(
      refreshTokenKey,
      refreshToken,
      Number(refreshTokenTTL),
    );

    // ------------ RETURN RESPONSE ------------ //
    return {
      accessToken,
      refreshToken,
      id: auth.id,
      userId: auth.user.id,
    };
  }

  // ============== REFRESH ACCESS TOKEN ============== //

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!refreshToken) {
      throw new UnauthorizedException(
        'INVALID_REFRESH_TOKEN',
        'auth.errors.invalidRefreshToken',
      );
    }

    // ------------ VERIFY REFRESH TOKEN ------------ //
    let payload: { authId: string; role: string };

    try {
      payload = this.tokenService.verifyRefreshToken(refreshToken);
    } catch (_error) {
      throw new UnauthorizedException(
        'INVALID_REFRESH_TOKEN',
        'auth.errors.invalidRefreshToken',
      );
    }

    if (!payload?.authId) {
      throw new UnauthorizedException(
        'INVALID_REFRESH_TOKEN',
        'auth.errors.invalidRefreshToken',
      );
    }

    // ------------ FIND AUTH ------------ //
    const auth = await this.prisma.auth.findUnique({
      where: {
        id: payload.authId,
        isActive: true,
      },

      include: {
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!auth || !auth.user) {
      throw new UnauthorizedException(
        'INVALID_REFRESH_TOKEN',
        'auth.errors.invalidRefreshToken',
      );
    }

    const userId = auth.user.id;

    // ------------ VALIDATE AGAINST REDIS ------------ //
    const refreshTokenKey = `refreshToken:${payload.authId}`;
    const storedToken = await this.redisService.get(refreshTokenKey);

    if (!storedToken || storedToken !== refreshToken) {
      throw new UnauthorizedException(
        'INVALID_REFRESH_TOKEN',
        'auth.errors.invalidRefreshToken',
      );
    }

    // ------------ GENERATE NEW TOKENS ------------ //
    const newAccessToken = this.tokenService.generateAccessToken({
      authId: auth.id,
      role: auth.role,
      userId,
    });

    const newRefreshToken = this.tokenService.generateRefreshToken({
      authId: auth.id,
      role: auth.role,
      userId,
    });

    const refreshTokenTTL = this.configService.get<number>(
      'JWT_REFRESH_TTL_SECONDS',
    );

    await this.redisService.set(
      refreshTokenKey,
      newRefreshToken,
      Number(refreshTokenTTL),
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  // ============== FORGOT PASSWORD ============== //

  async forgotPassword(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();

    const auth = await this.prisma.auth.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true },
    });

    if (!auth) {
      throw new NotFoundException(
        'ACCOUNT_NOT_FOUND',
        'auth.errors.accountNotFound',
      );
    }

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);

    await this.prisma.otp.create({
      data: {
        email: normalizedEmail,
        authId: auth.id,
        codeHash: otpHash,
        otpType: 'FORGOT_PASSWORD',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    await this.mailService.sendForgotPasswordOtp(normalizedEmail, otp);
  }

  // ============== VERIFY FORGOT PASSWORD OTP ============== //

  async verifyForgotPasswordOtp(
    dto: VerifyForgotOtpDto,
  ): Promise<{ resetToken: string }> {
    const normalizedEmail = dto.email.toLowerCase();
    console.log(
      `[FORGOT PASSWORD VERIFY] Email: ${normalizedEmail}, OTP: ${dto.otp}`,
    );

    // ------------ FIND OTP RECORD ------------ //
    const otpRecord = await this.prisma.otp.findFirst({
      where: {
        email: normalizedEmail,
        otpType: 'FORGOT_PASSWORD',
        verifiedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException('INVALID_OTP', 'auth.otp.invalid');
    }

    // ------------ CHECK OTP EXPIRY ------------ //
    if (otpRecord.expiresAt < new Date()) {
      throw new BadRequestException('OTP_EXPIRED', 'auth.otp.expired');
    }

    // ------------ CHECK ATTEMPTS ------------ //
    if (otpRecord.attempts >= 5) {
      throw new BadRequestException(
        'OTP_ATTEMPTS_EXCEEDED',
        'auth.errors.otpTooManyAttempts',
      );
    }

    // ------------ VERIFY OTP ------------ //
    const isValidOtp = await verifyOtpHash(dto.otp, otpRecord.codeHash);
    console.log(
      `[FORGOT PASSWORD VERIFY] Hash comparison result: ${isValidOtp}`,
    );

    if (!isValidOtp) {
      await this.prisma.otp.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });

      throw new BadRequestException('INVALID_OTP', 'auth.otp.invalid');
    }

    // ------------ MARK OTP AS VERIFIED ------------ //
    await this.prisma.otp.update({
      where: { id: otpRecord.id },
      data: { verifiedAt: new Date() },
    });

    // ------------ FIND AUTH ACCOUNT ------------ //
    const auth = await this.prisma.auth.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (!auth) {
      throw new NotFoundException(
        'ACCOUNT_NOT_FOUND',
        'common.errors.notFound',
      );
    }

    // ------------ GENERATE RESET TOKEN ------------ //
    const resetToken = this.tokenService.generateResetPasswordToken({
      id: auth.id,
      type: 'RESET_PASSWORD',
    });

    return { resetToken };
  }

  // ============== RESET PASSWORD ============== //

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    let tokenPayload: { id: string; type: string };
    try {
      tokenPayload = this.tokenService.verifyResetPasswordToken(dto.resetToken);
    } catch (_error) {
      throw new UnauthorizedException(
        'INVALID_RESET_TOKEN',
        'auth.errors.invalidResetToken',
      );
    }

    // ------------ FIND ACCOUNT ------------ //
    const auth = await this.prisma.auth.findUnique({
      where: { id: tokenPayload.id },
      select: { id: true, email: true },
    });

    if (!auth) {
      throw new NotFoundException(
        'ACCOUNT_NOT_FOUND',
        'common.errors.notFound',
      );
    }

    // ------------ HASH & UPDATE PASSWORD ------------ //
    const hashedPassword = await hashOtp(dto.newPassword);

    await this.prisma.auth.update({
      where: { id: auth.id },
      data: { password: hashedPassword },
    });

    const refreshTokenKey = `refreshToken:${auth.id}`;
    await this.redisService.del(refreshTokenKey);

    await this.mailService.passwordUpdateSuccessfully(auth.email);
  }

  // ============== CHANGE PASSWORD ============== //

  async changePassword(authId: string, dto: ChangePasswordDto): Promise<void> {
    const auth = await this.prisma.auth.findUnique({
      where: { id: authId },
      select: { id: true, email: true, password: true },
    });

    if (!auth) {
      throw new NotFoundException(
        'ACCOUNT_NOT_FOUND',
        'common.errors.notFound',
      );
    }

    const isCurrentValid = await verifyOtpHash(
      dto.currentPassword,
      auth.password || '',
    );

    if (!isCurrentValid) {
      throw new UnauthorizedException(
        'INVALID_CURRENT_PASSWORD',
        'auth.errors.invalidCurrentPassword',
      );
    }

    const isSamePassword = await verifyOtpHash(
      dto.newPassword,
      auth.password || '',
    );

    if (isSamePassword) {
      throw new BadRequestException(
        'PASSWORD_SAME_AS_OLD',
        'auth.errors.passwordSameAsOld',
      );
    }

    const hashedPassword = await hashOtp(dto.newPassword);

    await this.prisma.auth.update({
      where: { id: authId },
      data: { password: hashedPassword },
    });

    const refreshTokenKey = `refreshToken:${authId}`;
    await this.redisService.del(refreshTokenKey);

    await this.mailService.passwordUpdateSuccessfully(auth.email);
  }

  // ============== VERIFY TOKEN ============== //

  async verifyToken(authId: string) {
    // ------------ FIND AUTH ------------ //
    const auth = await this.prisma.auth.findUnique({
      where: { id: authId },
      select: {
        id: true,
        email: true,
        role: true,
        isEmailVerified: true,
        isActive: true,
      },
    });

    if (!auth) {
      throw new NotFoundException('ACCOUNT_NOT_FOUND', 'errors.notFound');
    }

    // ------------ GET NAME BASED ON ROLE ------------ //
    let name: string | null = null;

    if (auth.role === Role.USER) {
      const user = await this.prisma.user.findUnique({
        where: { authId },
        select: {
          name: true,
        },
      });
      name = user?.name || null;
    }

    return {
      id: auth.id,
      name: name ?? '',
      email: auth.email,
      role: auth.role,
    };
  }
}
