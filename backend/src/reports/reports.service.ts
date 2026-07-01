import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { buildReportEmail, type DeptSection } from './email.template';
import * as nodemailer from 'nodemailer';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RecipientDto {
  email: string;
  name: string;
  departments: string[];
}

export interface ScheduleDto {
  enabled: boolean;
  freq: 'weekly' | 'monthly';
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  hourEst: number;
  minuteEst: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Recipients CRUD ────────────────────────────────────────────────────────

  async listRecipients() {
    const rows = await this.prisma.emailRecipient.findMany({
      include: { departments: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(r => ({
      id: r.id,
      email: r.email,
      name: r.name,
      departments: r.departments.map(d => d.department),
      createdAt: r.createdAt,
    }));
  }

  async createRecipient(dto: RecipientDto) {
    const recipient = await this.prisma.emailRecipient.create({
      data: {
        email: dto.email,
        name: dto.name,
        departments: {
          create: dto.departments.map(d => ({ department: d })),
        },
      },
      include: { departments: true },
    });
    return { ...recipient, departments: recipient.departments.map(d => d.department) };
  }

  async updateRecipient(id: number, dto: RecipientDto) {
    await this.prisma.recipientDepartment.deleteMany({ where: { recipientId: id } });
    const recipient = await this.prisma.emailRecipient.update({
      where: { id },
      data: {
        email: dto.email,
        name: dto.name,
        departments: {
          create: dto.departments.map(d => ({ department: d })),
        },
      },
      include: { departments: true },
    });
    return { ...recipient, departments: recipient.departments.map(d => d.department) };
  }

  async deleteRecipient(id: number) {
    await this.prisma.emailRecipient.delete({ where: { id } });
    return { deleted: id };
  }

  // ── Schedule ───────────────────────────────────────────────────────────────

  async getSchedule() {
    const s = await this.prisma.emailSchedule.findFirst({ where: { id: 1 } });
    return s ?? { id: 1, enabled: false, freq: 'weekly', dayOfWeek: 1, dayOfMonth: null, hourEst: 8, minuteEst: 0, lastSentAt: null };
  }

  async updateSchedule(dto: ScheduleDto) {
    return this.prisma.emailSchedule.update({
      where: { id: 1 },
      data: {
        enabled    : dto.enabled,
        freq       : dto.freq,
        dayOfWeek  : dto.freq === 'weekly'  ? (dto.dayOfWeek ?? 1)  : null,
        dayOfMonth : dto.freq === 'monthly' ? (dto.dayOfMonth ?? 1) : null,
        hourEst    : dto.hourEst,
        minuteEst  : dto.minuteEst,
      },
    });
  }

  // ── Department list ────────────────────────────────────────────────────────

  async getDepartments(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ department: string }[]>`
      SELECT DISTINCT department FROM cases
      WHERE department IS NOT NULL AND department <> ''
      ORDER BY department
    `;
    return rows.map(r => r.department);
  }

  // ── Report data builder ────────────────────────────────────────────────────

  private async buildDeptSection(department: string): Promise<DeptSection> {
    type KpiRow = { total_open: bigint; avg_age: number; new_this_week: bigint; closed_this_week: bigint };
    const [kpiRow] = await this.prisma.$queryRaw<KpiRow[]>`
      SELECT
        COUNT(*)                                                    FILTER (WHERE status = 'Open')                          AS total_open,
        COALESCE(ROUND(AVG(CURRENT_DATE - created_date::date)
          FILTER (WHERE status = 'Open'))::numeric, 0)::int         AS avg_age,
        COUNT(*)                                                    FILTER (WHERE status = 'Open'
          AND created_date >= NOW() - INTERVAL '7 days')            AS new_this_week,
        COUNT(*)                                                    FILTER (WHERE is_closed = true
          AND synced_at >= NOW() - INTERVAL '7 days')               AS closed_this_week
      FROM cases
      WHERE department = ${department}
    `;

    type PicRow = { pic_name: string; open_count: bigint; high_count: bigint; med_count: bigint; low_count: bigint; avg_age: number };
    const picRows = await this.prisma.$queryRaw<PicRow[]>`
      SELECT
        pic_name,
        COUNT(*)                                                              AS open_count,
        COUNT(*) FILTER (WHERE priority = 'High')                            AS high_count,
        COUNT(*) FILTER (WHERE priority = 'Medium')                          AS med_count,
        COUNT(*) FILTER (WHERE priority = 'Low')                             AS low_count,
        COALESCE(ROUND(AVG(CURRENT_DATE - created_date::date))::numeric,0)::int AS avg_age
      FROM cases
      WHERE department = ${department} AND status = 'Open' AND pic_name IS NOT NULL
      GROUP BY pic_name
      ORDER BY open_count DESC
      LIMIT 10
    `;

    type PrioRow = { priority: string; count: bigint };
    const prioRows = await this.prisma.$queryRaw<PrioRow[]>`
      SELECT priority, COUNT(*) AS count
      FROM cases
      WHERE department = ${department} AND status = 'Open' AND priority IS NOT NULL
      GROUP BY priority
      ORDER BY count DESC
    `;

    type OldRow = { case_number: string; subject: string | null; pic_name: string | null; age_days: number };
    const oldRows = await this.prisma.$queryRaw<OldRow[]>`
      SELECT case_number, subject, pic_name,
        (CURRENT_DATE - created_date::date)::int AS age_days
      FROM cases
      WHERE department = ${department} AND status = 'Open' AND created_date IS NOT NULL
      ORDER BY created_date ASC
      LIMIT 5
    `;

    return {
      department,
      kpi: {
        totalOpen     : Number(kpiRow?.total_open ?? 0),
        avgAge        : Number(kpiRow?.avg_age ?? 0),
        newThisWeek   : Number(kpiRow?.new_this_week ?? 0),
        closedThisWeek: Number(kpiRow?.closed_this_week ?? 0),
      },
      topPics: picRows.map(r => ({
        name      : r.pic_name,
        openCount : Number(r.open_count),
        highCount : Number(r.high_count),
        medCount  : Number(r.med_count),
        lowCount  : Number(r.low_count),
        avgAge    : Number(r.avg_age),
      })),
      priorityBreakdown: prioRows.map(r => ({
        priority: r.priority,
        count   : Number(r.count),
      })),
      oldestCases: oldRows.map(r => ({
        caseNumber: r.case_number,
        subject   : r.subject,
        picName   : r.pic_name,
        ageDays   : Number(r.age_days),
      })),
    };
  }

  // ── Test send ──────────────────────────────────────────────────────────────

  async sendTest(toEmail: string, department: string): Promise<{ ok: boolean; message: string }> {
    this.assertSmtpConfigured();
    const section = await this.buildDeptSection(department);
    const html = buildReportEmail({
      reportDate: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      sections  : [section],
      isTest    : true,
    });
    await this.sendEmail([toEmail], `[TEST] KIOTI Case Dashboard — ${department} Report`, html);
    return { ok: true, message: `Test email sent to ${toEmail}` };
  }

  // ── Manual send (immediate, bypass schedule check) ─────────────────────────

  async sendNow(): Promise<{ ok: boolean; sent: number }> {
    this.assertSmtpConfigured();
    const count = await this.runSend();
    return { ok: true, sent: count };
  }

  // ── Cron: check every minute ───────────────────────────────────────────────

  @Cron('0 * * * * *')
  async checkSchedule() {
    try {
      const schedule = await this.prisma.emailSchedule.findFirst({ where: { id: 1 } });
      if (!schedule?.enabled) return;
      if (!this.isSmtpConfigured()) return;
      if (!(await this.shouldSendNow(schedule))) return;
      const sent = await this.runSend();
      this.logger.log(`Scheduled report sent to ${sent} recipient(s)`);
    } catch (err) {
      this.logger.error('Scheduled report error', err);
    }
  }

  // ─── internals ─────────────────────────────────────────────────────────────

  private async shouldSendNow(schedule: any): Promise<boolean> {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit', minute: '2-digit',
      weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
      hour12: false,
    }).formatToParts(now);

    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
    const h   = parseInt(get('hour'),   10);
    const m   = parseInt(get('minute'), 10);
    const dow = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[get('weekday')] ?? -1;
    const dom = parseInt(get('day'), 10);

    if (h !== schedule.hourEst || m !== schedule.minuteEst) return false;

    if (schedule.freq === 'weekly' && dow !== schedule.dayOfWeek)   return false;
    if (schedule.freq === 'monthly' && dom !== schedule.dayOfMonth) return false;

    // Guard: not already sent today (EST)
    if (schedule.lastSentAt) {
      const todayEst = `${get('year')}-${get('month')}-${get('day')}`;
      const lastEst  = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
        .format(new Date(schedule.lastSentAt));
      if (lastEst >= todayEst) return false;
    }
    return true;
  }

  private async runSend(): Promise<number> {
    // Mark as sent immediately to prevent double-send
    await this.prisma.emailSchedule.update({
      where: { id: 1 },
      data : { lastSentAt: new Date() },
    });

    const allDepts = await this.getDepartments();
    const recipients = await this.listRecipients();
    if (!recipients.length) return 0;

    // Pre-build sections per department (deduplicated)
    const neededDepts = new Set<string>();
    for (const r of recipients) {
      const depts = r.departments.length > 0 ? r.departments : allDepts;
      depts.forEach(d => neededDepts.add(d));
    }
    const sectionMap = new Map<string, DeptSection>();
    await Promise.all([...neededDepts].map(async d => {
      sectionMap.set(d, await this.buildDeptSection(d));
    }));

    const reportDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      timeZone: 'America/New_York',
    });

    let sent = 0;
    for (const r of recipients) {
      const depts   = r.departments.length > 0 ? r.departments : allDepts;
      const sections = depts.map(d => sectionMap.get(d)).filter(Boolean) as DeptSection[];
      if (!sections.length) continue;
      const html = buildReportEmail({ reportDate, sections });
      await this.sendEmail([r.email], `KIOTI Case Dashboard — Weekly Report (${reportDate})`, html);
      sent++;
    }
    return sent;
  }

  private async sendEmail(to: string[], subject: string, html: string) {
    const port = parseInt(process.env.SMTP_PORT ?? '25', 10);
    const transport = nodemailer.createTransport({
      host     : process.env.SMTP_HOST,
      port,
      secure   : process.env.SMTP_SECURE === 'true',
      // Internal Docker relay (port 25): skip STARTTLS and cert validation
      ignoreTLS: port === 25,
      tls      : { rejectUnauthorized: false },
      // auth is optional — omit when using internal relay (kioti-smtp container)
      ...(process.env.SMTP_USER
        ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
        : {}),
    });
    await transport.sendMail({
      from   : `"KIOTI Case Dashboard" <no-reply@kiotitractor.com>`,
      to     : to.join(', '),
      subject,
      html,
    });
  }

  private isSmtpConfigured(): boolean {
    // Only SMTP_HOST is required; internal relay (kioti-smtp) needs no credentials
    return !!process.env.SMTP_HOST;
  }

  private assertSmtpConfigured() {
    if (!this.isSmtpConfigured()) {
      throw new HttpException(
        'SMTP is not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS to the server .env file.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
