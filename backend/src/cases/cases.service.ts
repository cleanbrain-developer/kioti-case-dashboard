import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SalesforceService } from '../salesforce/salesforce.service';
import { QueryCasesDto } from './dto/query-cases.dto';
import { Prisma } from '@prisma/client';

const DB_SORT_MAP: Record<string, string> = {
  CaseNumber    : 'case_number',
  Subject       : 'subject',
  Status        : 'status',
  Priority      : 'priority',
  dept          : 'department',
  pic           : 'pic_name',
  module        : 'module_level',
  'Account.Name': 'account_name',
  CreatedDate   : 'created_date',
};

@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);

  constructor(
    private prisma: PrismaService,
    private sf: SalesforceService,
  ) {}

  private buildPrismaWhere(q: QueryCasesDto): Prisma.CaseWhereInput {
    const where: Prisma.CaseWhereInput = {};

    if (q.search) {
      where.OR = [
        { subject    : { contains: q.search, mode: 'insensitive' } },
        { caseNumber : { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (q.status)            where.status     = { equals: q.status, mode: 'insensitive' };
    if (q.isClosed === 'false') where.isClosed = false;
    if (q.priority)          where.priority   = { equals: q.priority, mode: 'insensitive' };
    if (q.department)        where.department = { contains: q.department, mode: 'insensitive' };
    if (q.personInCharge)    where.picName    = { contains: q.personInCharge, mode: 'insensitive' };
    if (q.moduleLevel)       where.moduleLevel= { contains: q.moduleLevel, mode: 'insensitive' };
    if (q.dateFrom || q.dateTo) {
      where.createdDate = {};
      if (q.dateFrom) where.createdDate.gte = new Date(q.dateFrom);
      if (q.dateTo)   where.createdDate.lte = new Date(q.dateTo);
    }
    return where;
  }

  private rowToRecord(r: any, sf: SalesforceService) {
    return {
      Id                           : r.id,
      CaseNumber                   : r.caseNumber,
      Subject                      : r.subject,
      Status                       : r.status,
      Priority                     : r.priority,
      IsClosed                     : r.isClosed,
      [sf.fields.department]       : r.department,
      [sf.fields.personInCharge]   : r.picId,
      _picName                     : r.picName,
      [sf.fields.moduleLevel]      : r.moduleLevel,
      'Account.Name'               : r.accountName,
      CreatedDate                  : r.createdDate,
    };
  }

  async findAll(q: QueryCasesDto) {
    const page     = Math.max(parseInt(q.page     || '1')  || 1,  1);
    const pageSize = Math.min(Math.max(parseInt(q.pageSize || '25') || 25, 1), 200);
    const sortDir  = q.sortDir === 'ASC' ? 'asc' : 'desc';
    const dbCol    = DB_SORT_MAP[q.sortField || 'CreatedDate'] || 'created_date';

    const caseCount = await this.prisma.getCaseCount();
    if (await this.prisma.isAvailable() && caseCount > 0) {
      try {
        const where = this.buildPrismaWhere(q);
        const [total, rows] = await Promise.all([
          this.prisma.case.count({ where }),
          this.prisma.case.findMany({
            where,
            orderBy: { [dbCol]: sortDir } as any,
            skip   : (page - 1) * pageSize,
            take   : pageSize,
          }),
        ]);
        return {
          records   : rows.map(r => this.rowToRecord(r, this.sf)),
          totalCount: total,
          source    : 'db',
        };
      } catch (e: any) {
        this.logger.warn('DB query failed, falling back to SF:', e.message);
      }
    }

    // SF fallback
    const { where: soqlWhere } = this.buildSoqlWhere(q);
    const apiVersion = process.env.SF_API_VERSION || 'v62.0';
    const safeSort   = this.resolveSortField(q.sortField || 'CreatedDate');
    const safeDir    = q.sortDir === 'ASC' ? 'ASC' : 'DESC';
    const picRel     = this.sf.picRelField;
    const selectFields = [
      'Id', 'CaseNumber', 'Subject', 'Status', 'Priority',
      this.sf.fields.department, this.sf.fields.personInCharge,
      `${picRel}.Name`, this.sf.fields.moduleLevel,
      'Account.Name', 'CreatedDate',
    ].join(', ');

    const offset = Math.min((page - 1) * pageSize, 2000);
    const [casesData, countData] = await Promise.all([
      this.sf.query(`SELECT ${selectFields} FROM Case ${soqlWhere} ORDER BY ${safeSort} ${safeDir} LIMIT ${pageSize} OFFSET ${offset}`),
      this.sf.query(`SELECT COUNT() FROM Case ${soqlWhere}`),
    ]);
    const records = casesData.records.map((r: any) => ({ ...r, _picName: r[picRel]?.Name || null }));
    return { records, totalCount: countData.totalSize, source: 'sf' };
  }

  private buildSoqlWhere(q: QueryCasesDto): { where: string } {
    const cls: string[] = [];
    const esc = (s: string) => this.sf.soqlEsc(s);
    if (q.search)               cls.push(`(Subject LIKE '%${esc(q.search)}%' OR CaseNumber LIKE '%${esc(q.search)}%')`);
    if (q.status)               cls.push(`Status = '${esc(q.status)}'`);
    if (q.isClosed === 'false') cls.push(`IsClosed = false`);
    if (q.priority)             cls.push(`Priority = '${esc(q.priority)}'`);
    if (q.department)           cls.push(`${this.sf.fields.department} LIKE '%${esc(q.department)}%'`);
    if (q.personInCharge)       cls.push(`${this.sf.fields.personInCharge} LIKE '%${esc(q.personInCharge)}%'`);
    if (q.moduleLevel)          cls.push(`${this.sf.fields.moduleLevel} LIKE '%${esc(q.moduleLevel)}%'`);
    if (q.dateFrom)             cls.push(`CreatedDate >= ${q.dateFrom}`);
    if (q.dateTo)               cls.push(`CreatedDate <= ${q.dateTo}`);
    return { where: cls.length ? 'WHERE ' + cls.join(' AND ') : '' };
  }

  private resolveSortField(f: string): string {
    const aliases: Record<string, string> = {
      dept  : this.sf.fields.department,
      pic   : this.sf.fields.personInCharge,
      module: this.sf.fields.moduleLevel,
    };
    if (aliases[f]) return aliases[f];
    const safe = new Set(['CaseNumber', 'Subject', 'Status', 'Priority', 'CreatedDate', 'LastModifiedDate', 'Account.Name']);
    return safe.has(f) ? f : 'CreatedDate';
  }
}
