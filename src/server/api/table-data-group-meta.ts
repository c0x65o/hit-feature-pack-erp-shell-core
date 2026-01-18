import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { extractUserFromRequest } from '../auth';
import { requireActionPermission } from '@hit/feature-pack-auth-core/server/lib/action-check';
import { tableViews, tableViewFilters, tableViewShares, type TableView, type TableViewFilter } from '@/lib/feature-pack-schemas';
import { resolveUserPrincipals, resolveUserOrgScope } from '@hit/feature-pack-auth-core/server/lib/acl-utils';
import { getStaticViewById } from '../lib/static-table-views';
import { buildTableGroupMeta, getEntityByTableId, getTableFromSpec, type GroupByInput, type ViewFilter } from '../lib/tableGroupMeta';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function parseFilterValue(raw: string | null | undefined, valueType?: string | null): any {
  if (raw == null) return null;
  const t = String(valueType || '').toLowerCase();
  const s = String(raw);
  if (t === 'number' || t === 'int' || t === 'integer' || t === 'float') {
    const n = Number(s);
    return Number.isFinite(n) ? n : s;
  }
  if (t === 'boolean' || t === 'bool') {
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
    return s;
  }
  if (t === 'array' || t === 'json' || t === 'object') {
    try {
      return JSON.parse(s);
    } catch {
      return s;
    }
  }
  return s;
}

async function loadViewForUser(request: NextRequest, viewId: string) {
  const user = extractUserFromRequest(request);
  if (!user) return { error: 'Unauthorized', status: 401 };

  const staticView = getStaticViewById(viewId);
  if (staticView) {
    return {
      view: staticView,
      filters: staticView.filters || [],
      tableId: staticView.tableId,
    };
  }

  const db = getDb();
  const rows = await db.select().from(tableViews).where(sql`${tableViews.id} = ${viewId}`).limit(1);
  const view = Array.isArray(rows) ? rows[0] : null;
  if (!view) return { error: 'View not found', status: 404 };

  if (view.isSystem || view.userId === user.sub) {
    const filters = await db.select().from(tableViewFilters).where(sql`${tableViewFilters.viewId} = ${view.id}`);
    return { view, filters, tableId: view.tableId };
  }

  const principals = await resolveUserPrincipals({ request, user });
  const userGroups = principals.groupIds || [];
  const userRoles = principals.roles || [];
  const orgScope = await resolveUserOrgScope({ request, user });
  const divisionIds = orgScope.divisionIds || [];
  const departmentIds = orgScope.departmentIds || [];
  const locationIds = orgScope.locationIds || [];

  const shareConditions = [
    sql`${tableViewShares.principalType} = 'user' and ${tableViewShares.principalId} = ${user.sub}`,
  ];
  const userEmail = String(user.email || '').trim();
  if (userEmail && userEmail !== user.sub) {
    shareConditions.push(sql`${tableViewShares.principalType} = 'user' and ${tableViewShares.principalId} = ${userEmail}`);
  }
  if (userGroups.length > 0) {
    shareConditions.push(sql`${tableViewShares.principalType} = 'group' and ${tableViewShares.principalId} in (${sql.join(userGroups.map((g) => sql`${g}`), sql`,`)})`);
  }
  if (userRoles.length > 0) {
    shareConditions.push(sql`${tableViewShares.principalType} = 'role' and ${tableViewShares.principalId} in (${sql.join(userRoles.map((r) => sql`${r}`), sql`,`)})`);
  }
  if (divisionIds.length > 0) {
    shareConditions.push(sql`${tableViewShares.principalType}::text = ${'division'} and ${tableViewShares.principalId} in (${sql.join(divisionIds.map((d) => sql`${d}`), sql`,`)})`);
  }
  if (departmentIds.length > 0) {
    shareConditions.push(sql`${tableViewShares.principalType}::text = ${'department'} and ${tableViewShares.principalId} in (${sql.join(departmentIds.map((d) => sql`${d}`), sql`,`)})`);
  }
  if (locationIds.length > 0) {
    shareConditions.push(sql`${tableViewShares.principalType}::text = ${'location'} and ${tableViewShares.principalId} in (${sql.join(locationIds.map((l) => sql`${l}`), sql`,`)})`);
  }

  const shareRows = await db
    .select({ id: tableViewShares.id })
    .from(tableViewShares)
    .where(sql`${tableViewShares.viewId} = ${view.id} and (${sql.join(shareConditions, sql` or `)})`)
    .limit(1);
  if (!shareRows || shareRows.length === 0) {
    return { error: 'Forbidden', status: 403 };
  }

  const filters = await db.select().from(tableViewFilters).where(sql`${tableViewFilters.viewId} = ${view.id}`);
  return { view, filters, tableId: view.tableId };
}

export async function POST(request: NextRequest) {
  const user = extractUserFromRequest(request);
  if (!user) return jsonError('Unauthorized', 401);

  const body = (await request.json().catch(() => null)) as
    | {
        viewId?: unknown;
        tableId?: unknown;
        groupBy?: GroupByInput;
        filters?: ViewFilter[];
        filterMode?: string;
        search?: string;
        includeRows?: unknown;
        groupPageSize?: unknown;
      }
    | null;
  if (!body) return jsonError('Invalid JSON body', 400);

  const viewId = typeof body.viewId === 'string' ? body.viewId.trim() : '';
  const tableIdInput = typeof body.tableId === 'string' ? body.tableId.trim() : '';
  let view: TableView | null = null;
  let tableId = tableIdInput;
  let groupBy = (body.groupBy && typeof body.groupBy === 'object' ? body.groupBy : {}) as GroupByInput;
  let groupByField = typeof groupBy.field === 'string' ? groupBy.field.trim() : '';
  let filters = Array.isArray(body.filters) ? body.filters : [];
  let filterMode: 'all' | 'any' = body.filterMode === 'any' ? 'any' : 'all';

  if (viewId) {
    const loaded = await loadViewForUser(request, viewId);
    if ((loaded as any).error) {
      return jsonError((loaded as any).error, (loaded as any).status || 400);
    }
    view = (loaded as any).view;
    tableId = String((loaded as any).tableId || '');
    const vFilters = Array.isArray((loaded as any).filters) ? (loaded as any).filters : [];
    filters = vFilters.map((f: TableViewFilter) => ({
      field: String(f.field || ''),
      operator: String(f.operator || ''),
      value: parseFilterValue(f.value, f.valueType),
    })).filter((f: ViewFilter) => f.field && f.operator);
    const modeRaw = (view?.metadata as any)?.filterMode;
    filterMode = modeRaw === 'any' ? 'any' : 'all';
    if (view?.groupBy && typeof view.groupBy === 'object') {
      groupBy = view.groupBy as GroupByInput;
      groupByField = typeof groupBy.field === 'string' ? groupBy.field.trim() : '';
    }
  }

  if (!tableId) return jsonError('Missing tableId', 400);
  if (!groupByField) return jsonError('Missing groupBy.field', 400);

  const entity = getEntityByTableId(tableId);
  if (!entity) return jsonError(`Unknown tableId=${tableId}`, 404);

  const uiSpec = entity.spec;
  const table = getTableFromSpec(uiSpec);
  if (!table) return jsonError('Missing storage.drizzleTable', 500);

  const security = (uiSpec && typeof uiSpec === 'object' ? (uiSpec as any).security : null) || {};
  const listAuthz = security?.list?.authz || null;
  const requireAction = listAuthz?.require_action;
  if (requireAction) {
    const denied = await requireActionPermission(request, String(requireAction), { logPrefix: 'GroupMeta' });
    if (denied) return denied;
  }

  const search = typeof body.search === 'string' ? body.search.trim() : '';
  const includeRows = body.includeRows === true;
  const groupPageSizeRaw = Number(body.groupPageSize || 10000);
  const groupPageSize = Math.min(10000, Math.max(1, Number.isFinite(groupPageSizeRaw) ? groupPageSizeRaw : 10000));

  const result = await buildTableGroupMeta({
    tableId,
    groupBy,
    filters,
    filterMode,
    search,
    includeRows,
    groupPageSize,
    view: view ? { sorting: view.sorting as Array<{ id?: string; desc?: boolean }> | undefined } : null,
    currentUserId: user.sub || null,
    entity,
    table,
  });

  if ('error' in result) {
    return jsonError(result.error, result.status);
  }

  return NextResponse.json(result);
}
