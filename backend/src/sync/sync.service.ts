import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SalesforceService } from '../salesforce/salesforce.service';

export type SyncPhase = 'idle' | 'auth' | 'fetching' | 'saving' | 'done' | 'error';

export interface SyncProgress {
  phase    : SyncPhase;
  fetched  : number;
  upserted : number;
  total    : number;
  startedAt: number | null;
  lastResult: { success: boolean; count?: number; duration?: number; error?: string; at: string } | null;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'kioti';
  private readonly CHUNK = 100;

  private progress: SyncProgress = {
    phase: 'idle', fetched: 0, upserted: 0, total: 0,
    startedAt: null, lastResult: null,
  };

  constructor(
    private prisma: PrismaService,
    private sf: SalesforceService,
  ) {}

  isSyncing(): boolean {
    return !['idle', 'done', 'error'].includes(this.progress.phase);
  }

  getProgress(): SyncProgress { return this.progress; }

  checkPassword(password: string): boolean { return password === this.ADMIN_PASSWORD; }

  @Cron('0 1 * * *')
  async dailySync() {
    this.logger.log('Daily 01:00 sync triggered');
    await this.sync();
  }

  async sync(): Promise<number | null> {
    if (this.isSyncing()) { this.logger.log('Sync already in progress, skipping'); return null; }
    if (!this.sf.isConfigured()) { this.logger.log('SF not configured'); return null; }

    this.progress = { phase: 'auth', fetched: 0, upserted: 0, total: 0, startedAt: Date.now(), lastResult: this.progress.lastResult };
    let logId: number | null = null;

    try {
      const log = await this.prisma.syncLog.create({ data: { status: 'running' } });
      logId = log.id;

      await this.sf.getToken();
      const meta = await this.sf.discoverFields();
      this.logger.log(`Fields: ${JSON.stringify(meta.fields)}`);

      const picRel = this.sf.picRelField;
      const f      = this.sf.fields;
      const soql   = [
        'SELECT Id, CaseNumber, Subject, Status, Priority, IsClosed,',
        `${f.department}, ${f.personInCharge}, ${picRel}.Name,`,
        `${f.moduleLevel}, Account.Name, Owner.Id, Owner.Name, CreatedDate`,
        'FROM Case ORDER BY CreatedDate DESC',
      ].join(' ');

      this.progress.phase = 'fetching';
      this.logger.log('Fetching cases from Salesforce…');
      const records = await this.sf.queryAll(soql, n => { this.progress.fetched = n; });
      this.progress.fetched = records.length;
      this.progress.total   = records.length;
      this.logger.log(`${records.length} records fetched`);

      this.progress.phase = 'saving';
      await this.upsertCases(records);

      const duration = Date.now() - this.progress.startedAt!;
      await this.prisma.syncLog.update({
        where: { id: logId },
        data : { endedAt: new Date(), totalSynced: records.length, status: 'success' },
      });
      this.logger.log(`Done — ${records.length} cases synced (${(duration / 1000).toFixed(1)}s)`);
      this.progress.phase      = 'done';
      this.progress.lastResult = { success: true, count: records.length, duration, at: new Date().toISOString() };
      return records.length;

    } catch (e: any) {
      this.logger.error('Sync failed:', e.message);
      if (logId) {
        await this.prisma.syncLog.update({
          where: { id: logId },
          data : { endedAt: new Date(), status: 'error', errorMsg: e.message },
        }).catch(() => {});
      }
      this.progress.phase      = 'error';
      this.progress.lastResult = { success: false, error: e.message, at: new Date().toISOString() };
      return null;
    }
  }

  private async upsertCases(records: any[]) {
    if (!records.length) return;
    const f      = this.sf.fields;
    const picRel = this.sf.picRelField;

    for (let i = 0; i < records.length; i += this.CHUNK) {
      const chunk = records.slice(i, i + this.CHUNK);
      await Promise.all(
        chunk.map((r: any) =>
          this.prisma.case.upsert({
            where : { id: r.Id },
            create: this.toCreate(r, f, picRel),
            update: this.toCreate(r, f, picRel),
          })
        )
      );
      this.progress.upserted = i + chunk.length;
    }
  }

  private toCreate(r: any, f: any, picRel: string) {
    return {
      id         : r.Id,
      caseNumber : r.CaseNumber || '',
      subject    : r.Subject    || null,
      status     : r.Status     || null,
      priority   : r.Priority   || null,
      department : r[f.department]     || null,
      picId      : r[f.personInCharge] || null,
      picName    : r[picRel]?.Name     || null,
      moduleLevel: r[f.moduleLevel]    || null,
      accountName: r.Account?.Name || r['Account.Name'] || null,
      ownerId    : r.Owner?.Id   || null,
      ownerName  : r.Owner?.Name || null,
      createdDate: r.CreatedDate ? new Date(r.CreatedDate) : null,
      isClosed   : r.IsClosed === true,
      syncedAt   : new Date(),
    };
  }

  async getStatus() {
    const lastSync  = await this.prisma.getLastSync();
    const caseCount = await this.prisma.getCaseCount();
    return {
      phase    : this.progress.phase,
      syncing  : this.isSyncing(),
      fetched  : this.progress.fetched,
      upserted : this.progress.upserted,
      total    : this.progress.total,
      elapsed  : this.progress.startedAt ? Date.now() - this.progress.startedAt : null,
      lastResult: this.progress.lastResult,
      lastSync,
      caseCount,
    };
  }
}
