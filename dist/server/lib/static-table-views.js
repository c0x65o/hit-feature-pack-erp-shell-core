// HIT_UI_SPECS is generated in the application, not in feature packs
// Import it conditionally to avoid build errors in feature pack builds
let HIT_UI_SPECS = null;
try {
    // Dynamic import that may not exist in feature pack builds
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const hitUiSpecsModule = require('@/lib/hit-ui-specs.generated');
    HIT_UI_SPECS = hitUiSpecsModule?.HIT_UI_SPECS || null;
}
catch {
    // File doesn't exist in feature pack builds, which is fine
    HIT_UI_SPECS = null;
}
function getRawStaticTableViews() {
    if (!HIT_UI_SPECS)
        return {};
    const tv = HIT_UI_SPECS?.tableViews;
    return (tv && typeof tv === 'object') ? tv : {};
}
function normalizeStaticView(tableId, v) {
    const id = String(v?.id || '').trim();
    const name = String(v?.name || '').trim();
    if (!id || !name)
        return null;
    const description = v?.description === undefined ? null : (v?.description ?? null);
    return {
        id,
        name,
        description: typeof description === 'string' ? description : (description === null ? null : String(description)),
        isDefault: Boolean(v?.isDefault),
        columnVisibility: v?.columnVisibility ?? null,
        sorting: v?.sorting ?? null,
        groupBy: v?.groupBy ?? null,
        metadata: (v?.metadata && typeof v?.metadata === 'object') ? v?.metadata : null,
        filters: Array.isArray(v?.filters) ? v.filters : undefined,
    };
}
export function getStaticViewsForTable(tableId) {
    const raw = getRawStaticTableViews();
    const listAny = raw[tableId];
    if (!Array.isArray(listAny))
        return [];
    const now = new Date();
    const out = [];
    for (const vAny of listAny) {
        if (!vAny || typeof vAny !== 'object')
            continue;
        const spec = normalizeStaticView(tableId, vAny);
        if (!spec)
            continue;
        const filtersRaw = Array.isArray(spec.filters) ? spec.filters : [];
        const filters = filtersRaw
            .filter((f) => f && typeof f === 'object')
            .map((f, idx) => ({
            id: `${spec.id}:${idx}`,
            viewId: spec.id,
            field: String(f.field || ''),
            operator: String(f.operator || ''),
            value: f.value ?? null,
            valueType: f.valueType ? String(f.valueType) : null,
            metadata: f.metadata ?? null,
            sortOrder: idx,
        }))
            .filter((f) => Boolean(f.field) && Boolean(f.operator));
        out.push({
            id: spec.id,
            userId: 'system',
            tableId,
            name: spec.name,
            description: spec.description ?? null,
            isDefault: Boolean(spec.isDefault),
            isSystem: true,
            isShared: false,
            columnVisibility: spec.columnVisibility ?? null,
            sorting: spec.sorting ?? null,
            groupBy: spec.groupBy ?? null,
            metadata: spec.metadata ?? null,
            createdAt: now,
            updatedAt: now,
            lastUsedAt: null,
            filters,
            _static: true,
            _source: 'schema',
        });
    }
    // Ensure defaults appear first while preserving YAML order otherwise.
    return out.sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)));
}
export function getStaticViewById(viewId) {
    const raw = getRawStaticTableViews();
    for (const [tableId, listAny] of Object.entries(raw)) {
        if (!Array.isArray(listAny))
            continue;
        for (const vAny of listAny) {
            if (!vAny || typeof vAny !== 'object')
                continue;
            const spec = normalizeStaticView(tableId, vAny);
            if (!spec)
                continue;
            if (spec.id === viewId) {
                const [view] = getStaticViewsForTable(tableId).filter((v) => v.id === viewId);
                return view || null;
            }
        }
    }
    return null;
}
export function isStaticViewId(viewId) {
    return Boolean(getStaticViewById(viewId));
}
