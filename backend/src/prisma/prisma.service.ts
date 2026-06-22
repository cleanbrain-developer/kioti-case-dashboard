import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    console.log('   DB: ✓ PostgreSQL connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async getCaseCount(): Promise<number> {
    try {
      const result = await this.case.count();
      return result;
    } catch {
      return 0;
    }
  }

  async getLastSync() {
    try {
      return await this.syncLog.findFirst({
        where: { status: 'success' },
        orderBy: { id: 'desc' },
      });
    } catch {
      return null;
    }
  }
}
