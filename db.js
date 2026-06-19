'use strict';
const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString    : process.env.DATABASE_URL,
      max                 : 10,
      idleTimeoutMillis   : 30000,
      connectionTimeoutMillis: 5000,
    });
    pool.on('error', err => console.error('[DB] Pool error:', err.message));
  }
  return pool;
}

async function query(sql, params = []) {
  const p = getPool();
  if (!p) throw new Error('DATABASE_URL not configured');
  const client = await p.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

async function isAvailable() {
  try {
    const p = getPool();
    if (!p) return false;
    await p.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

async function getLastSync() {
  try {
    const r = await query(
      `SELECT started_at, ended_at, total_synced, status
       FROM sync_log WHERE status = 'success'
       ORDER BY id DESC LIMIT 1`
    );
    return r.rows[0] || null;
  } catch { return null; }
}

async function getCaseCount() {
  try {
    const r = await query('SELECT COUNT(*) FROM cases');
    return parseInt(r.rows[0].count, 10);
  } catch { return 0; }
}

module.exports = { query, isAvailable, getLastSync, getCaseCount };
