import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { SalesforceModule } from './salesforce/salesforce.module';
import { CasesModule } from './cases/cases.module';
import { InsightsModule } from './insights/insights.module';
import { SyncModule } from './sync/sync.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    SalesforceModule,
    CasesModule,
    InsightsModule,
    SyncModule,
    HealthModule,
  ],
})
export class AppModule {}
