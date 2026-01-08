import { NextResponse } from 'next/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { notificationReads } from '@/lib/feature-pack-schemas';
import { extractUserFromRequest } from '../auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
function parseIdsParam(idsParam) {
    if (!idsParam)
        return [];
    return idsParam
        .split(',')
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .slice(0, 500);
}
/**
 * GET /api/notification-reads?ids=a,b,c
 *
 * Returns:
 *  - readIds: string[]
 */
export async function GET(request) {
    try {
        const user = extractUserFromRequest(request);
        if (!user?.sub)
            return jsonError('Unauthorized', 401);
        const url = new URL(request.url);
        const ids = parseIdsParam(url.searchParams.get('ids'));
        if (ids.length === 0)
            return NextResponse.json({ readIds: [] });
        const db = getDb();
        const rows = await db
            .select({ notificationId: notificationReads.notificationId })
            .from(notificationReads)
            .where(and(eq(notificationReads.userId, user.sub), inArray(notificationReads.notificationId, ids)));
        return NextResponse.json({ readIds: rows.map((r) => String(r.notificationId)) });
    }
    catch (error) {
        console.error('[dashboard-shell] notification-reads GET error:', error);
        return jsonError('Failed to fetch notification reads', 500);
    }
}
/**
 * POST /api/notification-reads
 *
 * Body:
 *  - ids: string[]
 *
 * Behavior:
 *  - upserts read state for each id (idempotent)
 */
export async function POST(request) {
    try {
        const user = extractUserFromRequest(request);
        if (!user?.sub)
            return jsonError('Unauthorized', 401);
        const body = (await request.json().catch(() => null));
        const idsRaw = Array.isArray(body?.ids) ? body.ids : [];
        const ids = idsRaw.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 500);
        if (ids.length === 0)
            return NextResponse.json({ ok: true, upserted: 0 });
        const db = getDb();
        const now = new Date();
        // NOTE: We use raw SQL for ON CONFLICT to keep this fast and idempotent.
        await db.execute(sql `
      insert into notification_reads (user_id, notification_id, read_at)
      values ${sql.join(ids.map((id) => sql `(${user.sub}, ${id}, ${now})`), sql `, `)}
      on conflict (user_id, notification_id)
      do update set read_at = excluded.read_at
    `);
        return NextResponse.json({ ok: true, upserted: ids.length });
    }
    catch (error) {
        console.error('[dashboard-shell] notification-reads POST error:', error);
        return jsonError('Failed to upsert notification reads', 500);
    }
}
