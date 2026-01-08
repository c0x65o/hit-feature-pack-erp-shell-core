// API: /api/table-views
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { tableViews, tableViewFilters, tableViewShares, } from '@/lib/feature-pack-schemas';
import { eq, desc, and, inArray, or, sql } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
import { resolveUserPrincipals } from '@/lib/acl-utils';
// Required for Next.js App Router
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * GET /api/table-views?tableId=projects
 * List all views for a table:
 * - System/default views
 * - User's custom views
 * - Views shared with the user (by user, group, or role)
 */
export async function GET(request) {
    try {
        const user = extractUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const db = getDb();
        const { searchParams } = new URL(request.url);
        const tableId = searchParams.get('tableId');
        if (!tableId) {
            return NextResponse.json({ error: 'tableId is required' }, { status: 400 });
        }
        // Get user's custom views
        const userViews = await db
            .select()
            .from(tableViews)
            .where(and(eq(tableViews.userId, user.sub), eq(tableViews.tableId, tableId), eq(tableViews.isSystem, false)))
            .orderBy(desc(tableViews.lastUsedAt), desc(tableViews.createdAt));
        // Get system/default views for this table (default views first, then by creation)
        const systemViews = await db
            .select()
            .from(tableViews)
            .where(and(eq(tableViews.tableId, tableId), eq(tableViews.isSystem, true)))
            .orderBy(desc(tableViews.isDefault), desc(tableViews.createdAt));
        // Build conditions for views shared with user
        // Shared with: user directly, or their groups, or their roles
        const principals = await resolveUserPrincipals({ request, user });
        const userGroups = principals.groupIds || [];
        const userRoles = principals.roles || [];
        const shareConditions = [
            // Direct user share
            and(eq(tableViewShares.principalType, 'user'), eq(tableViewShares.principalId, user.sub)),
        ];
        // Also match user shares by email (UI uses email as the principal id for "user")
        const userEmail = String(user.email || '').trim();
        if (userEmail && userEmail !== user.sub) {
            shareConditions.push(and(eq(tableViewShares.principalType, 'user'), eq(tableViewShares.principalId, userEmail)));
        }
        // Add group shares if user has groups
        if (userGroups.length > 0) {
            shareConditions.push(and(eq(tableViewShares.principalType, 'group'), inArray(tableViewShares.principalId, userGroups)));
        }
        // Add role shares if user has roles
        if (userRoles.length > 0) {
            shareConditions.push(and(eq(tableViewShares.principalType, 'role'), inArray(tableViewShares.principalId, userRoles)));
        }
        // Get views shared with this user (but not owned by them)
        const sharedViewsData = await db
            .select({
            view: tableViews,
            share: tableViewShares,
        })
            .from(tableViewShares)
            .innerJoin(tableViews, eq(tableViewShares.viewId, tableViews.id))
            .where(and(eq(tableViews.tableId, tableId), sql `${tableViews.userId} != ${user.sub}`, // Not owned by current user
        or(...shareConditions)))
            .orderBy(desc(tableViewShares.createdAt));
        // Deduplicate shared views (user might have access through multiple paths)
        const sharedViewsMap = new Map();
        for (const row of sharedViewsData) {
            if (!sharedViewsMap.has(row.view.id)) {
                sharedViewsMap.set(row.view.id, {
                    view: row.view,
                    sharedBy: row.share.sharedBy,
                    sharedByName: row.share.sharedByName,
                });
            }
        }
        const sharedViews = Array.from(sharedViewsMap.values());
        // Load filters for all views
        const allViewIds = [
            ...userViews.map((v) => v.id),
            ...systemViews.map((v) => v.id),
            ...sharedViews.map((s) => s.view.id),
        ];
        const filtersMap = new Map();
        if (allViewIds.length > 0) {
            const filters = await db
                .select()
                .from(tableViewFilters)
                .where(inArray(tableViewFilters.viewId, allViewIds));
            // Group filters by viewId
            for (const filter of filters) {
                if (!filtersMap.has(filter.viewId)) {
                    filtersMap.set(filter.viewId, []);
                }
                filtersMap.get(filter.viewId).push(filter);
            }
        }
        // Build response with all views categorized
        const viewsWithFilters = [
            // System views first
            ...systemViews.map((view) => ({
                ...view,
                filters: filtersMap.get(view.id) || [],
                _category: 'system',
            })),
            // User's own views
            ...userViews.map((view) => ({
                ...view,
                filters: filtersMap.get(view.id) || [],
                _category: 'user',
            })),
            // Views shared with user
            ...sharedViews.map((shared) => ({
                ...shared.view,
                filters: filtersMap.get(shared.view.id) || [],
                _category: 'shared',
                _sharedBy: shared.sharedBy,
                _sharedByName: shared.sharedByName,
            })),
        ];
        return NextResponse.json({ data: viewsWithFilters });
    }
    catch (error) {
        console.error('Failed to fetch table views:', error);
        return NextResponse.json({ error: error?.message || 'Failed to fetch views' }, { status: 500 });
    }
}
/**
 * POST /api/table-views
 * Create a new view
 */
export async function POST(request) {
    try {
        const user = extractUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const db = getDb();
        const body = await request.json();
        const { tableId, name, description, filters, columnVisibility, sorting, groupBy, isDefault, isSystem, metadata } = body;
        if (!tableId || !name) {
            return NextResponse.json({ error: 'tableId and name are required' }, { status: 400 });
        }
        // Create view
        // isSystem views are visible to all users; they use 'system' as userId
        const [view] = await db
            .insert(tableViews)
            .values({
            userId: isSystem ? 'system' : user.sub,
            tableId,
            name,
            description: description || null,
            columnVisibility: columnVisibility || null,
            sorting: sorting || null,
            groupBy: groupBy || null,
            isDefault: isDefault || false,
            isSystem: isSystem || false,
            isShared: false,
            metadata: metadata && typeof metadata === 'object' ? metadata : null,
        })
            .returning();
        // Create filters if provided
        if (filters && Array.isArray(filters) && filters.length > 0) {
            await db.insert(tableViewFilters).values(filters.map((filter, index) => ({
                viewId: view.id,
                field: filter.field,
                operator: filter.operator,
                value: filter.value || null,
                valueType: filter.valueType || null,
                metadata: filter.metadata || null,
                sortOrder: index,
            })));
        }
        // Load filters for response
        const viewFilters = await db
            .select()
            .from(tableViewFilters)
            .where(eq(tableViewFilters.viewId, view.id))
            .orderBy(tableViewFilters.sortOrder);
        return NextResponse.json({
            data: {
                ...view,
                filters: viewFilters,
            },
        });
    }
    catch (error) {
        console.error('Failed to create table view:', error);
        return NextResponse.json({ error: error?.message || 'Failed to create view' }, { status: 500 });
    }
}
