import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VisitorsService {
  constructor(private prisma: PrismaService) {}

  async ping(): Promise<{ count: number }> {
    await this.prisma.$executeRaw`
      INSERT INTO daily_visits (date, count)
      VALUES (CURRENT_DATE, 1)
      ON CONFLICT (date) DO UPDATE SET count = daily_visits.count + 1
    `;
    return this.getToday();
  }

  async getToday(): Promise<{ count: number }> {
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count FROM daily_visits WHERE date = CURRENT_DATE
    `;
    return { count: Number(rows[0]?.count ?? 0) };
  }
}
