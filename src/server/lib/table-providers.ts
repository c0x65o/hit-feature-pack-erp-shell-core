import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { extractUserFromRequest, type User } from '../auth';

type DbTableProvider = {
  kind: 'db_table';
  table: string; // DB table name
  idColumn: string; // primary key column
  idType?: 'uuid' | 'text'; // how to cast inbound ids
  columns?: string[]; // optional allowlist; defaults to "*"
};

export type TableProvider = DbTableProvider;

export type TableProviderRegistry = Record<string, TableProvider>;

function asNonEmptyString(x: unknown): string {
  return typeof x === 'string' ? x.trim() : '';
}

function isSafeIdent(x: string): boolean {
  // conservative: unquoted identifiers only
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(x);
}

function quoteIdent(ident: string): string {
  // ident is already validated by isSafeIdent
  return `"${ident}"`;
}

export function getTableProviderRegistryFromRequest(request: NextRequest): TableProviderRegistry {
  const user = extractUserFromRequest(request) as User | null;
  const raw = (user as any)?.featurePacks || {};
  const dash = raw?.['dashboard-shell'] || raw?.dashboardShell || raw?.dashboard_shell || {};
  const options = dash?.options || {};
  const providers = options?.tableProviders || options?.table_providers || {};
  const reg: TableProviderRegistry = {};

  // Built-in defaults (safe + minimal). Apps can override/extend via config.
  reg.projects = { kind: 'db_table', table: 'projects', idColumn: 'id', idType: 'uuid' };

  if (providers && typeof providers === 'object') {
    for (const [tableIdRaw, cfg] of Object.entries(providers as any)) {
      const tableId = asNonEmptyString(tableIdRaw);
      if (!tableId) continue;
      if (!cfg || typeof cfg !== 'object') continue;
      const kind = asNonEmptyString((cfg as any).kind);
      if (kind !== 'db_table') continue;
      const table = asNonEmptyString((cfg as any).table);
      const idColumn = asNonEmptyString((cfg as any).idColumn);
      const idType = asNonEmptyString((cfg as any).idType);
      const columnsRaw = (cfg as any).columns;
      const columns = Array.isArray(columnsRaw) ? columnsRaw.map((c: any) => asNonEmptyString(c)).filter(Boolean) : undefined;
      if (!table || !idColumn) continue;
      if (!isSafeIdent(table) || !isSafeIdent(idColumn)) continue;
      if (columns && columns.some((c) => !isSafeIdent(c))) continue;

      reg[tableId] = {
        kind: 'db_table',
        table,
        idColumn,
        idType: idType === 'uuid' ? 'uuid' : 'text',
        columns,
      };
    }
  }

  return reg;
}

export function requireTableProvider(reg: TableProviderRegistry, tableId: string): TableProvider | null {
  const p = reg[tableId];
  return p && typeof p === 'object' ? (p as any) : null;
}

export function buildDbTableBatchQuery(provider: DbTableProvider, ids: string[]) {
  const table = asNonEmptyString(provider.table);
  const idColumn = asNonEmptyString(provider.idColumn);
  if (!table || !idColumn) throw new Error('Invalid provider');
  if (!isSafeIdent(table) || !isSafeIdent(idColumn)) throw new Error('Unsafe provider identifiers');

  const colSql = provider.columns && provider.columns.length
    ? sql.raw(provider.columns.map((c) => quoteIdent(c)).join(', '))
    : sql.raw('*');

  const tableSql = sql.raw(quoteIdent(table));
  const idColSql = sql.raw(quoteIdent(idColumn));

  const idTerms = ids
    .map((id) => String(id || '').trim())
    .filter(Boolean)
    .map((id) => (provider.idType === 'uuid' ? sql`${id}::uuid` : sql`${id}`));

  if (idTerms.length === 0) {
    return sql`select ${colSql} from ${tableSql} where false`;
  }

  return sql`select ${colSql} from ${tableSql} where ${idColSql} in (${sql.join(idTerms, sql`, `)})`;
}


