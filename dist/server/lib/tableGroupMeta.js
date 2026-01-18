import { sql, and, or, eq, ne, ilike, notIlike, gt, lt, gte, lte, inArray, isNull, isNotNull, asc, desc, getTableColumns, } from 'drizzle-orm';
import { getDb } from '@/lib/db';
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
function getEntities() {
    return HIT_UI_SPECS?.entities || {};
}
function getEntitySpec(entityKey) {
    const entities = getEntities();
    const spec = entities?.[entityKey];
    return spec && typeof spec === 'object' ? spec : null;
}
export function getEntityByTableId(tableId) {
    const entities = getEntities();
    for (const [entityKey, spec] of Object.entries(entities)) {
        const list = spec?.list;
        const tId = list && typeof list.tableId === 'string' ? list.tableId.trim() : '';
        if (tId && tId === tableId)
            return { entityKey, spec };
    }
    return null;
}
export function getTableFromSpec(spec) {
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
    const directIsVirtual = Boolean(direct && typeof direct === 'object' && direct?.virtual === true);
    if (direct && typeof direct === 'object' && !directIsVirtual) {
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
function isVirtualField(fieldSpec) {
    if (!fieldSpec || typeof fieldSpec !== 'object')
        return false;
    if (fieldSpec.virtual === true)
        return true;
    const storage = fieldSpec.storage;
    if (storage && typeof storage === 'object' && String(storage.mode || '').toLowerCase() === 'virtual') {
        return true;
    }
    return false;
}
function getComputeSpec(fieldSpec) {
    if (!fieldSpec || typeof fieldSpec !== 'object')
        return null;
    const compute = fieldSpec.compute;
    if (!compute || typeof compute !== 'object')
        return null;
    return compute;
}
function resolveEmployeeLddGrouping(entityKey, groupByField) {
    if (entityKey !== 'hrm.employee')
        return null;
    if (!schema)
        return null;
    const assignments = schema.userOrgAssignments;
    const divisions = schema.divisions;
    const departments = schema.departments;
    const locations = schema.locations;
    if (!assignments)
        return null;
    switch (groupByField) {
        case 'divisionName':
            if (!divisions || !assignments.divisionId || !divisions.name)
                return null;
            return { assignments, dimTable: divisions, dimIdCol: assignments.divisionId, dimLabelCol: divisions.name };
        case 'departmentName':
            if (!departments || !assignments.departmentId || !departments.name)
                return null;
            return { assignments, dimTable: departments, dimIdCol: assignments.departmentId, dimLabelCol: departments.name };
        case 'locationName':
            if (!locations || !assignments.locationId || !locations.name)
                return null;
            return { assignments, dimTable: locations, dimIdCol: assignments.locationId, dimLabelCol: locations.name };
        default:
            return null;
    }
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
async function buildEmployeeLddGroupMeta(args) {
    const { tableId, table, grouping, whereClause, groupBy, groupByField, includeRows, groupPageSize, view } = args;
    const { assignments, dimTable, dimIdCol, dimLabelCol } = grouping;
    const tableAny = table;
    const userEmailCol = tableAny.userEmail;
    if (!userEmailCol)
        return null;
    const db = getDb();
    const baseQuery = db
        .select({
        groupValue: dimIdCol,
        label: dimLabelCol,
        count: sql `count(*)`,
    })
        .from(tableAny)
        .leftJoin(assignments, eq(userEmailCol, assignments.userKey))
        .leftJoin(dimTable, eq(dimIdCol, dimTable.id));
    const rows = whereClause
        ? await baseQuery.where(whereClause).groupBy(dimIdCol, dimLabelCol)
        : await baseQuery.groupBy(dimIdCol, dimLabelCol);
    const labelMap = {};
    const groupCounts = {};
    const entries = rows.map((row) => {
        const id = row?.groupValue == null ? '' : String(row.groupValue);
        const label = row?.label != null ? String(row.label) : id;
        const key = safeLabelKey(label);
        const count = Number(row?.count ?? 0) || 0;
        if (id && row?.label != null)
            labelMap[id] = String(row.label);
        groupCounts[key] = (groupCounts[key] ?? 0) + count;
        return { key, count, sortOrder: null, groupValue: id, label: key };
    });
    const orderByRaw = groupBy.orderBy || 'auto';
    const orderDirectionRaw = groupBy.orderDirection || '';
    let orderDirection = orderDirectionRaw === 'desc' ? 'desc' : 'asc';
    if (!orderDirectionRaw && orderByRaw === 'count')
        orderDirection = 'desc';
    const dir = orderDirection === 'desc' ? -1 : 1;
    const compareKeys = (a, b) => {
        if (!a && !b)
            return 0;
        if (!a)
            return 1;
        if (!b)
            return -1;
        return a.localeCompare(b);
    };
    const sorted = entries.slice().sort((a, b) => {
        if (orderByRaw === 'count') {
            if (a.count !== b.count)
                return dir * (a.count - b.count);
            return compareKeys(a.key, b.key);
        }
        return dir * compareKeys(a.key, b.key);
    });
    const seenKeys = new Set();
    const orderedEntries = sorted.filter((e) => {
        if (seenKeys.has(e.key))
            return false;
        seenKeys.add(e.key);
        return true;
    });
    const groupOrder = orderedEntries.map((e) => e.key);
    let groups = undefined;
    if (includeRows) {
        const sortId = Array.isArray(view?.sorting) && view.sorting.length > 0
            ? String(view.sorting[0]?.id || '')
            : '';
        const sortDesc = Array.isArray(view?.sorting) && view.sorting.length > 0
            ? Boolean(view.sorting[0]?.desc)
            : false;
        const rowOrderCol = (sortId && tableAny[sortId]) ? tableAny[sortId] : tableAny.id;
        const rowOrder = sortDesc ? desc(rowOrderCol) : asc(rowOrderCol);
        const rowColumns = getTableColumns(tableAny);
        groups = [];
        for (const entry of orderedEntries) {
            const groupValue = entry.groupValue;
            const groupCond = groupValue ? eq(dimIdCol, groupValue) : isNull(dimIdCol);
            const baseRowsQuery = db
                .select({ ...rowColumns })
                .from(tableAny)
                .leftJoin(assignments, eq(userEmailCol, assignments.userKey));
            const rowsQuery = whereClause
                ? await baseRowsQuery.where(and(whereClause, groupCond)).orderBy(rowOrder).limit(groupPageSize)
                : await baseRowsQuery.where(groupCond).orderBy(rowOrder).limit(groupPageSize);
            const enriched = rowsQuery.map((row) => {
                const out = { ...row };
                if (!out[groupByField] || String(out[groupByField]).trim() === '') {
                    const label = labelMap[groupValue];
                    if (label)
                        out[groupByField] = label;
                }
                return out;
            });
            groups.push({
                key: entry.key,
                total: groupCounts[entry.key] ?? 0,
                rows: enriched,
            });
        }
    }
    return {
        tableId,
        groupBy: {
            field: groupByField,
            orderBy: orderByRaw,
            orderDirection,
        },
        groupCounts,
        groupOrder,
        ...(groups ? { groups } : {}),
    };
}
async function buildJoinGroupMeta(args) {
    const { tableId, table, joins, groupField, labelField, orderField, whereClause, groupBy, groupByField, includeRows, groupPageSize, view, } = args;
    if (!Array.isArray(joins) || joins.length === 0)
        return null;
    const joinSteps = [];
    let currentTable = table;
    for (const join of joins) {
        const entityKey = String(join?.entity || '').trim();
        const localField = String(join?.localField || '').trim();
        const foreignField = String(join?.foreignField || '').trim();
        if (!entityKey || !localField || !foreignField)
            return null;
        const joinSpec = getEntitySpec(entityKey);
        const joinTable = joinSpec ? getTableFromSpec(joinSpec) : null;
        if (!joinTable)
            return null;
        const localCol = currentTable[localField];
        const foreignCol = joinTable[foreignField];
        if (!localCol || !foreignCol)
            return null;
        joinSteps.push({ table: joinTable, localCol, foreignCol });
        currentTable = joinTable;
    }
    const groupFieldKey = String(groupField || '').trim();
    if (!groupFieldKey)
        return null;
    const groupCol = currentTable[groupFieldKey];
    if (!groupCol)
        return null;
    const labelFieldKey = String(labelField || '').trim();
    const labelCol = labelFieldKey ? currentTable[labelFieldKey] : null;
    const orderFieldKey = String(orderField || '').trim();
    const orderCol = orderFieldKey ? currentTable[orderFieldKey] : null;
    const db = getDb();
    let baseQuery = db
        .select({
        groupValue: groupCol,
        label: labelCol ?? sql `null`,
        count: sql `count(*)`,
        sortOrder: orderCol ?? sql `null`,
    })
        .from(table);
    for (const step of joinSteps) {
        baseQuery = baseQuery.leftJoin(step.table, eq(step.localCol, step.foreignCol));
    }
    const groupByCols = [groupCol];
    if (labelCol)
        groupByCols.push(labelCol);
    if (orderCol)
        groupByCols.push(orderCol);
    const rows = whereClause
        ? await baseQuery.where(whereClause).groupBy(...groupByCols)
        : await baseQuery.groupBy(...groupByCols);
    const labelMap = {};
    const orderMap = {};
    const groupCounts = {};
    const entries = rows.map((row) => {
        const id = row?.groupValue == null ? '' : String(row.groupValue);
        const label = row?.label != null ? String(row.label) : id;
        const key = safeLabelKey(label);
        const count = Number(row?.count ?? 0) || 0;
        if (id && row?.label != null)
            labelMap[id] = String(row.label);
        if (row?.sortOrder != null) {
            const n = Number(row.sortOrder);
            if (Number.isFinite(n))
                orderMap[id] = n;
        }
        groupCounts[key] = (groupCounts[key] ?? 0) + count;
        const sortOrder = Number.isFinite(orderMap[id]) ? orderMap[id] : null;
        return { key, count, sortOrder, groupValue: id, label: key };
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
    const seenKeys = new Set();
    const orderedEntries = sorted.filter((e) => {
        if (seenKeys.has(e.key))
            return false;
        seenKeys.add(e.key);
        return true;
    });
    const groupOrder = orderedEntries.map((e) => e.key);
    let groups = undefined;
    if (includeRows) {
        const tableAny = table;
        const sortId = Array.isArray(view?.sorting) && view.sorting.length > 0
            ? String(view.sorting[0]?.id || '')
            : '';
        const sortDesc = Array.isArray(view?.sorting) && view.sorting.length > 0
            ? Boolean(view.sorting[0]?.desc)
            : false;
        const rowOrderCol = (sortId && tableAny[sortId]) ? tableAny[sortId] : tableAny.id;
        const rowOrder = sortDesc ? desc(rowOrderCol) : asc(rowOrderCol);
        const rowColumns = getTableColumns(tableAny);
        groups = [];
        for (const entry of orderedEntries) {
            const groupValue = entry.groupValue;
            const groupCond = groupValue ? eq(groupCol, groupValue) : isNull(groupCol);
            let rowsQueryBase = db
                .select({ ...rowColumns })
                .from(tableAny);
            for (const step of joinSteps) {
                rowsQueryBase = rowsQueryBase.leftJoin(step.table, eq(step.localCol, step.foreignCol));
            }
            const rowsQuery = whereClause
                ? await rowsQueryBase.where(and(whereClause, groupCond)).orderBy(rowOrder).limit(groupPageSize)
                : await rowsQueryBase.where(groupCond).orderBy(rowOrder).limit(groupPageSize);
            const enriched = rowsQuery.map((row) => {
                const out = { ...row };
                if (!out[groupByField] || String(out[groupByField]).trim() === '') {
                    const label = labelMap[groupValue];
                    if (label)
                        out[groupByField] = label;
                }
                return out;
            });
            groups.push({
                key: entry.key,
                total: groupCounts[entry.key] ?? 0,
                rows: enriched,
            });
        }
    }
    return {
        tableId,
        groupBy: {
            field: groupByField,
            orderBy: orderByRaw,
            orderDirection,
        },
        groupCounts,
        groupOrder,
        ...(groups ? { groups } : {}),
    };
}
export async function buildTableGroupMeta(args) {
    const tableId = String(args.tableId || '').trim();
    if (!tableId)
        return { error: 'Missing tableId', status: 400 };
    const groupByField = typeof args.groupBy?.field === 'string' ? args.groupBy.field.trim() : '';
    if (!groupByField)
        return { error: 'Missing groupBy.field', status: 400 };
    const entity = args.entity ?? getEntityByTableId(tableId);
    if (!entity)
        return { error: `Unknown tableId=${tableId}`, status: 404 };
    const uiSpec = entity.spec;
    const table = args.table ?? getTableFromSpec(uiSpec);
    if (!table)
        return { error: 'Missing storage.drizzleTable', status: 500 };
    const filters = Array.isArray(args.filters) ? args.filters : [];
    const filterMode = args.filterMode === 'any' ? 'any' : 'all';
    const search = typeof args.search === 'string' ? args.search.trim() : '';
    const includeRows = args.includeRows === true;
    const groupPageSizeRaw = Number(args.groupPageSize ?? 10000);
    const groupPageSize = Math.min(10000, Math.max(1, Number.isFinite(groupPageSizeRaw) ? groupPageSizeRaw : 10000));
    const columnMap = {};
    const fields = (uiSpec && typeof uiSpec === 'object' ? uiSpec.fields : null) || {};
    for (const fieldKey of Object.keys(fields)) {
        const col = table[fieldKey];
        if (col)
            columnMap[fieldKey] = col;
    }
    const conditions = [];
    const filtersCondition = buildFiltersCondition(filters, columnMap, filterMode, { currentUserId: args.currentUserId ?? null });
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
    const fieldSpec = fields?.[groupByField] || {};
    const computeSpec = getComputeSpec(fieldSpec);
    const isVirtual = isVirtualField(fieldSpec);
    const groupByResolved = resolveGroupByField(uiSpec, groupByField);
    let effectiveField = groupByResolved?.fieldKey || groupByField;
    let groupCol = table[effectiveField];
    let labelFromRow = String(groupByResolved?.labelFromRow || '').trim();
    let labelFieldSpec = groupByResolved?.fieldSpec || fieldSpec;
    if (!groupCol && isVirtual && computeSpec?.kind === 'labelFrom') {
        const sourceField = String(computeSpec.sourceField || '').trim();
        const sourceSpec = sourceField ? fields?.[sourceField] : null;
        const sourceCol = sourceField ? table[sourceField] : null;
        if (sourceCol) {
            effectiveField = sourceField;
            groupCol = sourceCol;
            labelFieldSpec = sourceSpec || {};
            labelFromRow = groupByField;
        }
    }
    if (!groupCol && isVirtual && computeSpec?.kind === 'concat') {
        const sep = typeof computeSpec.separator === 'string' ? computeSpec.separator : ' ';
        const fieldKeys = Array.isArray(computeSpec.fields) ? computeSpec.fields : [];
        const cols = fieldKeys
            .map((k) => (typeof k === 'string' ? k.trim() : ''))
            .filter(Boolean)
            .map((k) => table[k])
            .filter(Boolean);
        if (cols.length === 0) {
            return { error: `Unknown groupBy field: ${groupByField}`, status: 400 };
        }
        const concatExpr = sql `concat_ws(${sep}, ${sql.join(cols, sql `, `)})`;
        const db = getDb();
        const rows = whereClause
            ? await db.select({ groupValue: concatExpr, count: sql `count(*)` }).from(table).where(whereClause).groupBy(concatExpr)
            : await db.select({ groupValue: concatExpr, count: sql `count(*)` }).from(table).groupBy(concatExpr);
        const groupCounts = {};
        const entries = rows.map((row) => {
            const id = row?.groupValue == null ? '' : String(row.groupValue);
            const key = safeLabelKey(id);
            const count = Number(row?.count ?? 0) || 0;
            groupCounts[key] = (groupCounts[key] ?? 0) + count;
            return { key, count, sortOrder: null, groupValue: id, label: key };
        });
        const orderByRaw = args.groupBy.orderBy || 'auto';
        const orderDirectionRaw = args.groupBy.orderDirection || '';
        let orderDirection = orderDirectionRaw === 'desc' ? 'desc' : 'asc';
        if (!orderDirectionRaw && orderByRaw === 'count')
            orderDirection = 'desc';
        const dir = orderDirection === 'desc' ? -1 : 1;
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
        if (orderByRaw === 'count') {
            sorted.sort((a, b) => {
                if (a.count !== b.count)
                    return dir * (a.count - b.count);
                return compareKeys(a.key, b.key);
            });
        }
        else {
            sorted.sort((a, b) => dir * compareKeys(a.key, b.key));
        }
        const seenKeys = new Set();
        const orderedEntries = sorted.filter((e) => {
            if (seenKeys.has(e.key))
                return false;
            seenKeys.add(e.key);
            return true;
        });
        const groupOrder = orderedEntries.map((e) => e.key);
        let groups = undefined;
        if (includeRows) {
            const tableAny = table;
            const sortId = Array.isArray(args.view?.sorting) && args.view.sorting.length > 0
                ? String(args.view.sorting[0]?.id || '')
                : '';
            const sortDesc = Array.isArray(args.view?.sorting) && args.view.sorting.length > 0
                ? Boolean(args.view.sorting[0]?.desc)
                : false;
            const rowOrderCol = (sortId && tableAny[sortId]) ? tableAny[sortId] : tableAny.id;
            const rowOrder = sortDesc ? desc(rowOrderCol) : asc(rowOrderCol);
            groups = [];
            for (const entry of orderedEntries) {
                const groupValue = entry.groupValue;
                const groupCond = sql `${concatExpr} = ${groupValue}`;
                const rowsQuery = whereClause
                    ? await db.select().from(table).where(and(whereClause, groupCond)).orderBy(rowOrder).limit(groupPageSize)
                    : await db.select().from(table).where(groupCond).orderBy(rowOrder).limit(groupPageSize);
                const enriched = rowsQuery.map((row) => {
                    const out = { ...row };
                    if (!out[groupByField] || String(out[groupByField]).trim() === '') {
                        out[groupByField] = groupValue;
                    }
                    return out;
                });
                groups.push({
                    key: entry.key,
                    total: groupCounts[entry.key] ?? 0,
                    rows: enriched,
                });
            }
        }
        return {
            tableId,
            groupBy: {
                field: groupByField,
                orderBy: orderByRaw,
                orderDirection,
            },
            groupCounts,
            groupOrder,
            ...(groups ? { groups } : {}),
        };
    }
    if (!groupCol && isVirtual && computeSpec?.kind === 'join') {
        const joinResult = await buildJoinGroupMeta({
            tableId,
            table,
            joins: Array.isArray(computeSpec.joins) ? computeSpec.joins : [],
            groupField: computeSpec.groupField || null,
            labelField: computeSpec.labelField || null,
            orderField: computeSpec.orderField || null,
            whereClause,
            groupBy: args.groupBy,
            groupByField,
            includeRows,
            groupPageSize,
            view: args.view || null,
        });
        if (joinResult)
            return joinResult;
    }
    if (!groupCol) {
        const lddGrouping = resolveEmployeeLddGrouping(entity.entityKey, groupByField);
        if (lddGrouping) {
            const lddResult = await buildEmployeeLddGroupMeta({
                tableId,
                table,
                grouping: lddGrouping,
                whereClause,
                groupBy: args.groupBy,
                groupByField,
                includeRows,
                groupPageSize,
                view: args.view || null,
            });
            if (lddResult)
                return lddResult;
        }
        return { error: `Unknown groupBy field: ${groupByField}`, status: 400 };
    }
    const db = getDb();
    const rows = whereClause
        ? await db.select({ groupValue: groupCol, count: sql `count(*)` }).from(table).where(whereClause).groupBy(groupCol)
        : await db.select({ groupValue: groupCol, count: sql `count(*)` }).from(table).groupBy(groupCol);
    const optionSource = String(labelFieldSpec?.optionSource || '').trim();
    const referenceEntity = String(labelFieldSpec?.reference?.entityType || '').trim();
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
        return { key, count, sortOrder, groupValue: id, label: key };
    });
    const orderByRaw = args.groupBy.orderBy || 'auto';
    const orderDirectionRaw = args.groupBy.orderDirection || '';
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
    const seenKeys = new Set();
    const orderedEntries = sorted.filter((e) => {
        if (seenKeys.has(e.key))
            return false;
        seenKeys.add(e.key);
        return true;
    });
    const groupOrder = orderedEntries.map((e) => e.key);
    let groups = undefined;
    if (includeRows) {
        const tableAny = table;
        const sortId = Array.isArray(args.view?.sorting) && args.view.sorting.length > 0
            ? String(args.view.sorting[0]?.id || '')
            : '';
        const sortDesc = Array.isArray(args.view?.sorting) && args.view.sorting.length > 0
            ? Boolean(args.view.sorting[0]?.desc)
            : false;
        const rowOrderCol = (sortId && tableAny[sortId]) ? tableAny[sortId] : tableAny.id;
        const rowOrder = sortDesc ? desc(rowOrderCol) : asc(rowOrderCol);
        groups = [];
        for (const entry of orderedEntries) {
            const groupValue = entry.groupValue;
            const groupCond = groupValue ? eq(groupCol, groupValue) : isNull(groupCol);
            const rowsQuery = whereClause
                ? await db.select().from(table).where(and(whereClause, groupCond)).orderBy(rowOrder).limit(groupPageSize)
                : await db.select().from(table).where(groupCond).orderBy(rowOrder).limit(groupPageSize);
            const enriched = rowsQuery.map((row) => {
                const out = { ...row };
                if (labelFromRow && groupValue && (!out[labelFromRow] || String(out[labelFromRow]).trim() === '')) {
                    const label = labelMap[groupValue];
                    if (label)
                        out[labelFromRow] = label;
                }
                return out;
            });
            groups.push({
                key: entry.key,
                total: groupCounts[entry.key] ?? 0,
                rows: enriched,
            });
        }
    }
    return {
        tableId,
        groupBy: {
            field: groupByField,
            orderBy: orderByRaw,
            orderDirection,
        },
        groupCounts,
        groupOrder,
        ...(groups ? { groups } : {}),
    };
}
