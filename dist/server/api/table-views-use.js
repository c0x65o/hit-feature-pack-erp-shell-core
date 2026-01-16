// API: /api/table-views/[id]/use
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { tableViews } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
import { isStaticViewId } from '../lib/static-table-views';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * PATCH /api/table-views/[id]/use
 * Mark a view as used (update lastUsedAt)
 */
export async function PATCH(request, { params }) {
    try {
        const user = extractUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const db = getDb();
        const viewId = params.id;
        // Static (schema-defined) views aren't stored in the DB.
        if (isStaticViewId(viewId)) {
            return NextResponse.json({ success: true });
        }
        // Update lastUsedAt (allow system views too)
        await db
            .update(tableViews)
            .set({ lastUsedAt: new Date() })
            .where(eq(tableViews.id, viewId));
        return NextResponse.json({ success: true });
    }
    catch (error) {
        console.error('Failed to update view usage:', error);
        return NextResponse.json({ error: error?.message || 'Failed to update view usage' }, { status: 500 });
    }
}
