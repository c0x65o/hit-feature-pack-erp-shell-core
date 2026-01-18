import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
import { requireActionPermission } from '@hit/feature-pack-auth-core/server/lib/action-check';
import { getDb } from '@/lib/db';
import { tableViews, tableViewFilters, tableViewShares } from '@/lib/feature-pack-schemas';
import { resolveUserPrincipals, resolveUserOrgScope } from '@hit/feature-pack-auth-core/server/lib/acl-utils';
import { getStaticViewById } from '../lib/static-table-views';
import { buildTableGroupMeta } from '../lib/tableGroupMeta';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// These are generated in the application, not in feature packs
// Import them conditionally to avoid build errors in feature pack builds
let HIT_UI_SPECS = null;
try {
    // Dynamic import that may not exist in feature pack builds
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const hitUiSpecsModule = require('@/lib/hit-ui-specs.generated');
    HIT_UI_SPECS = hitUiSpecsModule?.HIT_UI_SPECS || null;
}
catch {
    HIT_UI_SPECS = null;
}
const CURRENT_USER_TOKEN = '__current_user__';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
function getEntities() {
    return HIT_UI_SPECS?.entities || {};
}
function getEntitySpec(entityKey) {
    const entities = getEntities();
    const spec = entities?.[entityKey];
    return spec && typeof spec === 'object' ? spec : null;
}
function getEntityByTableId(tableId) {
    const entities = getEntities();
    for (const [entityKey, spec] of Object.entries(entities)) {
        const list = spec?.list;
        const tId = list && typeof list.tableId === 'string' ? list.tableId.trim() : '';
        if (tId && tId === tableId)
            return { entityKey, spec };
    }
    return null;
}
function resolveListEndpoint(entityKey, spec) {
    const api = spec && typeof spec === 'object' ? spec.api : null;
    const baseUrl = api && typeof api === 'object' ? String(api.baseUrl || '').trim() : '';
    if (baseUrl)
        return baseUrl;
    const resource = api && typeof api === 'object' ? String(api.resource || '').trim() : '';
    if (!resource)
        return null;
    const ns = String(entityKey || '').split('.')[0] || '';
    if (!ns)
        return null;
    return `/api/${ns}/${resource}`;
}
async function callSameOrigin(request, path, init) {
    const url = new URL(request.url);
    const target = `${url.origin}${path}`;
    const headers = new Headers(init.headers || {});
    // Forward caller auth (cookies or bearer).
    const auth = request.headers.get('authorization') || request.headers.get('Authorization');
    if (auth)
        headers.set('Authorization', auth);
    const cookie = request.headers.get('cookie') || request.headers.get('Cookie');
    if (cookie)
        headers.set('Cookie', cookie);
    return fetch(target, { ...init, headers });
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
    const requestUser = extractUserFromRequest(request);
    const body = (await request.json().catch(() => null));
    if (!body)
        return jsonError('Invalid JSON body', 400);
    const viewId = typeof body.viewId === 'string' ? body.viewId.trim() : '';
    const tableIdInput = typeof body.tableId === 'string' ? body.tableId.trim() : '';
    let tableId = tableIdInput;
    let view = null;
    let groupBy = (body.groupBy && typeof body.groupBy === 'object' ? body.groupBy : {});
    let groupByField = typeof groupBy.field === 'string' ? groupBy.field.trim() : '';
    let filters = Array.isArray(body.filters) ? body.filters : [];
    let filterMode = body.filterMode === 'any' ? 'any' : 'all';
    let sortBy = typeof body.sortBy === 'string' ? body.sortBy.trim() : '';
    let sortOrder = body.sortOrder === 'desc' ? 'desc' : 'asc';
    if (viewId) {
        const loaded = await loadViewForUser(request, viewId);
        if (loaded.error) {
            return jsonError(loaded.error, loaded.status || 400);
        }
        view = loaded.view;
        tableId = String(loaded.tableId || '');
        const vFilters = Array.isArray(loaded.filters) ? loaded.filters : [];
        const parsedFilters = vFilters
            .map((f) => ({
            field: String(f.field || ''),
            operator: String(f.operator || ''),
            value: parseFilterValue(f.value, f.valueType),
        }))
            .filter((f) => f.field && f.operator);
        if (filters.length === 0) {
            filters = parsedFilters;
        }
        const modeRaw = view?.metadata?.filterMode;
        if (!body.filterMode) {
            filterMode = modeRaw === 'any' ? 'any' : 'all';
        }
        if (view?.groupBy && typeof view.groupBy === 'object') {
            groupBy = view.groupBy;
            groupByField = typeof groupBy.field === 'string' ? groupBy.field.trim() : '';
        }
        if (!sortBy && Array.isArray(view?.sorting) && view.sorting.length > 0) {
            const first = view.sorting[0];
            sortBy = String(first?.id || '');
            sortOrder = first?.desc ? 'desc' : 'asc';
        }
    }
    if (!tableId)
        return jsonError('Missing tableId', 400);
    const entity = getEntityByTableId(tableId);
    if (!entity)
        return jsonError(`Unknown tableId=${tableId}`, 404);
    const uiSpec = entity.spec;
    const security = (uiSpec && typeof uiSpec === 'object' ? uiSpec.security : null) || {};
    const listAuthz = security?.list?.authz || null;
    const requireAction = listAuthz?.require_action;
    if (requireAction) {
        const denied = await requireActionPermission(request, String(requireAction), { logPrefix: 'TableDataQuery' });
        if (denied)
            return denied;
    }
    const search = typeof body.search === 'string' ? body.search.trim() : '';
    const pageRaw = Number(body.page || 1);
    const pageSizeRaw = Number(body.pageSize || 25);
    const page = Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1);
    const pageSize = Math.min(200, Math.max(1, Number.isFinite(pageSizeRaw) ? pageSizeRaw : 25));
    const includeGroups = groupByField && body.includeGroups !== false;
    if (includeGroups) {
        const groupPageSizeRaw = Number(body.groupPageSize || 10000);
        const groupPageSize = Math.min(10000, Math.max(1, Number.isFinite(groupPageSizeRaw) ? groupPageSizeRaw : 10000));
        const groupResult = await buildTableGroupMeta({
            tableId,
            groupBy,
            filters,
            filterMode,
            search,
            includeRows: true,
            groupPageSize,
            view: view ? { sorting: view.sorting } : null,
            currentUserId: requestUser?.sub || null,
            entity,
        });
        if ('error' in groupResult) {
            return NextResponse.json({ error: groupResult.error }, { status: groupResult.status });
        }
        const groupsRaw = Array.isArray(groupResult?.groups) ? groupResult.groups : [];
        const items = groupsRaw.flatMap((g) => (Array.isArray(g?.rows) ? g.rows : []));
        return NextResponse.json({
            ...groupResult,
            tableId,
            viewId: viewId || null,
            items,
            pagination: {
                page: 1,
                pageSize: items.length,
                total: items.length,
                totalPages: 1,
            },
        });
    }
    const listEndpoint = resolveListEndpoint(entity.entityKey, uiSpec);
    if (!listEndpoint)
        return jsonError('Missing api.baseUrl or api.resource', 400);
    const qp = new URLSearchParams();
    qp.set('page', String(page));
    qp.set('pageSize', String(pageSize));
    if (search)
        qp.set('search', search);
    if (sortBy)
        qp.set('sortBy', sortBy);
    if (sortOrder)
        qp.set('sortOrder', sortOrder);
    if (filters.length > 0)
        qp.set('filters', JSON.stringify(filters));
    if (filters.length > 0)
        qp.set('filterMode', filterMode);
    const path = `${listEndpoint}${listEndpoint.includes('?') ? '&' : '?'}${qp.toString()}`;
    const res = await callSameOrigin(request, path, { method: 'GET' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        return NextResponse.json(json?.error ? json : { error: 'Failed to load data' }, { status: res.status });
    }
    const items = Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json?.data?.items)
            ? json.data.items
            : Array.isArray(json)
                ? json
                : [];
    const pagination = json?.pagination || json?.data?.pagination || {
        page,
        pageSize,
        total: Array.isArray(items) ? items.length : 0,
        totalPages: 1,
    };
    return NextResponse.json({
        ...json,
        tableId,
        viewId: viewId || null,
        items,
        pagination,
    });
}
