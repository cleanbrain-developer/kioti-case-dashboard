import { Body, Controller, Get, HttpCode, Post, ConflictException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SalesforceService } from '../salesforce/salesforce.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('sync')
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    private readonly sf: SalesforceService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @HttpCode(200)
  async triggerSync(@Body() body: { password?: string }) {
    if (!this.syncService.checkPassword(body?.password || '')) throw new UnauthorizedException();
    if (!this.sf.isConfigured())     throw new ServiceUnavailableException('Salesforce not configured');
    if (this.syncService.isSyncing()) throw new ConflictException('Sync already in progress');
    if (!await this.prisma.isAvailable()) throw new ServiceUnavailableException('Database not available');

    this.syncService.sync().catch(e => console.error('[sync]', e.message));
    return { message: 'Sync started' };
  }

  @Get('status')
  getStatus() {
    return this.syncService.getStatus();
  }
}
