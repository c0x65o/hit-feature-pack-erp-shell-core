// API: /api/table-views/[id]/shares
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { tableViews, tableViewShares } from '@/lib/feature-pack-schemas';
import { eq, and } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * Check if user has admin role
 */
function isAdmin(roles) {
    return roles?.includes('admin') || false;
}
/**
 * GET /api/table-views/[id]/shares
 * List all share entries for a view (owner only)
 */
export async function GET(request, { params }) {
    try {
        const user = extractUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const db = getDb();
        const viewId = params.id;
        // Get view and verify ownership
        const [view] = await db
            .select()
            .from(tableViews)
            .where(eq(tableViews.id, viewId))
            .limit(1);
        if (!view) {
            return NextResponse.json({ error: 'View not found' }, { status: 404 });
        }
        // Only view owner can see share entries
        if (view.userId !== user.sub) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
        // Get all share entries for this view
        const shares = await db
            .select()
            .from(tableViewShares)
            .where(eq(tableViewShares.viewId, viewId))
            .orderBy(tableViewShares.createdAt);
        return NextResponse.json({ data: shares });
    }
    catch (error) {
        console.error('Failed to list view shares:', error);
        return NextResponse.json({ error: error?.message || 'Failed to list shares' }, { status: 500 });
    }
}
/**
 * POST /api/table-views/[id]/shares
 * Add a share entry for a view
 *
 * Body: { principalType: 'user' | 'group' | 'role', principalId: string }
 *
 * Non-admins can only share with users (principalType: 'user')
 * Admins can share with users, groups, or roles
 */
export async function POST(request, { params }) {
    try {
        const user = extractUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const db = getDb();
        const viewId = params.id;
        const body = await request.json();
        const { principalType, principalId } = body;
        // Validate input
        if (!principalType || !principalId) {
            return NextResponse.json({ error: 'principalType and principalId are required' }, { status: 400 });
        }
        if (!['user', 'group', 'role'].includes(principalType)) {
            return NextResponse.json({ error: 'principalType must be user, group, or role' }, { status: 400 });
        }
        // Non-admins can only share with users
        if (!isAdmin(user.roles) && principalType !== 'user') {
            return NextResponse.json({
                error: 'Only admins can share views with groups or roles. You can share with individual users.'
            }, { status: 403 });
        }
        // Get view and verify ownership
        const [view] = await db
            .select()
            .from(tableViews)
            .where(eq(tableViews.id, viewId))
            .limit(1);
        if (!view) {
            return NextResponse.json({ error: 'View not found' }, { status: 404 });
        }
        // Only view owner can share it
        if (view.userId !== user.sub) {
            return NextResponse.json({ error: 'Access denied - only the view owner can share it' }, { status: 403 });
        }
        // Cannot share system views
        if (view.isSystem) {
            return NextResponse.json({ error: 'Cannot share system views' }, { status: 400 });
        }
        // Cannot share with yourself
        const userEmail = String(user.email || '').trim();
        if (principalType === 'user' && (principalId === user.sub || (userEmail && principalId === userEmail))) {
            return NextResponse.json({ error: 'Cannot share a view with yourself' }, { status: 400 });
        }
        // Check if share already exists
        const [existingShare] = await db
            .select()
            .from(tableViewShares)
            .where(and(eq(tableViewShares.viewId, viewId), eq(tableViewShares.principalType, principalType), eq(tableViewShares.principalId, principalId)))
            .limit(1);
        if (existingShare) {
            return NextResponse.json({ error: 'View is already shared with this principal' }, { status: 409 });
        }
        // Create share entry
        const [share] = await db
            .insert(tableViewShares)
            .values({
            viewId,
            principalType,
            principalId,
            sharedBy: user.sub,
            sharedByName: user.name || user.email || user.sub,
        })
            .returning();
        // Update view's isShared flag
        await db
            .update(tableViews)
            .set({ isShared: true, updatedAt: new Date() })
            .where(eq(tableViews.id, viewId));
        return NextResponse.json({ data: share });
    }
    catch (error) {
        console.error('Failed to share view:', error);
        return NextResponse.json({ error: error?.message || 'Failed to share view' }, { status: 500 });
    }
}
/**
 * DELETE /api/table-views/[id]/shares
 * Remove a share entry for a view
 *
 * Query params: ?principalType=user&principalId=someone@example.com
 */
export async function DELETE(request, { params }) {
    try {
        const user = extractUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const db = getDb();
        const viewId = params.id;
        const { searchParams } = new URL(request.url);
        const principalType = searchParams.get('principalType');
        const principalId = searchParams.get('principalId');
        // Validate input
        if (!principalType || !principalId) {
            return NextResponse.json({ error: 'principalType and principalId query params are required' }, { status: 400 });
        }
        // Get view and verify ownership
        const [view] = await db
            .select()
            .from(tableViews)
            .where(eq(tableViews.id, viewId))
            .limit(1);
        if (!view) {
            return NextResponse.json({ error: 'View not found' }, { status: 404 });
        }
        // Only view owner can remove shares
        if (view.userId !== user.sub) {
            return NextResponse.json({ error: 'Access denied - only the view owner can remove shares' }, { status: 403 });
        }
        // Delete the share entry
        const deleted = await db
            .delete(tableViewShares)
            .where(and(eq(tableViewShares.viewId, viewId), eq(tableViewShares.principalType, principalType), eq(tableViewShares.principalId, principalId)))
            .returning();
        if (deleted.length === 0) {
            return NextResponse.json({ error: 'Share entry not found' }, { status: 404 });
        }
        // Check if view still has any shares
        const remainingShares = await db
            .select()
            .from(tableViewShares)
            .where(eq(tableViewShares.viewId, viewId))
            .limit(1);
        // If no more shares, update isShared flag
        if (remainingShares.length === 0) {
            await db
                .update(tableViews)
                .set({ isShared: false, updatedAt: new Date() })
                .where(eq(tableViews.id, viewId));
        }
        return NextResponse.json({ success: true });
    }
    catch (error) {
        console.error('Failed to remove view share:', error);
        return NextResponse.json({ error: error?.message || 'Failed to remove share' }, { status: 500 });
    }
}
