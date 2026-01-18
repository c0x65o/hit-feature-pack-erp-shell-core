import { NextResponse } from 'next/server';
import { sql, and, or, eq, ne, ilike, notIlike, gt, lt, gte, lte, inArray, isNull, isNotNull } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { extractUserFromRequest } from '../auth';
import { requireActionPermission } from '@hit/feature-pack-auth-core/server/lib/action-check';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// These are generated in the application, not in feature packs
// Import them conditionally to avoid build errors in feature pack builds
let schema = null;
let HIT_UI_SPECS = null;
try {
    // Dynamic imports that may not exist in feature pack builds
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    schema = require('@/lib/schema');
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const hitUiSpecsModule = require('@/lib/hit-ui-specs.generated');
    HIT_UI_SPECS = hitUiSpecsModule?.HIT_UI_SPECS || null;
}
catch {
    // Files don't exist in feature pack builds, which is fine
    schema = null;
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
function getTableFromSpec(spec) {
    if (!schema)
        return null;
    const storage = spec && typeof spec === 'object' ? spec.storage : null;
    const tableName = (storage && typeof storage.drizzleTable === 'string' ? storage.drizzleTable : '') ||
        (typeof spec.drizzleTable === 'string' ? String(spec.drizzleTable) : '');
    if (!tableName)
        return null;
    return schema[tableName] || null;
}
function resolveEntityKeyFromOptionSource(source) {
    const s = String(source || '').trim();
    if (!s)
        return null;
    const entities = getEntities();
    if (entities && typeof entities === 'object' && entities[s])
        return s;
    const parts = s.split('.');
    if (parts.length !== 2)
        return null;
    const ns = parts[0];
    let name = parts[1];
    if (name.endsWith('ies'))
        name = `${name.slice(0, -3)}y`;
    else if (name.endsWith('s'))
        name = name.slice(0, -1);
    const candidate = `${ns}.${name}`;
    if (entities && typeof entities === 'object' && entities[candidate])
        return candidate;
    return null;
}
function inferLabelFieldFromEntitySpec(entityKey) {
    const ent = getEntities()?.[entityKey] || null;
    const fields = ent && typeof ent === 'object' ? ent.fields : null;
    const fm = fields && typeof fields === 'object' ? fields : {};
    for (const k of ['name', 'title', 'label', 'code', 'id']) {
        if (fm && typeof fm === 'object' && fm[k])
            return k;
    }
    return 'name';
}
function pickOrderField(table) {
    if (!table || typeof table !== 'object')
        return null;
    if (table.sortOrder)
        return 'sortOrder';
    if (table.order)
        return 'order';
    if (table.level)
        return 'level';
    return null;
}
function resolveGroupByField(spec, requestedField) {
    if (!spec || typeof spec !== 'object')
        return null;
    const fields = spec.fields;
    if (!fields || typeof fields !== 'object')
        return null;
    const direct = fields[requestedField];
    if (direct && typeof direct === 'object') {
        const labelFromRow = direct?.labelFromRow || direct?.reference?.labelFromRow || null;
        const optionSourceKey = String(direct?.optionSource || '').trim() || null;
        const referenceEntity = String(direct?.reference?.entityType || '').trim() || null;
        return { fieldKey: requestedField, fieldSpec: direct, labelFromRow, optionSourceKey, referenceEntity };
    }
    for (const [fieldKey, fsAny] of Object.entries(fields)) {
        const fs = fsAny && typeof fsAny === 'object' ? fsAny : null;
        if (!fs)
            continue;
        const labelFromRow = fs?.labelFromRow || fs?.reference?.labelFromRow || null;
        if (labelFromRow && String(labelFromRow).trim() === requestedField) {
            const optionSourceKey = String(fs?.optionSource || '').trim() || null;
            const referenceEntity = String(fs?.reference?.entityType || '').trim() || null;
            return { fieldKey: String(fieldKey), fieldSpec: fs, labelFromRow: String(labelFromRow), optionSourceKey, referenceEntity };
        }
    }
    return null;
}
async function loadOptionSourceMap(optionSource, labelKeyOverride) {
    const entityKey = resolveEntityKeyFromOptionSource(optionSource);
    if (!entityKey)
        return { labelMap: {}, orderMap: {} };
    const spec = getEntitySpec(entityKey);
    const table = spec ? getTableFromSpec(spec) : null;
    if (!table)
        return { labelMap: {}, orderMap: {} };
    const idCol = table.id;
    const labelField = labelKeyOverride || inferLabelFieldFromEntitySpec(entityKey);
    const labelCol = table[labelField];
    if (!idCol || !labelCol)
        return { labelMap: {}, orderMap: {} };
    const orderField = pickOrderField(table);
    const orderCol = orderField ? table[orderField] : null;
    const db = getDb();
    const rows = await db
        .select({
        id: idCol,
        label: labelCol,
        sortOrder: orderCol ?? sql `null`,
    })
        .from(table);
    const labelMap = {};
    const orderMap = {};
    for (const r of rows) {
        if (r?.id == null)
            continue;
        const key = String(r.id);
        if (r.label != null)
            labelMap[key] = String(r.label);
        if (r.sortOrder != null) {
            const n = Number(r.sortOrder);
            if (Number.isFinite(n))
                orderMap[key] = n;
        }
    }
    return { labelMap, orderMap };
}
function buildFilterCondition(filter, columnMap, ctx) {
    const column = columnMap[filter.field];
    if (!column)
        return null;
    const { operator } = filter;
    let value = filter.value;
    if (value === CURRENT_USER_TOKEN) {
        value = ctx?.currentUserId ?? null;
    }
    else if (Array.isArray(value) && value.includes(CURRENT_USER_TOKEN)) {
        const resolved = ctx?.currentUserId ?? null;
        value = value.map((v) => (v === CURRENT_USER_TOKEN ? resolved : v));
    }
    if (value === null || value === undefined || value === '') {
        if (operator === 'isTrue')
            return eq(column, sql `true`);
        if (operator === 'isFalse')
            return eq(column, sql `false`);
        if (operator === 'isEmpty' || operator === 'isNull')
            return isNull(column);
        if (operator === 'isNotEmpty' || operator === 'isNotNull')
            return isNotNull(column);
        return null;
    }
    if (Array.isArray(value)) {
        if (value.length === 0)
            return null;
        const strValues = value.map((v) => String(v));
        switch (operator) {
            case 'equals':
            case 'in':
                return inArray(column, strValues);
            case 'notEquals':
            case 'notIn':
                return sql `${column} NOT IN (${sql.join(strValues.map((v) => sql `${v}`), sql `,`)})`;
            default:
                return inArray(column, strValues);
        }
    }
    const strValue = String(value);
    switch (operator) {
        case 'equals':
            return eq(column, strValue);
        case 'notEquals':
            return ne(column, strValue);
        case 'contains':
            return ilike(column, `%${strValue}%`);
        case 'notContains':
            return notIlike(column, `%${strValue}%`);
        case 'startsWith':
            return ilike(column, `${strValue}%`);
        case 'endsWith':
            return ilike(column, `%${strValue}`);
        case 'dateEquals':
            return eq(column, strValue);
        case 'dateBefore':
            return lt(column, strValue);
        case 'dateAfter':
            return gt(column, strValue);
        case 'dateBetween': {
            let fromRaw = null;
            let toRaw = null;
            try {
                const parsed = typeof value === 'string' ? JSON.parse(value) : value;
                if (parsed && typeof parsed === 'object') {
                    fromRaw = parsed.from ?? parsed.start ?? null;
                    toRaw = parsed.to ?? parsed.end ?? null;
                }
            }
            catch {
                const s = String(value || '');
                const sep = s.includes('..') ? '..' : s.includes(',') ? ',' : null;
                if (sep) {
                    const [a, b] = s.split(sep).map((x) => x.trim());
                    fromRaw = a || null;
                    toRaw = b || null;
                }
            }
            const parts = [];
            if (fromRaw)
                parts.push(gte(column, String(fromRaw)));
            if (toRaw)
                parts.push(lte(column, String(toRaw)));
            if (parts.length === 0)
                return null;
            if (parts.length === 1)
                return parts[0];
            return and(...parts) ?? null;
        }
        case 'greaterThan':
            return gt(column, strValue);
        case 'lessThan':
            return lt(column, strValue);
        case 'greaterThanOrEqual':
            return gte(column, strValue);
        case 'lessThanOrEqual':
            return lte(column, strValue);
        case 'isEmpty':
        case 'isNull':
            return isNull(column);
        case 'isNotEmpty':
        case 'isNotNull':
            return isNotNull(column);
        case 'isTrue':
            return eq(column, sql `true`);
        case 'isFalse':
            return eq(column, sql `false`);
        default:
            if (typeof value === 'string') {
                return ilike(column, `%${strValue}%`);
            }
            return eq(column, strValue);
    }
}
function buildFiltersCondition(filters, columnMap, filterMode = 'all', ctx) {
    const conditions = filters
        .map((filter) => buildFilterCondition(filter, columnMap, ctx))
        .filter((c) => Boolean(c));
    if (conditions.length === 0)
        return undefined;
    return filterMode === 'any' ? or(...conditions) : and(...conditions);
}
function safeLabelKey(key) {
    if (key == null)
        return '';
    const s = String(key);
    return s.trim();
}
export async function POST(request) {
    const user = extractUserFromRequest(request);
    if (!user)
        return jsonError('Unauthorized', 401);
    const body = (await request.json().catch(() => null));
    if (!body)
        return jsonError('Invalid JSON body', 400);
    const tableId = typeof body.tableId === 'string' ? body.tableId.trim() : '';
    const groupBy = (body.groupBy && typeof body.groupBy === 'object' ? body.groupBy : {});
    const groupByField = typeof groupBy.field === 'string' ? groupBy.field.trim() : '';
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
    const groupByResolved = resolveGroupByField(uiSpec, groupByField);
    const effectiveField = groupByResolved?.fieldKey || groupByField;
    const groupCol = table[effectiveField];
    if (!groupCol)
        return jsonError(`Unknown groupBy field: ${groupByField}`, 400);
    const filters = Array.isArray(body.filters) ? body.filters : [];
    const filterMode = body.filterMode === 'any' ? 'any' : 'all';
    const search = typeof body.search === 'string' ? body.search.trim() : '';
    const columnMap = {};
    const fields = (uiSpec && typeof uiSpec === 'object' ? uiSpec.fields : null) || {};
    for (const fieldKey of Object.keys(fields)) {
        const col = table[fieldKey];
        if (col)
            columnMap[fieldKey] = col;
    }
    const conditions = [];
    const filtersCondition = buildFiltersCondition(filters, columnMap, filterMode, { currentUserId: user.sub || null });
    if (filtersCondition)
        conditions.push(filtersCondition);
    if (search) {
        const searchCols = [];
        for (const key of ['name', 'title', 'label', 'displayName']) {
            const col = table[key];
            if (col)
                searchCols.push(col);
        }
        if (searchCols.length > 0) {
            const searchCond = or(...searchCols.map((col) => ilike(col, `%${search}%`)));
            if (searchCond)
                conditions.push(searchCond);
        }
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const db = getDb();
    const groupExpr = sql `coalesce(${groupCol}, '')`;
    const rows = whereClause
        ? await db.select({ groupValue: groupExpr, count: sql `count(*)` }).from(table).where(whereClause).groupBy(groupCol)
        : await db.select({ groupValue: groupExpr, count: sql `count(*)` }).from(table).groupBy(groupCol);
    const fieldSpec = groupByResolved?.fieldSpec || fields?.[groupByField] || {};
    const optionSource = String(fieldSpec?.optionSource || '').trim();
    const referenceEntity = String(fieldSpec?.reference?.entityType || '').trim();
    const labelFromRow = String(groupByResolved?.labelFromRow || '').trim();
    const labelEntityKey = referenceEntity || (optionSource ? resolveEntityKeyFromOptionSource(optionSource) : null);
    const labelEntitySpec = labelEntityKey ? getEntitySpec(labelEntityKey) : null;
    const labelEntityFields = labelEntitySpec && typeof labelEntitySpec === 'object' ? labelEntitySpec.fields : null;
    const labelKeyOverride = labelFromRow && labelEntityFields && typeof labelEntityFields === 'object' && labelEntityFields[labelFromRow]
        ? labelFromRow
        : null;
    const optionSourceKey = optionSource || (labelEntityKey ? labelEntityKey : '');
    const { labelMap, orderMap } = optionSourceKey
        ? await loadOptionSourceMap(optionSourceKey, labelKeyOverride)
        : { labelMap: {}, orderMap: {} };
    const groupCounts = {};
    const entries = rows.map((row) => {
        const id = row?.groupValue == null ? '' : String(row.groupValue);
        const label = labelMap[id] ?? id;
        const key = safeLabelKey(label);
        const count = Number(row?.count ?? 0) || 0;
        groupCounts[key] = (groupCounts[key] ?? 0) + count;
        const sortOrder = Number.isFinite(orderMap[id]) ? orderMap[id] : null;
        return { key, count, sortOrder };
    });
    const orderByRaw = groupBy.orderBy || 'auto';
    const orderDirectionRaw = groupBy.orderDirection || '';
    let orderDirection = orderDirectionRaw === 'desc' ? 'desc' : 'asc';
    if (!orderDirectionRaw && orderByRaw === 'count')
        orderDirection = 'desc';
    const dir = orderDirection === 'desc' ? -1 : 1;
    const hasRelatedOrder = entries.some((e) => Number.isFinite(e.sortOrder));
    const effectiveOrderBy = orderByRaw === 'auto'
        ? (hasRelatedOrder ? 'relatedSortOrder' : 'value')
        : orderByRaw;
    const compareKeys = (a, b) => {
        if (!a && !b)
            return 0;
        if (!a)
            return 1;
        if (!b)
            return -1;
        return a.localeCompare(b);
    };
    const sorted = entries.slice();
    if (effectiveOrderBy === 'count') {
        sorted.sort((a, b) => {
            if (a.count !== b.count)
                return dir * (a.count - b.count);
            return compareKeys(a.key, b.key);
        });
    }
    else if (effectiveOrderBy === 'relatedSortOrder' && hasRelatedOrder) {
        sorted.sort((a, b) => {
            const aSort = Number.isFinite(a.sortOrder) ? a.sortOrder : null;
            const bSort = Number.isFinite(b.sortOrder) ? b.sortOrder : null;
            if (aSort !== null || bSort !== null) {
                if (aSort == null)
                    return 1;
                if (bSort == null)
                    return -1;
                if (aSort !== bSort)
                    return dir * (aSort - bSort);
            }
            return compareKeys(a.key, b.key);
        });
    }
    else {
        sorted.sort((a, b) => dir * compareKeys(a.key, b.key));
    }
    const groupOrder = sorted.map((e) => e.key);
    return NextResponse.json({
        tableId,
        groupBy: {
            field: groupByField,
            orderBy: orderByRaw,
            orderDirection,
        },
        groupCounts,
        groupOrder,
    });
}
