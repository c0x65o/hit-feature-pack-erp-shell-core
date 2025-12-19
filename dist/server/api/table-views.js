// API: /api/table-views
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { tableViews, tableViewFilters, } from '@/lib/feature-pack-schemas';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
// Required for Next.js App Router
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * GET /api/table-views?tableId=projects
 * List all views for a table (user's custom views + system defaults)
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
        // Load filters for all views
        const allViewIds = [...userViews.map((v) => v.id), ...systemViews.map((v) => v.id)];
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
        // Attach filters to views (system views first, then user's custom views)
        const viewsWithFilters = [
            ...systemViews.map((view) => ({
                ...view,
                filters: filtersMap.get(view.id) || [],
            })),
            ...userViews.map((view) => ({
                ...view,
                filters: filtersMap.get(view.id) || [],
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
        const { tableId, name, description, filters, columnVisibility, sorting, isDefault, isSystem } = body;
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
            isDefault: isDefault || false,
            isSystem: isSystem || false,
            isShared: false,
            metadata: null,
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
