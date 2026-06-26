import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VisitorsService {
  constructor(private prisma: PrismaService) {}

  private isValidDate(d?: string): d is string {
    return /^\d{4}-\d{2}-\d{2}$/.test(d ?? '');
  }

  async ping(clientDate?: string): Promise<{ count: number }> {
    if (this.isValidDate(clientDate)) {
      await this.prisma.$executeRaw`
        INSERT INTO daily_visits (date, count)
        VALUES (${clientDate}::date, 1)
        ON CONFLICT (date) DO UPDATE SET count = daily_visits.count + 1
      `;
    } else {
      await this.prisma.$executeRaw`
        INSERT INTO daily_visits (date, count)
        VALUES (CURRENT_DATE, 1)
        ON CONFLICT (date) DO UPDATE SET count = daily_visits.count + 1
      `;
    }
    return this.getToday(clientDate);
  }

  async getToday(clientDate?: string): Promise<{ count: number }> {
    if (this.isValidDate(clientDate)) {
      const rows = await this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count FROM daily_visits WHERE date = ${clientDate}::date
      `;
      return { count: Number(rows[0]?.count ?? 0) };
    }
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count FROM daily_visits WHERE date = CURRENT_DATE
    `;
    return { count: Number(rows[0]?.count ?? 0) };
  }
}
