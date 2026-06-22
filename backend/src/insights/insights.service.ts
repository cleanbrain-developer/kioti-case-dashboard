import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SalesforceService } from '../salesforce/salesforce.service';

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(
    private prisma: PrismaService,
    private sf: SalesforceService,
  ) {}

  async getInsights() {
    if (await this.prisma.isAvailable() && (await this.prisma.getCaseCount()) > 0) {
      try { return await this.fromDb(); } catch (e: any) {
        this.logger.warn('DB insights failed, fallback to SF:', e.message);
      }
    }
    return this.fromSf();
  }

  async getDrill(department?: string) {
    if (await this.prisma.isAvailable() && (await this.prisma.getCaseCount()) > 0) {
      try { return await this.drillFromDb(department); } catch (e: any) {
        this.logger.warn('DB drill failed, fallback to SF:', e.message);
      }
    }
    return this.drillFromSf(department);
  }

  private async fromDb() {
    const [kpi, openDept, totalDept, openPic, status, priority, trend] = await Promise.all([
      this.prisma.$queryRaw<any[]>`
        SELECT
          COUNT(*) FILTER (WHERE NOT is_closed)    AS open,
          COUNT(*) FILTER (WHERE status='New')     AS new_cases,
          COUNT(*) FILTER (WHERE status='Escalated') AS escalated,
          COUNT(*)                                 AS total
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
        SELECT EXTRACT(YEAR FROM created_date)::int AS yr,
               EXTRACT(MONTH FROM created_date)::int AS mo,
               COUNT(*)::int AS total
        FROM cases WHERE created_date IS NOT NULL
        GROUP BY yr, mo ORDER BY yr, mo LIMIT 24`,
    ]);

    const k = kpi[0];
    const totalDeptMap: Record<string, number> = {};
    totalDept.forEach((r: any) => { totalDeptMap[r.key] = r.cnt; });

    return {
      source: 'db',
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
        total: totalDeptMap[r.key] || r.cnt,
      })),
      openByPic: openPic.map((r: any) => ({ key: r.key, count: r.cnt })),
      status   : status.map((r: any) => ({ Status: r.status, total: r.total })),
      priority : priority.map((r: any) => ({ Priority: r.priority, total: r.total })),
      trend    : trend.map((r: any) => ({ yr: r.yr, mo: r.mo, total: r.total })),
      totalCount: Number(k.total),
    };
  }

  private async fromSf() {
    const picRel = this.sf.picRelField;
    const dept   = this.sf.fields.department;
    const pic    = this.sf.fields.personInCharge;

    const [sR, pR, openDeptR, totalDeptR, openPicR, tR, openR, newR, escR, totalR] = await Promise.all([
      this.sf.query(`SELECT Status, COUNT(Id) total FROM Case GROUP BY Status ORDER BY COUNT(Id) DESC`),
      this.sf.query(`SELECT Priority, COUNT(Id) total FROM Case WHERE IsClosed = false GROUP BY Priority`),
      this.sf.query(`SELECT ${dept}, COUNT(Id) cnt FROM Case WHERE IsClosed = false GROUP BY ${dept} ORDER BY COUNT(Id) DESC LIMIT 30`),
      this.sf.query(`SELECT ${dept}, COUNT(Id) cnt FROM Case GROUP BY ${dept} ORDER BY COUNT(Id) DESC LIMIT 30`),
      this.sf.query(`SELECT ${picRel}.Name picName, COUNT(Id) cnt FROM Case WHERE IsClosed = false AND ${pic} != null GROUP BY ${picRel}.Name ORDER BY COUNT(Id) DESC LIMIT 20`),
      this.sf.query(`SELECT CALENDAR_YEAR(CreatedDate) yr, CALENDAR_MONTH(CreatedDate) mo, COUNT(Id) total FROM Case GROUP BY CALENDAR_YEAR(CreatedDate), CALENDAR_MONTH(CreatedDate) ORDER BY CALENDAR_YEAR(CreatedDate) ASC, CALENDAR_MONTH(CreatedDate) ASC LIMIT 24`),
      this.sf.query(`SELECT COUNT() FROM Case WHERE IsClosed = false`),
      this.sf.query(`SELECT COUNT() FROM Case WHERE Status = 'New'`),
      this.sf.query(`SELECT COUNT() FROM Case WHERE Status = 'Escalated'`),
      this.sf.query(`SELECT COUNT() FROM Case`),
    ]);

    const totalDeptMap: Record<string, number> = {};
    totalDeptR.records.forEach((r: any) => { totalDeptMap[r[dept] || 'Unknown'] = r.cnt; });

    return {
      source: 'sf',
      kpi: {
        open: openR.totalSize, newCases: newR.totalSize,
        escalated: escR.totalSize, total: totalR.totalSize,
        openRate: totalR.totalSize ? Math.round(openR.totalSize / totalR.totalSize * 100) : 0,
      },
      openByDept: openDeptR.records.map((r: any) => ({
        key  : r[dept] || 'Unknown',
        open : r.cnt,
        total: totalDeptMap[r[dept] || 'Unknown'] || r.cnt,
      })),
      openByPic: openPicR.records.map((r: any) => ({ key: r[picRel]?.Name || r.picName || 'Unknown', count: r.cnt })),
      status   : sR.records, priority: pR.records, trend: tR.records,
      totalCount: totalR.totalSize,
    };
  }

  private async drillFromDb(department?: string) {
    const rows = department
      ? await this.prisma.$queryRaw<any[]>`
          SELECT pic_name AS name, COUNT(*)::int AS count
          FROM cases WHERE NOT is_closed AND pic_name IS NOT NULL AND department = ${department}
          GROUP BY pic_name ORDER BY count DESC LIMIT 20`
      : await this.prisma.$queryRaw<any[]>`
          SELECT pic_name AS name, COUNT(*)::int AS count
          FROM cases WHERE NOT is_closed AND pic_name IS NOT NULL
          GROUP BY pic_name ORDER BY count DESC LIMIT 20`;

    return { department: department || null, records: rows.map((r: any) => ({ name: r.name, count: r.count })), source: 'db' };
  }

  private async drillFromSf(department?: string) {
    const picRel    = this.sf.picRelField;
    const pic       = this.sf.fields.personInCharge;
    const dept      = this.sf.fields.department;
    const deptClause = department ? `AND ${dept} = '${this.sf.soqlEsc(department)}'` : '';
    const data = await this.sf.query(
      `SELECT ${picRel}.Name picName, COUNT(Id) cnt FROM Case WHERE IsClosed = false ${deptClause} AND ${pic} != null GROUP BY ${picRel}.Name ORDER BY COUNT(Id) DESC LIMIT 20`
    );
    return {
      department: department || null,
      records: data.records.map((r: any) => ({ name: r[picRel]?.Name || r.picName || 'Unknown', count: r.cnt })),
      source: 'sf',
    };
  }
}
