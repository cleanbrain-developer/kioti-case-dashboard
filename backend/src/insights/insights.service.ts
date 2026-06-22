import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InsightsService {
  constructor(private prisma: PrismaService) {}

  async getInsights() {
    const [kpi, openDept, totalDept, openPic, status, priority, trend] = await Promise.all([
      this.prisma.$queryRaw<any[]>`
        SELECT
          COUNT(*) FILTER (WHERE NOT is_closed)      AS open,
          COUNT(*) FILTER (WHERE status = 'New')     AS new_cases,
          COUNT(*) FILTER (WHERE status = 'Escalated') AS escalated,
          COUNT(*)                                   AS total
        FROM cases`,
      this.prisma.$queryRaw<any[]>`
        SELECT department AS key, COUNT(*)::int AS cnt
        FROM cases WHERE NOT is_closed AND department IS NOT NULL
        GROUP BY department ORDER BY cnt DESC LIMIT 30`,
      this.prisma.$queryRaw<any[]>`
        SELECT department AS key, COUNT(*)::int AS cnt
        FROM cases WHERE department IS NOT NULL
        GROUP BY department ORDER BY cnt DESC LIMIT 30`,
      this.prisma.$queryRaw<any[]>`
        SELECT pic_name AS key, COUNT(*)::int AS cnt
        FROM cases WHERE NOT is_closed AND pic_name IS NOT NULL
        GROUP BY pic_name ORDER BY cnt DESC LIMIT 20`,
      this.prisma.$queryRaw<any[]>`
        SELECT status, COUNT(*)::int AS total FROM cases
        WHERE status IS NOT NULL GROUP BY status ORDER BY total DESC`,
      this.prisma.$queryRaw<any[]>`
        SELECT priority, COUNT(*)::int AS total FROM cases
        WHERE NOT is_closed AND priority IS NOT NULL GROUP BY priority ORDER BY total DESC`,
      this.prisma.$queryRaw<any[]>`
        SELECT EXTRACT(YEAR  FROM created_date)::int AS yr,
               EXTRACT(MONTH FROM created_date)::int AS mo,
               COUNT(*)::int AS total
        FROM cases WHERE created_date IS NOT NULL
        GROUP BY yr, mo ORDER BY yr, mo LIMIT 24`,
    ]);

    const k = kpi[0] ?? { open: 0, new_cases: 0, escalated: 0, total: 0 };
    const totalDeptMap: Record<string, number> = {};
    totalDept.forEach((r: any) => { totalDeptMap[r.key] = r.cnt; });

    return {
      source: 'db' as const,
      kpi: {
        open     : Number(k.open),
        newCases : Number(k.new_cases),
        escalated: Number(k.escalated),
        total    : Number(k.total),
        openRate : k.total > 0 ? Math.round(Number(k.open) / Number(k.total) * 100) : 0,
      },
      openByDept: openDept.map((r: any) => ({
        key  : r.key,
        open : r.cnt,
        total: totalDeptMap[r.key] ?? r.cnt,
      })),
      openByPic : openPic.map((r: any) => ({ key: r.key, count: r.cnt })),
      status    : status.map((r: any) => ({ Status: r.status, total: r.total })),
      priority  : priority.map((r: any) => ({ Priority: r.priority, total: r.total })),
      trend     : trend.map((r: any) => ({ yr: r.yr, mo: r.mo, total: r.total })),
      totalCount: Number(k.total),
    };
  }

  async getDrill(department?: string) {
    const rows = department
      ? await this.prisma.$queryRaw<any[]>`
          SELECT pic_name AS name, COUNT(*)::int AS count
          FROM cases WHERE NOT is_closed AND pic_name IS NOT NULL AND department = ${department}
          GROUP BY pic_name ORDER BY count DESC LIMIT 20`
      : await this.prisma.$queryRaw<any[]>`
          SELECT pic_name AS name, COUNT(*)::int AS count
          FROM cases WHERE NOT is_closed AND pic_name IS NOT NULL
          GROUP BY pic_name ORDER BY count DESC LIMIT 20`;

    return {
      department: department ?? null,
      records   : rows.map((r: any) => ({ name: r.name, count: r.count })),
      source    : 'db' as const,
    };
  }
}
