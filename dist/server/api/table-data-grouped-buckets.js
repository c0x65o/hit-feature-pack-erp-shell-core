// API: /api/table-data/grouped-buckets
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { extractUserFromRequest } from '../auth';
import { getTableProviderRegistryFromRequest, requireTableProvider } from '../lib/table-providers';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
function requireAdmin(request) {
    const user = extractUserFromRequest(request);
    if (!user)
        return { ok: false, res: jsonError('Unauthorized', 401) };
    const roles = Array.isArray(user.roles) ? user.roles : [];
    if (!roles.includes('admin'))
        return { ok: false, res: jsonError('Forbidden', 403) };
    return { ok: true };
}
async function callSameOrigin(request, path, init) {
    const url = new URL(request.url);
    const target = `${url.origin}${path}`;
    const headers = new Headers(init.headers || {});
    // Forward caller auth + service token if present.
    // IMPORTANT: In most deployments auth is cookie-based (no Authorization header on browser requests),
    // so we must forward cookies for internal same-origin fetches to preserve identity.
    const auth = request.headers.get('authorization') || request.headers.get('Authorization');
    if (auth)
        headers.set('Authorization', auth);
    const cookie = request.headers.get('cookie') || request.headers.get('Cookie');
    if (cookie)
        headers.set('Cookie', cookie);
    const svc = request.headers.get('x-hit-service-token') || request.headers.get('X-HIT-Service-Token');
    if (svc)
        headers.set('X-HIT-Service-Token', svc);
    return fetch(target, { ...init, headers });
}
function isSafeIdent(x) {
    // conservative: unquoted identifiers only
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(x);
}
function quoteIdent(ident) {
    return `"${ident}"`;
}
async function loadAllEntityIdsForTable(request, tableId, maxIds) {
    const reg = getTableProviderRegistryFromRequest(request);
    const provider = requireTableProvider(reg, tableId);
    if (!provider)
        return { ok: false, error: `No table provider configured for tableId=${tableId}`, status: 400 };
    if (provider.kind !== 'db_table')
        return { ok: false, error: `Unsupported provider kind: ${provider.kind}`, status: 400 };
    const table = String(provider.table || '').trim();
    const idColumn = String(provider.idColumn || '').trim();
    if (!table || !idColumn)
        return { ok: false, error: 'Invalid provider', status: 400 };
    if (!isSafeIdent(table) || !isSafeIdent(idColumn))
        return { ok: false, error: 'Unsafe provider identifiers', status: 400 };
    const db = getDb();
    // Deterministic order for stable pagination.
    const q = sql `select ${sql.raw(quoteIdent(idColumn))} as id from ${sql.raw(quoteIdent(table))} order by ${sql.raw(quoteIdent(idColumn))} asc limit ${maxIds}`;
    const res = await db.execute(q);
    const rows = Array.isArray(res.rows) ? res.rows : [];
    const ids = rows.map((r) => String(r?.id ?? '').trim()).filter(Boolean);
    return { ok: true, ids };
}
/**
 * POST /api/table-data/grouped-buckets
 *
 * Body:
 *  - tableId: string
 *  - columnKey: string
 *  - entityKind: string
 *  - pageSize?: number
 *  - bucketPages?: Record<segmentKey, pageNumber>
 *
 * Returns:
 *  - data: { buckets: Array<{ bucketLabel, sortOrder, segmentKey, total, items, rows }> }
 *
 * NOTE: This endpoint is intentionally "glue": it combines bucket membership from metrics-core
 * with row fetching from /api/table-data/batch (provider registry).
 *
 * IMPORTANT:
 * - For per-row bucket values, metrics-core uses first-match-wins (exclusive buckets) ordering by sortOrder.
 * - For server-side grouping, we align with that behavior by using the evaluate endpoint and grouping IDs.
 */
export async function POST(request) {
    const gate = requireAdmin(request);
    if (!gate.ok)
        return gate.res;
    const body = (await request.json().catch(() => null));
    if (!body)
        return jsonError('Invalid JSON body', 400);
    const tableId = typeof body.tableId === 'string' ? body.tableId.trim() : '';
    const columnKey = typeof body.columnKey === 'string' ? body.columnKey.trim() : '';
    const entityKind = typeof body.entityKind === 'string' ? body.entityKind.trim() : '';
    const pageSize = Math.max(1, Math.min(250, Number(body.pageSize || 25) || 25));
    const bucketPages = (body.bucketPages && typeof body.bucketPages === 'object' ? body.bucketPages : null);
    if (!tableId)
        return jsonError('Missing tableId', 400);
    if (!columnKey)
        return jsonError('Missing columnKey', 400);
    if (!entityKind)
        return jsonError('Missing entityKind', 400);
    // 1) Load bucket definitions (labels + sortOrder + segmentKey) from metrics-core.
    const defRes = await callSameOrigin(request, `/api/metrics/segments/table-buckets?tableId=${encodeURIComponent(tableId)}&columnKey=${encodeURIComponent(columnKey)}&entityKind=${encodeURIComponent(entityKind)}`, { method: 'GET' });
    const defJson = await defRes.json().catch(() => ({}));
    if (!defRes.ok)
        return jsonError(defJson?.error || `Failed to load bucket definitions (${defRes.status})`, defRes.status);
    const defs = Array.isArray(defJson?.data?.buckets) ? defJson.data.buckets : [];
    // 2) Load all entity IDs for the table (provider registry) and evaluate bucket assignment (exclusive, first-match-wins).
    // NOTE: This is intentionally generic glue; feature packs don't need to be aware of metrics/segments.
    const idsRes = await loadAllEntityIdsForTable(request, tableId, 20000);
    if (!idsRes.ok)
        return jsonError(idsRes.error, idsRes.status);
    const allIds = idsRes.ids;
    // Chunk for evaluate endpoint limit (500).
    const assigned = {};
    for (const id of allIds)
        assigned[id] = null;
    for (let i = 0; i < allIds.length; i += 500) {
        const chunk = allIds.slice(i, i + 500);
        const evalRes = await callSameOrigin(request, '/api/metrics/segments/table-buckets/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableId, columnKey, entityKind, entityIds: chunk }),
        });
        const evalJson = await evalRes.json().catch(() => ({}));
        if (!evalRes.ok)
            return jsonError(evalJson?.error || `Failed to evaluate buckets (${evalRes.status})`, evalRes.status);
        const values = (evalJson?.data?.values && typeof evalJson.data.values === 'object' ? evalJson.data.values : {});
        for (const [id, v] of Object.entries(values)) {
            if (!id)
                continue;
            if (v && typeof v === 'object' && typeof v.segmentKey === 'string') {
                assigned[id] = { bucketLabel: String(v.bucketLabel || ''), segmentKey: String(v.segmentKey || '') };
            }
            else {
                assigned[id] = null;
            }
        }
    }
    // 3) Group ids by assigned segmentKey.
    const idsBySeg = new Map();
    const unbucketed = [];
    for (const id of allIds) {
        const v = assigned[id];
        if (!v || !v.segmentKey) {
            unbucketed.push(id);
            continue;
        }
        if (!idsBySeg.has(v.segmentKey))
            idsBySeg.set(v.segmentKey, []);
        idsBySeg.get(v.segmentKey).push(id);
    }
    // Deterministic within-bucket ordering.
    for (const arr of idsBySeg.values())
        arr.sort((a, b) => String(a).localeCompare(String(b)));
    unbucketed.sort((a, b) => String(a).localeCompare(String(b)));
    // 4) Build response buckets, applying per-bucket paging and attaching rows.
    const out = [];
    const orderedDefs = defs
        .map((d) => ({
        segmentKey: String(d?.segmentKey || '').trim(),
        bucketLabel: String(d?.bucketLabel || '').trim(),
        sortOrder: Number(d?.sortOrder ?? 0) || 0,
    }))
        .filter((d) => d.segmentKey && d.bucketLabel)
        .sort((a, b) => (a.sortOrder - b.sortOrder) || a.bucketLabel.localeCompare(b.bucketLabel) || a.segmentKey.localeCompare(b.segmentKey));
    // Include unbucketed group last if it exists.
    const allBuckets = [...orderedDefs];
    if (unbucketed.length > 0) {
        allBuckets.push({
            segmentKey: '__unbucketed__',
            bucketLabel: `No ${columnKey}`,
            sortOrder: 10000000,
        });
        idsBySeg.set('__unbucketed__', unbucketed);
    }
    for (const b of allBuckets) {
        const segKey = b.segmentKey;
        const all = idsBySeg.get(segKey) || [];
        const total = all.length;
        const page = Math.max(1, Number(bucketPages?.[segKey] || 1) || 1);
        const start = (page - 1) * pageSize;
        const items = all.slice(start, start + pageSize);
        const batchRes = await callSameOrigin(request, '/api/table-data/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableId, ids: items }),
        });
        const batchJson = await batchRes.json().catch(() => ({}));
        if (!batchRes.ok)
            return jsonError(batchJson?.error || `Failed to load rows for bucket (${batchRes.status})`, batchRes.status);
        const rowsRaw = Array.isArray(batchJson?.data?.items) ? batchJson.data.items : [];
        // Reorder rows to match `items` order (IN (...) doesn't guarantee order).
        const byId = new Map();
        for (const r of rowsRaw) {
            const rid = String(r?.id ?? r?.ID ?? '').trim();
            if (rid)
                byId.set(rid, r);
        }
        const rows = items.map((id) => byId.get(String(id)) || null).filter(Boolean);
        out.push({
            bucketLabel: b.bucketLabel,
            sortOrder: b.sortOrder,
            segmentKey: segKey,
            page,
            pageSize,
            total,
            items,
            rows,
        });
    }
    return NextResponse.json({ data: { tableId, columnKey, entityKind, buckets: out } });
}
