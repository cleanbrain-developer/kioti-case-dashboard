'use strict';
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const db      = require('./db');
const app     = express();
const PORT           = process.env.PORT || 3000;
const SYNC_MIN       = parseInt(process.env.SYNC_INTERVAL_MIN || '15', 10);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'kioti';

app.use(express.json());

/* ── Salesforce config ── */
const SF = {
  domain      : (process.env.SF_DOMAIN || '').replace(/\/$/, ''),
  clientId    : process.env.SF_CLIENT_ID     || '',
  clientSecret: process.env.SF_CLIENT_SECRET || '',
  username    : process.env.SF_USERNAME      || '',
  password    : process.env.SF_PASSWORD      || '',
  apiVersion  : process.env.SF_API_VERSION   || 'v62.0',
};

function isConfigured() {
  return !!(SF.domain && SF.clientId && SF.clientSecret && SF.username && SF.password);
}

/* ── Token cache ── */
let _token = null, _instanceUrl = null, _tokenExpiry = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;
  const res = await fetch(`${SF.domain}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password', client_id: SF.clientId,
      client_secret: SF.clientSecret, username: SF.username, password: SF.password,
    }),
  }).catch(e => {
    const c = e.cause || e;
    throw new Error(`[${c.code||'ERR'}] SF 연결 실패: ${c.message || e.message}`);
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`SF 인증 실패 (${res.status}): ${data.error_description || data.error}`);
  _token = data.access_token;
  _instanceUrl = data.instance_url || SF.domain;
  _tokenExpiry = Date.now() + 55 * 60 * 1000;
  return _token;
}

async function sfFetch(urlPath, opts = {}) {
  const doReq = tok =>
    fetch(`${_instanceUrl}/services/data/${SF.apiVersion}${urlPath}`, {
      ...opts, headers: { Authorization: `Bearer ${tok}`, ...opts.headers },
    });
  let res = await doReq(await getToken());
  if (res.status === 401) { _token = null; res = await doReq(await getToken()); }
  return res;
}

async function sfQuery(soql) {
  const res = await sfFetch(`/query/?q=${encodeURIComponent(soql)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => [{}]);
    throw new Error((Array.isArray(err) ? err[0]?.message : err.message) || `SOQL failed (${res.status})`);
  }
  return res.json();
}

/* SF 전체 페이지 조회 (2,000건 초과 자동 처리) */
async function sfQueryAll(soql, onProgress) {
  let data = await sfQuery(soql);
  const records = [...data.records];
  onProgress?.(records.length);
  while (data.nextRecordsUrl) {
    const nextPath = data.nextRecordsUrl.replace(`/services/data/${SF.apiVersion}`, '');
    const res = await sfFetch(nextPath);
    data = await res.json();
    records.push(...(data.records || []));
    onProgress?.(records.length);
  }
  return records;
}

/* ── Field discovery ── */
const FIELDS = {
  department    : 'Department__c',
  personInCharge: 'PersonInCharge__c',
  moduleLevel   : 'ModuleLevel__c',
};
const DISCOVER_PATTERNS = {
  department    : ['department', 'dept'],
  personInCharge: ['personincharge', 'incharge', 'charger', 'handler', 'responsible'],
  moduleLevel   : ['modulelevel', 'modlevel', 'module'],
};
let _metaCache = null;

async function discoverFields() {
  if (_metaCache) return _metaCache;
  const res = await sfFetch('/sobjects/Case/describe');
  if (!res.ok) { _metaCache = { fieldLabels: {}, picklists: {}, allCustomFields: [] }; return _metaCache; }
  const { fields = [] } = await res.json();
  for (const [key, patterns] of Object.entries(DISCOVER_PATTERNS)) {
    const scored = fields
      .filter(f => f.name.endsWith('__c'))
      .map(f => {
        const h = (f.name.replace(/__c$/i,'').replace(/_/g,'') + (f.label||'').replace(/\s/g,'')).toLowerCase();
        return { name: f.name, label: f.label, score: patterns.filter(p => h.includes(p)).length };
      })
      .filter(x => x.score > 0).sort((a,b) => b.score - a.score);
    if (scored.length) FIELDS[key] = scored[0].name;
  }
  const fieldLabels = {};
  for (const [key, apiName] of Object.entries(FIELDS)) {
    const f = fields.find(x => x.name === apiName);
    if (f) fieldLabels[key] = f.label;
  }
  const targetPicklists = new Set(['Status', 'Priority', ...Object.values(FIELDS)]);
  const picklists = {};
  for (const f of fields) {
    if (targetPicklists.has(f.name) && f.type === 'picklist' && f.picklistValues?.length) {
      picklists[f.name] = f.picklistValues.filter(v => v.active).map(v => ({ value: v.value, label: v.label }));
    }
  }
  console.log('   ✓ Field discovery done');
  console.log(`     Department: ${FIELDS.department} | PIC: ${FIELDS.personInCharge} | Module: ${FIELDS.moduleLevel}`);
  _metaCache = { fieldLabels, picklists, allCustomFields: fields.filter(f => f.name.endsWith('__c')).map(f => ({ name: f.name, label: f.label, type: f.type })) };
  return _metaCache;
}

/* ── SOQL utils ── */
function soqlEsc(s) { return String(s || '').replace(/'/g, "\\'"); }
function resolveSortField(f) {
  const aliases = { dept: FIELDS.department, pic: FIELDS.personInCharge, module: FIELDS.moduleLevel };
  if (aliases[f]) return aliases[f];
  const safe = new Set(['CaseNumber','Subject','Status','Priority','CreatedDate','LastModifiedDate','Account.Name', FIELDS.department, FIELDS.personInCharge, FIELDS.moduleLevel]);
  return safe.has(f) ? f : 'CreatedDate';
}
function buildWhere(q) {
  const cls = [];
  if (q.search)         cls.push(`(Subject LIKE '%${soqlEsc(q.search)}%' OR CaseNumber LIKE '%${soqlEsc(q.search)}%')`);
  if (q.status)         cls.push(`Status = '${soqlEsc(q.status)}'`);
  if (q.priority)       cls.push(`Priority = '${soqlEsc(q.priority)}'`);
  if (q.department)     cls.push(`${FIELDS.department} LIKE '%${soqlEsc(q.department)}%'`);
  if (q.personInCharge) cls.push(`${FIELDS.personInCharge} LIKE '%${soqlEsc(q.personInCharge)}%'`);
  if (q.moduleLevel)    cls.push(`${FIELDS.moduleLevel} LIKE '%${soqlEsc(q.moduleLevel)}%'`);
  if (q.dateFrom)       cls.push(`CreatedDate >= ${q.dateFrom}`);
  if (q.dateTo)         cls.push(`CreatedDate <= ${q.dateTo}`);
  return cls.length ? 'WHERE ' + cls.join(' AND ') : '';
}

/* ══════════════════════════════════════
   PostgreSQL sync
══════════════════════════════════════ */
let _syncProgress = {
  phase    : 'idle',   // idle | auth | fetching | saving | done | error
  fetched  : 0,
  upserted : 0,
  total    : 0,
  startedAt: null,
  lastResult: null,    // { success, count, duration, error, at }
};

function isSyncing() { return _syncProgress.phase !== 'idle' && _syncProgress.phase !== 'done' && _syncProgress.phase !== 'error'; }

async function upsertCases(records) {
  if (!records.length) return;
  const picRel = FIELDS.personInCharge.replace(/__c$/i, '__r');
  const CHUNK  = 100;
  let done = 0;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk  = records.slice(i, i + CHUNK);
    const values = [];
    const params = [];
    chunk.forEach((r, idx) => {
      const b = idx * 12;
      values.push(`($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},NOW())`);
      params.push(
        r.Id, r.CaseNumber || null, r.Subject || null, r.Status || null, r.Priority || null,
        r[FIELDS.department] || null,
        r[FIELDS.personInCharge] || null,
        r[picRel]?.Name || null,
        r[FIELDS.moduleLevel] || null,
        r.Account?.Name || r['Account.Name'] || null,
        r.CreatedDate ? new Date(r.CreatedDate) : null,
        r.IsClosed === true,
      );
    });
    await db.query(
      `INSERT INTO cases
         (id,case_number,subject,status,priority,department,pic_id,pic_name,module_level,account_name,created_date,is_closed,synced_at)
       VALUES ${values.join(',')}
       ON CONFLICT (id) DO UPDATE SET
         case_number=EXCLUDED.case_number, subject=EXCLUDED.subject,
         status=EXCLUDED.status, priority=EXCLUDED.priority,
         department=EXCLUDED.department, pic_id=EXCLUDED.pic_id,
         pic_name=EXCLUDED.pic_name, module_level=EXCLUDED.module_level,
         account_name=EXCLUDED.account_name, created_date=EXCLUDED.created_date,
         is_closed=EXCLUDED.is_closed, synced_at=EXCLUDED.synced_at`,
      params
    );
    done += chunk.length;
    _syncProgress.upserted = done;
  }
}

async function syncFromSalesforce() {
  if (isSyncing()) { console.log('[Sync] Already in progress, skipping'); return null; }
  if (!isConfigured()) { console.log('[Sync] SF not configured'); return null; }

  _syncProgress = { phase: 'auth', fetched: 0, upserted: 0, total: 0, startedAt: Date.now(), lastResult: _syncProgress.lastResult };
  let logId = null;

  try {
    const logRes = await db.query(`INSERT INTO sync_log (status) VALUES ('running') RETURNING id`);
    logId = logRes.rows[0].id;

    await getToken();
    await discoverFields();

    const picRel = FIELDS.personInCharge.replace(/__c$/i, '__r');
    const soql   = [
      'SELECT Id, CaseNumber, Subject, Status, Priority, IsClosed,',
      `${FIELDS.department}, ${FIELDS.personInCharge}, ${picRel}.Name,`,
      `${FIELDS.moduleLevel}, Account.Name, CreatedDate`,
      'FROM Case ORDER BY CreatedDate DESC',
    ].join(' ');

    _syncProgress.phase = 'fetching';
    console.log('[Sync] Fetching cases from Salesforce…');
    const records = await sfQueryAll(soql, n => { _syncProgress.fetched = n; });
    _syncProgress.fetched = records.length;
    _syncProgress.total   = records.length;
    console.log(`[Sync] ${records.length} records fetched`);

    _syncProgress.phase = 'saving';
    await upsertCases(records);

    await db.query(
      `UPDATE sync_log SET ended_at=NOW(), total_synced=$1, status='success' WHERE id=$2`,
      [records.length, logId]
    );
    const duration = Date.now() - _syncProgress.startedAt;
    console.log(`[Sync] Done — ${records.length} cases synced (${(duration/1000).toFixed(1)}s)`);
    _syncProgress.phase      = 'done';
    _syncProgress.lastResult = { success: true, count: records.length, duration, at: new Date().toISOString() };
    return records.length;

  } catch (e) {
    console.error('[Sync] Failed:', e.message);
    if (logId) {
      await db.query(
        `UPDATE sync_log SET ended_at=NOW(), status='error', error_msg=$1 WHERE id=$2`,
        [e.message, logId]
      ).catch(() => {});
    }
    _syncProgress.phase      = 'error';
    _syncProgress.lastResult = { success: false, error: e.message, at: new Date().toISOString() };
    return null;
  }
}

/* 매일 새벽 1시 정각 자동 동기화 스케줄러 */
function scheduleDailySync() {
  const now  = new Date();
  const next = new Date();
  next.setHours(1, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const delay = next - now;
  const label = next.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  console.log(`[Scheduler] Next daily sync: ${label} (in ${Math.round(delay / 60000)} min)`);
  setTimeout(async () => {
    console.log('[Scheduler] Daily 01:00 sync triggered');
    await syncFromSalesforce();
    scheduleDailySync();
  }, delay);
}

/* 15분 간격 백그라운드 동기화 */
function startBackgroundSync() {
  const ms = SYNC_MIN * 60 * 1000;
  setInterval(async () => {
    console.log(`[Sync] Background sync triggered (every ${SYNC_MIN} min)`);
    await syncFromSalesforce();
  }, ms);
}

/* ══════════════════════════════════════
   DB query helpers
══════════════════════════════════════ */
const DB_SORT_MAP = {
  CaseNumber  : 'case_number',
  Subject     : 'subject',
  Status      : 'status',
  Priority    : 'priority',
  dept        : 'department',
  pic         : 'pic_name',
  module      : 'module_level',
  'Account.Name': 'account_name',
  CreatedDate : 'created_date',
};

function buildDBWhere(q) {
  const conds  = [];
  const params = [];
  const add = (cond, val) => { params.push(val); conds.push(cond.replace('?', `$${params.length}`)); };

  if (q.search) {
    params.push(`%${q.search}%`);
    const i = params.length;
    conds.push(`(subject ILIKE $${i} OR case_number ILIKE $${i})`);
  }
  if (q.status)         add('status ILIKE ?',      q.status);
  if (q.priority)       add('priority ILIKE ?',    q.priority);
  if (q.department)     add('department ILIKE ?',  `%${q.department}%`);
  if (q.personInCharge) add('pic_name ILIKE ?',    `%${q.personInCharge}%`);
  if (q.moduleLevel)    add('module_level ILIKE ?',`%${q.moduleLevel}%`);
  if (q.dateFrom)       add('created_date >= ?',   new Date(q.dateFrom));
  if (q.dateTo)         add('created_date <= ?',   new Date(q.dateTo));

  return { where: conds.length ? 'WHERE ' + conds.join(' AND ') : '', params };
}

function dbRowToRecord(r) {
  return {
    Id           : r.id,
    CaseNumber   : r.case_number,
    Subject      : r.subject,
    Status       : r.status,
    Priority     : r.priority,
    IsClosed     : r.is_closed,
    [FIELDS.department]    : r.department,
    [FIELDS.personInCharge]: r.pic_id,
    _picName               : r.pic_name,
    [FIELDS.moduleLevel]   : r.module_level,
    'Account.Name'         : r.account_name,
    CreatedDate  : r.created_date,
  };
}

/* ══════════════════════════════════════
   API Routes
══════════════════════════════════════ */

/* Health */
app.get('/api/health', async (req, res) => {
  const dbOk   = await db.isAvailable();
  const lastSync = await db.getLastSync();
  const caseCount = dbOk ? await db.getCaseCount() : null;

  if (!isConfigured()) {
    return res.json({
      status: 'unconfigured',
      message: '.env에 SF_DOMAIN, SF_CLIENT_ID 등을 입력해주세요.',
      db: { ok: dbOk, caseCount, lastSync },
    });
  }
  try {
    await getToken();
    const meta = await discoverFields();
    res.json({
      status     : 'connected',
      instanceUrl: _instanceUrl,
      fields     : FIELDS,
      fieldLabels: meta.fieldLabels,
      picklists  : meta.picklists,
      db         : { ok: dbOk, caseCount, lastSync, syncingNow: isSyncing() },
    });
  } catch (e) {
    res.status(503).json({ status: 'error', message: e.message, db: { ok: dbOk } });
  }
});

/* Cases — DB 우선, SF 폴백 */
app.get('/api/cases', async (req, res) => {
  if (!isConfigured()) return res.status(503).json({ error: 'Salesforce not configured' });

  const {
    search, status, priority, department, personInCharge, moduleLevel, dateFrom, dateTo,
    page = 1, pageSize = 25, sortField = 'CreatedDate', sortDir = 'DESC',
  } = req.query;

  const safeDir  = sortDir === 'ASC' ? 'ASC' : 'DESC';
  const safeSize = Math.min(Math.max(parseInt(pageSize) || 25, 1), 200);
  const offset   = (Math.max(parseInt(page) || 1, 1) - 1) * safeSize;

  /* ─ DB route ─ */
  if (await db.isAvailable() && await db.getCaseCount() > 0) {
    try {
      const { where, params } = buildDBWhere({ search, status, priority, department, personInCharge, moduleLevel, dateFrom, dateTo });
      const dbCol = DB_SORT_MAP[sortField] || 'created_date';
      const [countRes, rowsRes] = await Promise.all([
        db.query(`SELECT COUNT(*) FROM cases ${where}`, params),
        db.query(`SELECT * FROM cases ${where} ORDER BY ${dbCol} ${safeDir} LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params, safeSize, offset]),
      ]);
      return res.json({
        records   : rowsRes.rows.map(dbRowToRecord),
        totalCount: parseInt(countRes.rows[0].count, 10),
        source    : 'db',
      });
    } catch (e) {
      console.warn('[/api/cases] DB query failed, falling back to SF:', e.message);
    }
  }

  /* ─ SF fallback ─ */
  try {
    const safeSort = resolveSortField(sortField);
    const safeOffset = Math.min(offset, 2000);
    const where = buildWhere({ search, status, priority, department, personInCharge, moduleLevel, dateFrom, dateTo });
    const picRel = FIELDS.personInCharge.replace(/__c$/i, '__r');
    const selectFields = ['Id','CaseNumber','Subject','Status','Priority',
      FIELDS.department, FIELDS.personInCharge, `${picRel}.Name`, FIELDS.moduleLevel,
      'Account.Name','CreatedDate'].join(', ');
    const [casesData, countData] = await Promise.all([
      sfQuery(`SELECT ${selectFields} FROM Case ${where} ORDER BY ${safeSort} ${safeDir} LIMIT ${safeSize} OFFSET ${safeOffset}`),
      sfQuery(`SELECT COUNT() FROM Case ${where}`),
    ]);
    const records = casesData.records.map(r => ({ ...r, _picName: r[picRel]?.Name || null }));
    res.json({ records, totalCount: countData.totalSize, source: 'sf' });
  } catch (e) {
    console.error('[/api/cases]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/* Insights — DB 우선, SF 폴백 */
app.get('/api/insights', async (req, res) => {
  if (!isConfigured()) return res.status(503).json({ error: 'Salesforce not configured' });

  /* ─ DB route ─ */
  if (await db.isAvailable() && await db.getCaseCount() > 0) {
    try {
      const [
        kpiRes, openDeptRes, totalDeptRes, openPicRes,
        statusRes, prioRes, trendRes,
      ] = await Promise.all([
        db.query(`SELECT
          COUNT(*) FILTER (WHERE NOT is_closed)  AS open,
          COUNT(*) FILTER (WHERE status='New')   AS new_cases,
          COUNT(*) FILTER (WHERE status='Escalated') AS escalated,
          COUNT(*)                               AS total
          FROM cases`),
        db.query(`SELECT department AS key, COUNT(*) AS cnt FROM cases WHERE NOT is_closed AND department IS NOT NULL GROUP BY department ORDER BY cnt DESC LIMIT 30`),
        db.query(`SELECT department AS key, COUNT(*) AS cnt FROM cases WHERE department IS NOT NULL GROUP BY department ORDER BY cnt DESC LIMIT 30`),
        db.query(`SELECT pic_name AS key, COUNT(*) AS cnt FROM cases WHERE NOT is_closed AND pic_name IS NOT NULL GROUP BY pic_name ORDER BY cnt DESC LIMIT 20`),
        db.query(`SELECT status, COUNT(*) AS total FROM cases WHERE status IS NOT NULL GROUP BY status ORDER BY total DESC`),
        db.query(`SELECT priority, COUNT(*) AS total FROM cases WHERE NOT is_closed AND priority IS NOT NULL GROUP BY priority ORDER BY total DESC`),
        db.query(`SELECT EXTRACT(YEAR FROM created_date)::int AS yr, EXTRACT(MONTH FROM created_date)::int AS mo, COUNT(*) AS total FROM cases WHERE created_date IS NOT NULL GROUP BY yr, mo ORDER BY yr, mo LIMIT 24`),
      ]);

      const kpi = kpiRes.rows[0];
      const totalDeptMap = {};
      totalDeptRes.rows.forEach(r => { totalDeptMap[r.key] = parseInt(r.cnt); });

      return res.json({
        source: 'db',
        kpi: {
          open     : parseInt(kpi.open),
          newCases : parseInt(kpi.new_cases),
          escalated: parseInt(kpi.escalated),
          total    : parseInt(kpi.total),
          openRate : kpi.total > 0 ? Math.round(kpi.open / kpi.total * 100) : 0,
        },
        openByDept: openDeptRes.rows.map(r => ({
          key  : r.key,
          open : parseInt(r.cnt),
          total: totalDeptMap[r.key] || parseInt(r.cnt),
        })),
        openByPic: openPicRes.rows.map(r => ({ key: r.key, count: parseInt(r.cnt) })),
        status   : statusRes.rows.map(r => ({ Status: r.status, total: parseInt(r.total) })),
        priority : prioRes.rows.map(r => ({ Priority: r.priority, total: parseInt(r.total) })),
        trend    : trendRes.rows.map(r => ({ yr: r.yr, mo: r.mo, total: parseInt(r.total) })),
        totalCount: parseInt(kpi.total),
      });
    } catch (e) {
      console.warn('[/api/insights] DB query failed, falling back to SF:', e.message);
    }
  }

  /* ─ SF fallback ─ */
  try {
    const picRel = FIELDS.personInCharge.replace(/__c$/i, '__r');
    const [sR, pR, openDeptR, totalDeptR, openPicR, tR, openR, newR, escR, totalR] = await Promise.all([
      sfQuery(`SELECT Status, COUNT(Id) total FROM Case GROUP BY Status ORDER BY COUNT(Id) DESC`),
      sfQuery(`SELECT Priority, COUNT(Id) total FROM Case WHERE IsClosed = false GROUP BY Priority`),
      sfQuery(`SELECT ${FIELDS.department}, COUNT(Id) cnt FROM Case WHERE IsClosed = false GROUP BY ${FIELDS.department} ORDER BY COUNT(Id) DESC LIMIT 30`),
      sfQuery(`SELECT ${FIELDS.department}, COUNT(Id) cnt FROM Case GROUP BY ${FIELDS.department} ORDER BY COUNT(Id) DESC LIMIT 30`),
      sfQuery(`SELECT ${picRel}.Name picName, COUNT(Id) cnt FROM Case WHERE IsClosed = false AND ${FIELDS.personInCharge} != null GROUP BY ${picRel}.Name ORDER BY COUNT(Id) DESC LIMIT 20`),
      sfQuery(`SELECT CALENDAR_YEAR(CreatedDate) yr, CALENDAR_MONTH(CreatedDate) mo, COUNT(Id) total FROM Case GROUP BY CALENDAR_YEAR(CreatedDate), CALENDAR_MONTH(CreatedDate) ORDER BY CALENDAR_YEAR(CreatedDate) ASC, CALENDAR_MONTH(CreatedDate) ASC LIMIT 24`),
      sfQuery(`SELECT COUNT() FROM Case WHERE IsClosed = false`),
      sfQuery(`SELECT COUNT() FROM Case WHERE Status = 'New'`),
      sfQuery(`SELECT COUNT() FROM Case WHERE Status = 'Escalated'`),
      sfQuery(`SELECT COUNT() FROM Case`),
    ]);
    const totalDeptMap = {};
    totalDeptR.records.forEach(r => { totalDeptMap[r[FIELDS.department] || 'Unknown'] = r.cnt; });
    res.json({
      source: 'sf',
      kpi: {
        open: openR.totalSize, newCases: newR.totalSize,
        escalated: escR.totalSize, total: totalR.totalSize,
        openRate: totalR.totalSize ? Math.round(openR.totalSize / totalR.totalSize * 100) : 0,
      },
      openByDept: openDeptR.records.map(r => ({ key: r[FIELDS.department] || 'Unknown', open: r.cnt, total: totalDeptMap[r[FIELDS.department] || 'Unknown'] || r.cnt })),
      openByPic : openPicR.records.map(r => ({ key: r[picRel]?.Name || r.picName || 'Unknown', count: r.cnt })),
      status    : sR.records, priority: pR.records, trend: tR.records,
      totalCount: totalR.totalSize,
    });
  } catch (e) {
    console.error('[/api/insights]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/* Insights drill-down */
app.get('/api/insights/drill', async (req, res) => {
  if (!isConfigured()) return res.status(503).json({ error: 'Salesforce not configured' });
  const { department } = req.query;

  /* ─ DB route ─ */
  if (await db.isAvailable() && await db.getCaseCount() > 0) {
    try {
      const params  = [];
      const deptSQL = department ? (params.push(department), `AND department = $${params.length}`) : '';
      const rows = await db.query(
        `SELECT pic_name AS name, COUNT(*) AS count
         FROM cases WHERE NOT is_closed AND pic_name IS NOT NULL ${deptSQL}
         GROUP BY pic_name ORDER BY count DESC LIMIT 20`,
        params
      );
      return res.json({
        department: department || null,
        records: rows.rows.map(r => ({ name: r.name, count: parseInt(r.count) })),
        source: 'db',
      });
    } catch (e) {
      console.warn('[/api/insights/drill] DB failed, falling back to SF:', e.message);
    }
  }

  /* ─ SF fallback ─ */
  try {
    const picRel    = FIELDS.personInCharge.replace(/__c$/i, '__r');
    const deptClause = department ? `AND ${FIELDS.department} = '${soqlEsc(department)}'` : '';
    const data = await sfQuery(
      `SELECT ${picRel}.Name picName, COUNT(Id) cnt FROM Case
       WHERE IsClosed = false ${deptClause} AND ${FIELDS.personInCharge} != null
       GROUP BY ${picRel}.Name ORDER BY COUNT(Id) DESC LIMIT 20`
    );
    res.json({
      department: department || null,
      records: data.records.map(r => ({ name: r[picRel]?.Name || r.picName || 'Unknown', count: r.cnt })),
      source: 'sf',
    });
  } catch (e) {
    console.error('[/api/insights/drill]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/* 수동 동기화 트리거 (비밀번호 필요) */
app.post('/api/sync', async (req, res) => {
  const pwd = req.body?.password;
  if (pwd !== ADMIN_PASSWORD)  return res.status(401).json({ error: 'Unauthorized' });
  if (!isConfigured())         return res.status(503).json({ error: 'Salesforce not configured' });
  if (isSyncing())             return res.status(409).json({ error: 'Sync already in progress' });
  if (!await db.isAvailable()) return res.status(503).json({ error: 'Database not available' });

  res.json({ message: 'Sync started' });
  syncFromSalesforce().catch(e => console.error('[/api/sync]', e.message));
});

/* Sync 진행 상태 조회 */
app.get('/api/sync/status', async (_req, res) => {
  const lastSync  = await db.getLastSync();
  const caseCount = await db.getCaseCount();
  res.json({
    phase    : _syncProgress.phase,
    syncing  : isSyncing(),
    fetched  : _syncProgress.fetched,
    upserted : _syncProgress.upserted,
    total    : _syncProgress.total,
    elapsed  : _syncProgress.startedAt ? Date.now() - _syncProgress.startedAt : null,
    lastResult: _syncProgress.lastResult,
    lastSync,
    caseCount,
  });
});

/* Static */
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

/* ── Start ── */
app.listen(PORT, async () => {
  console.log(`\n⚙  Kioti Case Dashboard`);
  console.log(`   http://localhost:${PORT}`);

  /* DB 연결 확인 */
  const dbOk = await db.isAvailable();
  console.log(`   DB: ${dbOk ? '✓ PostgreSQL connected' : '✗ PostgreSQL not available'}`);

  if (!isConfigured()) {
    console.log('   ⚠  SF 인증정보 미설정 → Demo Mode\n');
    return;
  }

  console.log(`   SF: ${SF.domain}`);

  /* SF 연결 + 필드 탐색 */
  try {
    await getToken();
    console.log('   ✓ Salesforce 인증 성공');
    await discoverFields();
  } catch (e) {
    console.error('\n   ✗ SF 연결 실패:', e.message, '\n');
    return;
  }

  /* DB가 비어있으면 즉시 동기화 */
  if (dbOk) {
    const count = await db.getCaseCount();
    if (count === 0) {
      console.log('   DB empty → initial sync starting…');
      syncFromSalesforce();
    } else {
      console.log(`   DB: ${count.toLocaleString()} cases cached`);
    }
    startBackgroundSync();
    scheduleDailySync();
  }
});
