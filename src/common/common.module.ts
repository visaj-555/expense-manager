import { Global, Module } from '@nestjs/common';
import { MailService } from './mail/mail.service';
import { PrismaService } from './database/prisma.service';

@Global()
@Module({
  providers: [MailService, PrismaService],
  exports: [MailService, PrismaService],
})
export class CommonModule {}
