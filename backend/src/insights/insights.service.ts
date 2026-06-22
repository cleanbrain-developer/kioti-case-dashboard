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

  async getAging() {
    const bucketExpr = `
      CASE
        WHEN GREATEST(0, CURRENT_DATE - created_date::date) <=  30 THEN '0-30'
        WHEN GREATEST(0, CURRENT_DATE - created_date::date) <=  60 THEN '31-60'
        WHEN GREATEST(0, CURRENT_DATE - created_date::date) <=  90 THEN '61-90'
        WHEN GREATEST(0, CURRENT_DATE - created_date::date) <= 180 THEN '91-180'
        WHEN GREATEST(0, CURRENT_DATE - created_date::date) <= 365 THEN '181-365'
        ELSE '365+'
      END`;
    const openWhere = `is_closed = false AND created_date IS NOT NULL`;

    const [kpi, oldest, buckets, deptBuckets, deptStats, modBuckets, modStats] =
      await Promise.all([
        this.prisma.$queryRawUnsafe<any[]>(`
          SELECT COUNT(*) AS total_open,
            ROUND(AVG(GREATEST(0, CURRENT_DATE - created_date::date)))::int AS avg_age,
            MAX(GREATEST(0, CURRENT_DATE - created_date::date)) AS max_age
          FROM cases WHERE ${openWhere}`),
        this.prisma.$queryRawUnsafe<any[]>(`
          SELECT case_number, subject, created_date,
            GREATEST(0, CURRENT_DATE - created_date::date) AS age_days
          FROM cases WHERE ${openWhere}
          ORDER BY created_date ASC LIMIT 1`),
        this.prisma.$queryRawUnsafe<any[]>(`
          SELECT ${bucketExpr} AS bucket, COUNT(*) AS total
          FROM cases WHERE ${openWhere} GROUP BY bucket`),
        this.prisma.$queryRawUnsafe<any[]>(`
          SELECT COALESCE(department, 'Unassigned') AS key,
            ${bucketExpr} AS bucket, COUNT(*) AS cnt
          FROM cases WHERE ${openWhere} GROUP BY key, bucket`),
        this.prisma.$queryRawUnsafe<any[]>(`
          SELECT COALESCE(department, 'Unassigned') AS key,
            ROUND(AVG(GREATEST(0, CURRENT_DATE - created_date::date)))::int AS avg_age,
            MAX(GREATEST(0, CURRENT_DATE - created_date::date)) AS max_age,
            COUNT(*) AS total
          FROM cases WHERE ${openWhere} GROUP BY key ORDER BY total DESC`),
        this.prisma.$queryRawUnsafe<any[]>(`
          SELECT COALESCE(module_level, 'Unassigned') AS key,
            ${bucketExpr} AS bucket, COUNT(*) AS cnt
          FROM cases WHERE ${openWhere} GROUP BY key, bucket`),
        this.prisma.$queryRawUnsafe<any[]>(`
          SELECT COALESCE(module_level, 'Unassigned') AS key,
            ROUND(AVG(GREATEST(0, CURRENT_DATE - created_date::date)))::int AS avg_age,
            MAX(GREATEST(0, CURRENT_DATE - created_date::date)) AS max_age,
            COUNT(*) AS total
          FROM cases WHERE ${openWhere} GROUP BY key ORDER BY total DESC`),
      ]);

    const BUCKET_ORDER = ['0-30', '31-60', '61-90', '91-180', '181-365', '365+'];

    const buildGroups = (bucketRows: any[], statRows: any[]) => {
      const bmap = new Map<string, Record<string, number>>();
      for (const r of bucketRows) {
        if (!bmap.has(r.key)) bmap.set(r.key, {});
        bmap.get(r.key)![r.bucket] = Number(r.cnt);
      }
      return statRows.map(r => ({
        key   : r.key,
        total : Number(r.total),
        avgAge: Number(r.avg_age),
        maxAge: Number(r.max_age),
        buckets: bmap.get(r.key) ?? {},
      }));
    };

    const k          = kpi[0] ?? { total_open: 0, avg_age: 0, max_age: 0 };
    const totalOpen  = Number(k.total_open);
    const sortedBuckets = buckets
      .map((b: any) => ({ bucket: b.bucket, total: Number(b.total) }))
      .sort((a: any, b: any) => BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket));
    const over181 = sortedBuckets
      .filter((b: any) => b.bucket === '181-365' || b.bucket === '365+')
      .reduce((s: number, b: any) => s + b.total, 0);

    return {
      source      : 'db' as const,
      totalOpen,
      avgAge      : Number(k.avg_age),
      maxAge      : Number(k.max_age),
      over181Pct  : totalOpen > 0 ? Math.round(over181 / totalOpen * 100) : 0,
      oldestCase  : oldest[0] ? {
        caseNumber : oldest[0].case_number,
        subject    : oldest[0].subject,
        createdDate: oldest[0].created_date,
        ageDays    : Number(oldest[0].age_days),
      } : null,
      buckets      : sortedBuckets,
      byDepartment : buildGroups(deptBuckets, deptStats),
      byModuleLevel: buildGroups(modBuckets, modStats),
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
