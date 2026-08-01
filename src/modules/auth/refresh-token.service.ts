import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/common/database/prisma.service';

export type PersistRefreshTokenInput = {
  authId: string;
  refreshToken: string;
  userAgent?: string;
  ipAddress?: string;
  deviceLabel?: string;
  /** When rotating, revoke this prior row and link the chain */
  replaceTokenId?: string;
};

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /** Deterministic hash for indexed lookup (never store raw JWT). */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private ttlSeconds(): number {
    return Number(
      this.configService.get<number>('JWT_REFRESH_TTL_SECONDS') ?? 604800,
    );
  }

  private expiresAtFromNow(): Date {
    return new Date(Date.now() + this.ttlSeconds() * 1000);
  }

  async persist(input: PersistRefreshTokenInput) {
    const tokenHash = this.hashToken(input.refreshToken);
    const expiresAt = this.expiresAtFromNow();

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({
        data: {
          authId: input.authId,
          tokenHash,
          expiresAt,
          userAgent: input.userAgent,
          ipAddress: input.ipAddress,
          deviceLabel: input.deviceLabel,
        },
      });

      if (input.replaceTokenId) {
        await tx.refreshToken.update({
          where: { id: input.replaceTokenId },
          data: {
            revokedAt: new Date(),
            replacedById: created.id,
          },
        });
      }

      return created;
    });
  }

  async findValidByRawToken(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!record) return null;
    if (record.revokedAt) return null;
    if (record.expiresAt < new Date()) return null;

    return record;
  }

  async revokeAllForAuth(authId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { authId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeById(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }
}
