import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { AutomationsModule } from '../automations/automations.module';

@Module({
  imports: [AutomationsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
