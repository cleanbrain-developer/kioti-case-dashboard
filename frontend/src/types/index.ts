export interface CaseRecord {
  Id: string;
  CaseNumber: string;
  Subject: string | null;
  Status: string | null;
  Priority: string | null;
  IsClosed: boolean;
  _picName: string | null;
  'Account.Name': string | null;
  CreatedDate: string | null;
  [key: string]: any;
}

export interface CasesResponse {
  records: CaseRecord[];
  totalCount: number;
  source: 'db' | 'sf';
  sfLimitExceeded?: boolean;
}

export interface KpiData {
  open: number;
  newCases: number;
  escalated: number;
  total: number;
  openRate: number;
}

export interface DeptData { key: string; open: number; total: number; }
export interface PicData  { key: string; count: number; }
export interface TrendData { yr: number; mo: number; total: number; }

export interface InsightsResponse {
  source: 'db' | 'sf';
  kpi: KpiData;
  openByDept: DeptData[];
  openByPic : PicData[];
  status    : Array<{ Status: string; total: number }>;
  priority  : Array<{ Priority: string; total: number }>;
  trend     : TrendData[];
  totalCount: number;
}

export interface DrillRecord { name: string; count: number; }
export interface DrillResponse {
  department: string | null;
  records: DrillRecord[];
  source: 'db' | 'sf';
}

export interface SyncStatus {
  phase    : string;
  syncing  : boolean;
  fetched  : number;
  upserted : number;
  total    : number;
  elapsed  : number | null;
  lastResult: { success: boolean; count?: number; duration?: number; error?: string; at: string } | null;
  lastSync : any;
  caseCount: number;
}

export interface HealthResponse {
  status     : 'connected' | 'unconfigured' | 'error';
  instanceUrl: string;
  fields     : { department: string; personInCharge: string; moduleLevel: string };
  fieldLabels: Record<string, string>;
  picklists  : Record<string, Array<{ value: string; label: string }>>;
  db         : { ok: boolean; caseCount: number | null; lastSync: any; syncingNow: boolean };
}

export interface CasesFilter {
  search       : string;
  status       : string;
  priority     : string;
  department   : string;
  personInCharge: string;
  moduleLevel  : string;
  dateFrom     : string;
  dateTo       : string;
  page         : number;
  pageSize     : number;
  sortField    : string;
  sortDir      : 'ASC' | 'DESC';
}
