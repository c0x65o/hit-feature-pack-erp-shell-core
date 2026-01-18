import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { extractUserFromRequest } from '../auth';
import { requireActionPermission } from '@hit/feature-pack-auth-core/server/lib/action-check';
import { tableViews, tableViewFilters, tableViewShares } from '@/lib/feature-pack-schemas';
import { resolveUserPrincipals, resolveUserOrgScope } from '@hit/feature-pack-auth-core/server/lib/acl-utils';
import { getStaticViewById } from '../lib/static-table-views';
import { buildTableGroupMeta, getEntityByTableId, getTableFromSpec } from '../lib/tableGroupMeta';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
function parseFilterValue(raw, valueType) {
    if (raw == null)
        return null;
    const t = String(valueType || '').toLowerCase();
    const s = String(raw);
    if (t === 'number' || t === 'int' || t === 'integer' || t === 'float') {
        const n = Number(s);
        return Number.isFinite(n) ? n : s;
    }
    if (t === 'boolean' || t === 'bool') {
        if (s === 'true' || s === '1')
            return true;
        if (s === 'false' || s === '0')
            return false;
        return s;
    }
    if (t === 'array' || t === 'json' || t === 'object') {
        try {
            return JSON.parse(s);
        }
        catch {
            return s;
        }
    }
    return s;
}
async function loadViewForUser(request, viewId) {
    const user = extractUserFromRequest(request);
    if (!user)
        return { error: 'Unauthorized', status: 401 };
    const staticView = getStaticViewById(viewId);
    if (staticView) {
        return {
            view: staticView,
            filters: staticView.filters || [],
            tableId: staticView.tableId,
        };
    }
    const db = getDb();
    const rows = await db.select().from(tableViews).where(sql `${tableViews.id} = ${viewId}`).limit(1);
    const view = Array.isArray(rows) ? rows[0] : null;
    if (!view)
        return { error: 'View not found', status: 404 };
    if (view.isSystem || view.userId === user.sub) {
        const filters = await db.select().from(tableViewFilters).where(sql `${tableViewFilters.viewId} = ${view.id}`);
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
        sql `${tableViewShares.principalType} = 'user' and ${tableViewShares.principalId} = ${user.sub}`,
    ];
    const userEmail = String(user.email || '').trim();
    if (userEmail && userEmail !== user.sub) {
        shareConditions.push(sql `${tableViewShares.principalType} = 'user' and ${tableViewShares.principalId} = ${userEmail}`);
    }
    if (userGroups.length > 0) {
        shareConditions.push(sql `${tableViewShares.principalType} = 'group' and ${tableViewShares.principalId} in (${sql.join(userGroups.map((g) => sql `${g}`), sql `,`)})`);
    }
    if (userRoles.length > 0) {
        shareConditions.push(sql `${tableViewShares.principalType} = 'role' and ${tableViewShares.principalId} in (${sql.join(userRoles.map((r) => sql `${r}`), sql `,`)})`);
    }
    if (divisionIds.length > 0) {
        shareConditions.push(sql `${tableViewShares.principalType}::text = ${'division'} and ${tableViewShares.principalId} in (${sql.join(divisionIds.map((d) => sql `${d}`), sql `,`)})`);
    }
    if (departmentIds.length > 0) {
        shareConditions.push(sql `${tableViewShares.principalType}::text = ${'department'} and ${tableViewShares.principalId} in (${sql.join(departmentIds.map((d) => sql `${d}`), sql `,`)})`);
    }
    if (locationIds.length > 0) {
        shareConditions.push(sql `${tableViewShares.principalType}::text = ${'location'} and ${tableViewShares.principalId} in (${sql.join(locationIds.map((l) => sql `${l}`), sql `,`)})`);
    }
    const shareRows = await db
        .select({ id: tableViewShares.id })
        .from(tableViewShares)
        .where(sql `${tableViewShares.viewId} = ${view.id} and (${sql.join(shareConditions, sql ` or `)})`)
        .limit(1);
    if (!shareRows || shareRows.length === 0) {
        return { error: 'Forbidden', status: 403 };
    }
    const filters = await db.select().from(tableViewFilters).where(sql `${tableViewFilters.viewId} = ${view.id}`);
    return { view, filters, tableId: view.tableId };
}
export async function POST(request) {
    const user = extractUserFromRequest(request);
    if (!user)
        return jsonError('Unauthorized', 401);
    const body = (await request.json().catch(() => null));
    if (!body)
        return jsonError('Invalid JSON body', 400);
    const viewId = typeof body.viewId === 'string' ? body.viewId.trim() : '';
    const tableIdInput = typeof body.tableId === 'string' ? body.tableId.trim() : '';
    let view = null;
    let tableId = tableIdInput;
    let groupBy = (body.groupBy && typeof body.groupBy === 'object' ? body.groupBy : {});
    let groupByField = typeof groupBy.field === 'string' ? groupBy.field.trim() : '';
    let filters = Array.isArray(body.filters) ? body.filters : [];
    let filterMode = body.filterMode === 'any' ? 'any' : 'all';
    if (viewId) {
        const loaded = await loadViewForUser(request, viewId);
        if (loaded.error) {
            return jsonError(loaded.error, loaded.status || 400);
        }
        view = loaded.view;
        tableId = String(loaded.tableId || '');
        const vFilters = Array.isArray(loaded.filters) ? loaded.filters : [];
        filters = vFilters.map((f) => ({
            field: String(f.field || ''),
            operator: String(f.operator || ''),
            value: parseFilterValue(f.value, f.valueType),
        })).filter((f) => f.field && f.operator);
        const modeRaw = view?.metadata?.filterMode;
        filterMode = modeRaw === 'any' ? 'any' : 'all';
        if (view?.groupBy && typeof view.groupBy === 'object') {
            groupBy = view.groupBy;
            groupByField = typeof groupBy.field === 'string' ? groupBy.field.trim() : '';
        }
    }
    if (!tableId)
        return jsonError('Missing tableId', 400);
    if (!groupByField)
        return jsonError('Missing groupBy.field', 400);
    const entity = getEntityByTableId(tableId);
    if (!entity)
        return jsonError(`Unknown tableId=${tableId}`, 404);
    const uiSpec = entity.spec;
    const table = getTableFromSpec(uiSpec);
    if (!table)
        return jsonError('Missing storage.drizzleTable', 500);
    const security = (uiSpec && typeof uiSpec === 'object' ? uiSpec.security : null) || {};
    const listAuthz = security?.list?.authz || null;
    const requireAction = listAuthz?.require_action;
    if (requireAction) {
        const denied = await requireActionPermission(request, String(requireAction), { logPrefix: 'GroupMeta' });
        if (denied)
            return denied;
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
        view: view ? { sorting: view.sorting } : null,
        currentUserId: user.sub || null,
        entity,
        table,
    });
    if ('error' in result) {
        return jsonError(result.error, result.status);
    }
    return NextResponse.json(result);
}
