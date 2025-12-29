// API: /api/table-data/batch
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { extractUserFromRequest } from '../auth';
import { buildDbTableBatchQuery, getTableProviderRegistryFromRequest, requireTableProvider } from '../lib/table-providers';
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
/**
 * POST /api/table-data/batch
 *
 * Body:
 *  - tableId: string
 *  - ids: string[]
 *
 * Returns:
 *  - data: { items: any[] }
 */
export async function POST(request) {
    const gate = requireAdmin(request);
    if (!gate.ok)
        return gate.res;
    const body = (await request.json().catch(() => null));
    if (!body)
        return jsonError('Invalid JSON body', 400);
    const tableId = typeof body.tableId === 'string' ? body.tableId.trim() : '';
    const idsRaw = Array.isArray(body.ids) ? body.ids : [];
    const ids = idsRaw.map((x) => String(x || '').trim()).filter(Boolean);
    if (!tableId)
        return jsonError('Missing tableId', 400);
    if (ids.length === 0)
        return NextResponse.json({ data: { items: [] } });
    if (ids.length > 1000)
        return jsonError('Too many ids (max 1000)', 400);
    const reg = getTableProviderRegistryFromRequest(request);
    const provider = requireTableProvider(reg, tableId);
    if (!provider)
        return jsonError(`No table provider configured for tableId=${tableId}`, 400);
    if (provider.kind !== 'db_table')
        return jsonError(`Unsupported provider kind: ${provider.kind}`, 400);
    const db = getDb();
    const q = buildDbTableBatchQuery(provider, ids);
    const res = await db.execute(q);
    const items = Array.isArray(res.rows) ? res.rows : [];
    return NextResponse.json({ data: { items } });
}
