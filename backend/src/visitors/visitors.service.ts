import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VisitorsService {
  constructor(private prisma: PrismaService) {}

  private isValidDate(d?: string): d is string {
    return /^\d{4}-\d{2}-\d{2}$/.test(d ?? '');
  }

  private isValidSessionId(s?: string): s is string {
    return typeof s === 'string' && s.length >= 8 && s.length <= 128;
  }

  async ping(clientDate?: string, sessionId?: string): Promise<{ count: number }> {
    if (!this.isValidDate(clientDate) || !this.isValidSessionId(sessionId)) {
      return this.getToday(clientDate);
    }

    // Insert session (idempotent — ON CONFLICT DO NOTHING deduplicates)
    await this.prisma.$executeRaw`
      INSERT INTO visit_sessions (date, session_id)
      VALUES (${clientDate}::date, ${sessionId})
      ON CONFLICT DO NOTHING
    `;

    return this.getToday(clientDate);
  }

  async getToday(clientDate?: string): Promise<{ count: number }> {
    if (this.isValidDate(clientDate)) {
      const rows = await this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) AS count FROM visit_sessions WHERE date = ${clientDate}::date
      `;
      return { count: Number(rows[0]?.count ?? 0) };
    }
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM visit_sessions WHERE date = CURRENT_DATE
    `;
    return { count: Number(rows[0]?.count ?? 0) };
  }
}
