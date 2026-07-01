export interface TopPicRow {
  name: string;
  openCount: number;
  highCount: number;
  medCount: number;
  lowCount: number;
  avgAge: number;
}

export interface OldestCase {
  caseNumber: string;
  subject: string | null;
  picName: string | null;
  ageDays: number;
}

export interface DeptSection {
  department: string;
  kpi: {
    totalOpen: number;
    avgAge: number;
    newThisWeek: number;
    closedThisWeek: number;
  };
  topPics: TopPicRow[];
  priorityBreakdown: Array<{ priority: string; count: number }>;
  oldestCases: OldestCase[];
}

// ─── helpers ────────────────────────────────────────────────────────────────

function ageColor(days: number): string {
  if (days > 180) return '#ef4444';
  if (days > 90)  return '#f97316';
  if (days > 30)  return '#eab308';
  return '#22c55e';
}

function rankBadge(i: number): string {
  const colors = ['#f59e0b', '#94a3b8', '#a16207', '#64748b', '#475569'];
  const c = colors[i] ?? '#334155';
  return `<span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:${c};
    color:#0f172a;font-size:10px;font-weight:700;text-align:center;line-height:20px;">${i + 1}</span>`;
}

function priorityChip(label: string, count: number, color: string): string {
  if (!count) return '';
  return `<span style="display:inline-block;padding:1px 7px;border-radius:9999px;
    background:${color}22;color:${color};font-size:10px;font-weight:600;margin-right:3px;">${label} ${count}</span>`;
}

function kpiCard(label: string, value: string, sub = '', color = '#f1f5f9'): string {
  return `
  <td style="width:25%;padding:0 6px;">
    <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:12px 14px;text-align:center;">
      <div style="color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">${label}</div>
      <div style="color:${color};font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;">${value}</div>
      ${sub ? `<div style="color:#475569;font-size:10px;margin-top:3px;">${sub}</div>` : ''}
    </div>
  </td>`;
}

// ─── main builder ────────────────────────────────────────────────────────────

export function buildReportEmail(params: {
  reportDate: string;
  sections: DeptSection[];
  isTest?: boolean;
}): string {
  const { reportDate, sections, isTest = false } = params;

  const deptBlocks = sections.map(s => {
    const { department, kpi, topPics, priorityBreakdown, oldestCases } = s;

    const priorityCounts = { High: 0, Medium: 0, Low: 0 };
    priorityBreakdown.forEach(p => {
      const k = p.priority as keyof typeof priorityCounts;
      if (k in priorityCounts) priorityCounts[k] = p.count;
    });

    const picRows = topPics.map((p, i) => `
      <tr style="border-bottom:1px solid #1e293b;">
        <td style="padding:10px 10px;text-align:center;">${rankBadge(i)}</td>
        <td style="padding:10px 6px;color:#f1f5f9;font-weight:500;font-size:13px;">${p.name}</td>
        <td style="padding:10px 6px;text-align:center;">
          <span style="color:#f59e0b;font-size:20px;font-weight:700;">${p.openCount}</span>
        </td>
        <td style="padding:10px 6px;">
          ${priorityChip('H', p.highCount, '#ef4444')}${priorityChip('M', p.medCount, '#f97316')}${priorityChip('L', p.lowCount, '#22c55e')}
        </td>
        <td style="padding:10px 6px;text-align:center;">
          <span style="color:${ageColor(p.avgAge)};font-weight:600;font-size:12px;">${p.avgAge}d</span>
        </td>
      </tr>`).join('');

    const oldestRows = oldestCases.map(c => `
      <tr style="border-bottom:1px solid #1e293b;">
        <td style="padding:7px 8px;color:#f59e0b;font-size:11px;font-weight:600;white-space:nowrap;">#${c.caseNumber}</td>
        <td style="padding:7px 8px;color:#94a3b8;font-size:11px;max-width:260px;overflow:hidden;">${c.subject ?? '(no subject)'}</td>
        <td style="padding:7px 8px;color:#64748b;font-size:11px;white-space:nowrap;">${c.picName ?? '—'}</td>
        <td style="padding:7px 8px;text-align:right;white-space:nowrap;">
          <span style="color:${ageColor(c.ageDays)};font-weight:600;font-size:11px;">${c.ageDays}d</span>
        </td>
      </tr>`).join('');

    return `
    <!-- Dept Header -->
    <table width="600" cellpadding="0" cellspacing="0" align="center"
      style="border-collapse:collapse;margin-bottom:4px;">
      <tr>
        <td style="background:#1e293b;border-top:3px solid #f59e0b;border-radius:8px 8px 0 0;padding:14px 20px;">
          <div style="color:#f59e0b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">Department</div>
          <div style="color:#f1f5f9;font-size:17px;font-weight:700;margin-top:2px;">${department}</div>
        </td>
      </tr>
    </table>

    <!-- KPI row -->
    <table width="600" cellpadding="0" cellspacing="0" align="center"
      style="border-collapse:collapse;background:#0f172a;padding:12px 0;margin-bottom:4px;">
      <tr>
        ${kpiCard('Total Open', kpi.totalOpen.toLocaleString(), '', '#f1f5f9')}
        ${kpiCard('Avg Age', `${kpi.avgAge}d`, 'mean days open', kpi.avgAge > 90 ? '#f97316' : '#94a3b8')}
        ${kpiCard('New (7d)', kpi.newThisWeek.toLocaleString(), 'created this week', '#22c55e')}
        ${kpiCard('Closed (7d)', kpi.closedThisWeek.toLocaleString(), 'recently closed', '#38bdf8')}
      </tr>
    </table>

    <!-- Priority Breakdown -->
    <table width="600" cellpadding="0" cellspacing="0" align="center"
      style="border-collapse:collapse;background:#0f172a;margin-bottom:4px;">
      <tr>
        <td style="padding:6px 14px 10px;">
          ${priorityChip('● High', priorityCounts.High, '#ef4444')}
          ${priorityChip('● Medium', priorityCounts.Medium, '#f97316')}
          ${priorityChip('● Low', priorityCounts.Low, '#22c55e')}
        </td>
      </tr>
    </table>

    <!-- Top PICs table (main content) -->
    <table width="600" cellpadding="0" cellspacing="0" align="center"
      style="border-collapse:collapse;background:#0f172a;margin-bottom:4px;">
      <tr>
        <td style="padding:4px 14px 8px;">
          <div style="color:#f59e0b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px;">
            ⚠ Open Case Workload by Assignee
          </div>
          <table width="100%" cellpadding="0" cellspacing="0"
            style="border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:#334155;">
                <th style="padding:8px 10px;color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;text-align:center;width:32px;">#</th>
                <th style="padding:8px 6px;color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;text-align:left;">Assignee</th>
                <th style="padding:8px 6px;color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;text-align:center;">Open</th>
                <th style="padding:8px 6px;color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;">Priority</th>
                <th style="padding:8px 6px;color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;text-align:center;">Avg Age</th>
              </tr>
            </thead>
            <tbody>
              ${picRows || '<tr><td colspan="5" style="padding:16px;color:#475569;text-align:center;font-size:12px;">No open cases</td></tr>'}
            </tbody>
          </table>
        </td>
      </tr>
    </table>

    <!-- Oldest Cases -->
    ${oldestCases.length > 0 ? `
    <table width="600" cellpadding="0" cellspacing="0" align="center"
      style="border-collapse:collapse;background:#0f172a;margin-bottom:18px;">
      <tr>
        <td style="padding:4px 14px 16px;">
          <div style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px;">
            Oldest Open Cases
          </div>
          <table width="100%" cellpadding="0" cellspacing="0"
            style="border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:#334155;">
                <th style="padding:7px 8px;color:#64748b;font-size:10px;text-align:left;">Case #</th>
                <th style="padding:7px 8px;color:#64748b;font-size:10px;text-align:left;">Subject</th>
                <th style="padding:7px 8px;color:#64748b;font-size:10px;text-align:left;">Assignee</th>
                <th style="padding:7px 8px;color:#64748b;font-size:10px;text-align:right;">Age</th>
              </tr>
            </thead>
            <tbody>${oldestRows}</tbody>
          </table>
        </td>
      </tr>
    </table>` : ''}`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>KIOTI Case Dashboard — Weekly Report</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Inter',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:20px 0;">
    <tr><td align="center">

      ${isTest ? `
      <!-- TEST banner -->
      <table width="600" cellpadding="0" cellspacing="0" align="center"
        style="border-collapse:collapse;margin-bottom:8px;">
        <tr>
          <td style="background:#7c3aed;border-radius:6px;padding:8px 16px;text-align:center;
            color:#fff;font-size:12px;font-weight:600;letter-spacing:.04em;">
            🧪 TEST EMAIL — not a scheduled send
          </td>
        </tr>
      </table>` : ''}

      <!-- Header -->
      <table width="600" cellpadding="0" cellspacing="0" align="center"
        style="border-collapse:collapse;background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);
          border-radius:10px 10px 0 0;border-bottom:2px solid #334155;margin-bottom:4px;">
        <tr>
          <td style="padding:22px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="color:#f59e0b;font-size:22px;font-weight:700;letter-spacing:-.02em;">KIOTI</span>
                  <span style="color:#64748b;font-size:14px;"> · Case Dashboard</span>
                  <div style="color:#94a3b8;font-size:12px;margin-top:4px;font-weight:500;">
                    Weekly Report &nbsp;·&nbsp; ${reportDate}
                  </div>
                </td>
                <td style="text-align:right;vertical-align:top;">
                  <span style="background:#f59e0b22;border:1px solid #f59e0b44;color:#f59e0b;
                    font-size:10px;font-weight:700;padding:3px 10px;border-radius:9999px;
                    text-transform:uppercase;letter-spacing:.06em;">Weekly Report</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Department sections -->
      ${deptBlocks}

      <!-- Footer -->
      <table width="600" cellpadding="0" cellspacing="0" align="center"
        style="border-collapse:collapse;background:#1e293b;border-radius:0 0 10px 10px;
          border-top:1px solid #334155;margin-top:4px;">
        <tr>
          <td style="padding:16px 24px;text-align:center;">
            <p style="color:#475569;font-size:11px;margin:0 0 4px;">
              This is an automated report from KIOTI Case Dashboard.
            </p>
            <p style="color:#334155;font-size:10px;margin:0;">
              Sent from <a href="mailto:no-reply@kiotitractor.com"
                style="color:#475569;text-decoration:none;">no-reply@kiotitractor.com</a>
              &nbsp;·&nbsp; Do not reply to this email.
            </p>
          </td>
        </tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;
}
