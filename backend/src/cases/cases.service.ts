import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryCasesDto } from './dto/query-cases.dto';
import { Prisma } from '@prisma/client';

const DB_SORT_MAP: Record<string, string> = {
  CaseNumber    : 'caseNumber',
  Subject       : 'subject',
  Status        : 'status',
  Priority      : 'priority',
  dept          : 'department',
  pic           : 'picName',
  owner         : 'ownerName',
  module        : 'moduleLevel',
  'Account.Name': 'accountName',
  CreatedDate   : 'createdDate',
};

@Injectable()
export class CasesService {
  constructor(private prisma: PrismaService) {}

  private buildWhere(q: QueryCasesDto): Prisma.CaseWhereInput {
    const where: Prisma.CaseWhereInput = {};
    if (q.search) {
      where.OR = [
        { subject    : { contains: q.search, mode: 'insensitive' } },
        { caseNumber : { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (q.status)               where.status      = { equals: q.status, mode: 'insensitive' };
    if (q.isClosed === 'false') where.isClosed     = false;
    if (q.priority)             where.priority     = { equals: q.priority, mode: 'insensitive' };
    if (q.department)           where.department   = { contains: q.department, mode: 'insensitive' };
    if (q.personInCharge)       where.picName      = { contains: q.personInCharge, mode: 'insensitive' };
    if (q.moduleLevel)          where.moduleLevel  = { contains: q.moduleLevel, mode: 'insensitive' };
    if (q.dateFrom || q.dateTo) {
      where.createdDate = {};
      if (q.dateFrom) where.createdDate.gte = new Date(`${q.dateFrom}T00:00:00.000Z`);
      if (q.dateTo)   where.createdDate.lte = new Date(`${q.dateTo}T23:59:59.999Z`);
    }
    return where;
  }

  private rowToRecord(r: any) {
    return {
      Id           : r.id,
      CaseNumber   : r.caseNumber,
      Subject      : r.subject,
      Status       : r.status,
      Priority     : r.priority,
      IsClosed     : r.isClosed,
      department   : r.department,
      _picName     : r.picName,
      ownerId      : r.ownerId,
      ownerName    : r.ownerName,
      'Account.Name': r.accountName,
      CreatedDate  : r.createdDate,
    };
  }

  async findAll(q: QueryCasesDto) {
    const page     = Math.max(parseInt(q.page     || '1')  || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(q.pageSize || '25') || 25, 1), 200);
    const sortDir  = q.sortDir === 'ASC' ? 'asc' : 'desc';
    const dbCol    = DB_SORT_MAP[q.sortField || 'CreatedDate'] || 'created_date';
    const where    = this.buildWhere(q);

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
      records   : rows.map(r => this.rowToRecord(r)),
      totalCount: total,
      source    : 'db' as const,
    };
  }
}
