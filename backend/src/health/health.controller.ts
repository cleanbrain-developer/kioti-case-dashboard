import { Controller, Get } from '@nestjs/common';
import { SalesforceService } from '../salesforce/salesforce.service';
import { PrismaService } from '../prisma/prisma.service';
import { SyncService } from '../sync/sync.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly sf: SalesforceService,
    private readonly prisma: PrismaService,
    private readonly sync: SyncService,
  ) {}

  @Get()
  async check() {
    const dbOk     = await this.prisma.isAvailable();
    const lastSync = await this.prisma.getLastSync();
    const caseCount = dbOk ? await this.prisma.getCaseCount() : null;

    if (!this.sf.isConfigured()) {
      return { status: 'unconfigured', message: '.env에 SF 인증정보를 입력해주세요.', db: { ok: dbOk, caseCount, lastSync } };
    }
    try {
      await this.sf.getToken();
      const meta = await this.sf.discoverFields();
      return {
        status     : 'connected',
        instanceUrl: this.sf.getInstanceUrl(),
        fields     : meta.fields,
        fieldLabels: meta.fieldLabels,
        picklists  : meta.picklists,
        db         : { ok: dbOk, caseCount, lastSync, syncingNow: this.sync.isSyncing() },
      };
    } catch (e: any) {
      return { status: 'error', message: e.message, db: { ok: dbOk } };
    }
  }
}
