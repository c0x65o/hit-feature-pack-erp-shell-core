import { sql } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
function asNonEmptyString(x) {
    return typeof x === 'string' ? x.trim() : '';
}
function isSafeIdent(x) {
    // conservative: unquoted identifiers only
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(x);
}
function quoteIdent(ident) {
    // ident is already validated by isSafeIdent
    return `"${ident}"`;
}
export function getTableProviderRegistryFromRequest(request) {
    const user = extractUserFromRequest(request);
    const raw = user?.featurePacks || {};
    const dash = raw?.['dashboard-shell'] || raw?.dashboardShell || raw?.dashboard_shell || {};
    const options = dash?.options || {};
    const providers = options?.tableProviders || options?.table_providers || {};
    const reg = {};
    // Built-in defaults (safe + minimal). Apps can override/extend via config.
    reg.projects = { kind: 'db_table', table: 'projects', idColumn: 'id', idType: 'uuid' };
    if (providers && typeof providers === 'object') {
        for (const [tableIdRaw, cfg] of Object.entries(providers)) {
            const tableId = asNonEmptyString(tableIdRaw);
            if (!tableId)
                continue;
            if (!cfg || typeof cfg !== 'object')
                continue;
            const kind = asNonEmptyString(cfg.kind);
            if (kind !== 'db_table')
                continue;
            const table = asNonEmptyString(cfg.table);
            const idColumn = asNonEmptyString(cfg.idColumn);
            const idType = asNonEmptyString(cfg.idType);
            const columnsRaw = cfg.columns;
            const columns = Array.isArray(columnsRaw) ? columnsRaw.map((c) => asNonEmptyString(c)).filter(Boolean) : undefined;
            if (!table || !idColumn)
                continue;
            if (!isSafeIdent(table) || !isSafeIdent(idColumn))
                continue;
            if (columns && columns.some((c) => !isSafeIdent(c)))
                continue;
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
export function requireTableProvider(reg, tableId) {
    const p = reg[tableId];
    return p && typeof p === 'object' ? p : null;
}
export function buildDbTableBatchQuery(provider, ids) {
    const table = asNonEmptyString(provider.table);
    const idColumn = asNonEmptyString(provider.idColumn);
    if (!table || !idColumn)
        throw new Error('Invalid provider');
    if (!isSafeIdent(table) || !isSafeIdent(idColumn))
        throw new Error('Unsafe provider identifiers');
    const colSql = provider.columns && provider.columns.length
        ? sql.raw(provider.columns.map((c) => quoteIdent(c)).join(', '))
        : sql.raw('*');
    const tableSql = sql.raw(quoteIdent(table));
    const idColSql = sql.raw(quoteIdent(idColumn));
    const idTerms = ids
        .map((id) => String(id || '').trim())
        .filter(Boolean)
        .map((id) => (provider.idType === 'uuid' ? sql `${id}::uuid` : sql `${id}`));
    if (idTerms.length === 0) {
        return sql `select ${colSql} from ${tableSql} where false`;
    }
    return sql `select ${colSql} from ${tableSql} where ${idColSql} in (${sql.join(idTerms, sql `, `)})`;
}
