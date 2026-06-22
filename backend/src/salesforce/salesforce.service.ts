import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SfFields {
  department: string;
  personInCharge: string;
  moduleLevel: string;
}

export interface SfMeta {
  fieldLabels: Record<string, string>;
  picklists: Record<string, Array<{ value: string; label: string }>>;
  fields: SfFields;
}

@Injectable()
export class SalesforceService {
  private readonly logger = new Logger(SalesforceService.name);

  private token: string | null = null;
  private instanceUrl: string | null = null;
  private tokenExpiry = 0;
  private metaCache: SfMeta | null = null;

  readonly fields: SfFields = {
    department    : 'Department__c',
    personInCharge: 'PersonInCharge__c',
    moduleLevel   : 'ModuleLevel__c',
  };

  private readonly discoverPatterns = {
    department    : ['department', 'dept'],
    personInCharge: ['personincharge', 'incharge', 'charger', 'handler', 'responsible'],
    moduleLevel   : ['modulelevel', 'modlevel', 'module'],
  };

  constructor(private config: ConfigService) {}

  isConfigured(): boolean {
    return !!(
      this.config.get('SF_DOMAIN') &&
      this.config.get('SF_CLIENT_ID') &&
      this.config.get('SF_CLIENT_SECRET') &&
      this.config.get('SF_USERNAME') &&
      this.config.get('SF_PASSWORD')
    );
  }

  getInstanceUrl(): string | null { return this.instanceUrl; }

  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry) return this.token;

    const domain = this.config.get<string>('SF_DOMAIN')!.replace(/\/$/, '');
    const body = new URLSearchParams({
      grant_type   : 'password',
      client_id    : this.config.get('SF_CLIENT_ID')!,
      client_secret: this.config.get('SF_CLIENT_SECRET')!,
      username     : this.config.get('SF_USERNAME')!,
      password     : this.config.get('SF_PASSWORD')!,
    });

    const res = await fetch(`${domain}/services/oauth2/token`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(`SF auth failed (${res.status}): ${data.error_description || data.error}`);

    this.token       = data.access_token;
    this.instanceUrl = data.instance_url || domain;
    this.tokenExpiry = Date.now() + 55 * 60 * 1000;
    return this.token!;
  }

  async fetch(urlPath: string, opts: RequestInit = {}): Promise<Response> {
    const apiVersion = this.config.get('SF_API_VERSION') || 'v62.0';
    const doReq = (tok: string) =>
      fetch(`${this.instanceUrl}/services/data/${apiVersion}${urlPath}`, {
        ...opts,
        headers: { Authorization: `Bearer ${tok}`, ...(opts.headers as object) },
      });

    let res = await doReq(await this.getToken());
    if (res.status === 401) { this.token = null; res = await doReq(await this.getToken()); }
    return res;
  }

  async query(soql: string): Promise<any> {
    const res = await this.fetch(`/query/?q=${encodeURIComponent(soql)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => [{}]) as any;
      throw new Error((Array.isArray(err) ? err[0]?.message : err.message) || `SOQL failed (${res.status})`);
    }
    return res.json();
  }

  async queryAll(soql: string, onProgress?: (n: number) => void): Promise<any[]> {
    const apiVersion = this.config.get('SF_API_VERSION') || 'v62.0';
    let data = await this.query(soql);
    const records = [...data.records];
    onProgress?.(records.length);

    while (data.nextRecordsUrl) {
      const nextPath = data.nextRecordsUrl.replace(`/services/data/${apiVersion}`, '');
      const res = await this.fetch(nextPath);
      data = await res.json() as any;
      records.push(...(data.records || []));
      onProgress?.(records.length);
    }
    return records;
  }

  async discoverFields(): Promise<SfMeta> {
    if (this.metaCache) return this.metaCache;

    const res = await this.fetch('/sobjects/Case/describe');
    if (!res.ok) {
      this.metaCache = { fieldLabels: {}, picklists: {}, fields: { ...this.fields } };
      return this.metaCache;
    }

    const { fields = [] } = await res.json() as any;
    for (const [key, patterns] of Object.entries(this.discoverPatterns)) {
      const scored = (fields as any[])
        .filter((f: any) => f.name.endsWith('__c'))
        .map((f: any) => {
          const h = (f.name.replace(/__c$/i, '').replace(/_/g, '') + (f.label || '').replace(/\s/g, '')).toLowerCase();
          return { name: f.name, label: f.label, score: (patterns as string[]).filter(p => h.includes(p)).length };
        })
        .filter((x: any) => x.score > 0)
        .sort((a: any, b: any) => b.score - a.score);
      if (scored.length) (this.fields as any)[key] = scored[0].name;
    }

    const fieldLabels: Record<string, string> = {};
    for (const [key, apiName] of Object.entries(this.fields)) {
      const f = (fields as any[]).find((x: any) => x.name === apiName);
      if (f) fieldLabels[key] = f.label;
    }

    const targetPicklists = new Set(['Status', 'Priority', ...Object.values(this.fields)]);
    const picklists: Record<string, Array<{ value: string; label: string }>> = {};
    for (const f of fields as any[]) {
      if (targetPicklists.has(f.name) && f.type === 'picklist' && f.picklistValues?.length) {
        picklists[f.name] = f.picklistValues.filter((v: any) => v.active).map((v: any) => ({ value: v.value, label: v.label }));
      }
    }

    this.logger.log(`Field discovery done — Dept:${this.fields.department} | PIC:${this.fields.personInCharge} | Module:${this.fields.moduleLevel}`);
    this.metaCache = { fieldLabels, picklists, fields: { ...this.fields } };
    return this.metaCache;
  }

  soqlEsc(s: string): string { return String(s || '').replace(/'/g, "\\'"); }

  get picRelField(): string {
    return this.fields.personInCharge.replace(/__c$/i, '__r');
  }
}
