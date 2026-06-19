-- Kioti Case Dashboard — PostgreSQL schema
-- 자동 실행: docker-compose 초기 기동 시 /docker-entrypoint-initdb.d/

CREATE TABLE IF NOT EXISTS cases (
  id           TEXT        PRIMARY KEY,
  case_number  TEXT        NOT NULL,
  subject      TEXT,
  status       TEXT,
  priority     TEXT,
  department   TEXT,
  pic_id       TEXT,           -- Salesforce User ID (005xxx)
  pic_name     TEXT,           -- User 표시 이름
  module_level TEXT,
  account_name TEXT,
  created_date TIMESTAMPTZ,
  is_closed    BOOLEAN     NOT NULL DEFAULT FALSE,
  synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cases_status    ON cases (status);
CREATE INDEX IF NOT EXISTS idx_cases_priority  ON cases (priority);
CREATE INDEX IF NOT EXISTS idx_cases_dept      ON cases (department);
CREATE INDEX IF NOT EXISTS idx_cases_pic_name  ON cases (pic_name);
CREATE INDEX IF NOT EXISTS idx_cases_is_closed ON cases (is_closed);
CREATE INDEX IF NOT EXISTS idx_cases_created   ON cases (created_date DESC);

-- 전문 검색 인덱스 (subject + case_number)
CREATE INDEX IF NOT EXISTS idx_cases_fts ON cases
  USING GIN (to_tsvector('english',
    coalesce(subject, '') || ' ' || coalesce(case_number, '')));

-- SF 동기화 이력
CREATE TABLE IF NOT EXISTS sync_log (
  id           SERIAL      PRIMARY KEY,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at     TIMESTAMPTZ,
  total_synced INTEGER,
  status       TEXT        NOT NULL DEFAULT 'running',  -- running | success | error
  error_msg    TEXT
);

COMMENT ON TABLE cases    IS 'Salesforce Case 레코드 캐시';
COMMENT ON TABLE sync_log IS 'Salesforce 동기화 이력';
