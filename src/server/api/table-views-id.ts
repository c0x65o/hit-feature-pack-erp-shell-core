// API: /api/table-views/[id]
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { tableViews, tableViewFilters } from '@/lib/feature-pack-schemas';
import { eq, and, or } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/table-views/[id]
 * Get a single view by ID
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const viewId = params.id;

    // Get view (user's own views or system views)
    const [view] = await db
      .select()
      .from(tableViews)
      .where(
        and(
          eq(tableViews.id, viewId),
          or(eq(tableViews.userId, user.sub), eq(tableViews.isSystem, true))
        )
      )
      .limit(1);

    if (!view) {
      return NextResponse.json({ error: 'View not found' }, { status: 404 });
    }

    // Load filters
    const filters = await db
      .select()
      .from(tableViewFilters)
      .where(eq(tableViewFilters.viewId, viewId))
      .orderBy(tableViewFilters.sortOrder);

    return NextResponse.json({
      data: {
        ...view,
        filters,
      },
    });
  } catch (error: any) {
    console.error('Failed to get table view:', error);
    return NextResponse.json({ error: error?.message || 'Failed to get view' }, { status: 500 });
  }
}

/**
 * PUT /api/table-views/[id]
 * Update an existing view
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const viewId = params.id;
    const body = await request.json();
    const { name, description, filters, columnVisibility, sorting, groupBy, isDefault, metadata } = body;

    // Get view by ID first (not filtering by user)
    const [existingView] = await db
      .select()
      .from(tableViews)
      .where(eq(tableViews.id, viewId))
      .limit(1);

    if (!existingView) {
      return NextResponse.json({ error: 'View not found' }, { status: 404 });
    }

    if (existingView.isSystem) {
      return NextResponse.json({ error: 'Cannot modify system views' }, { status: 403 });
    }

    // Verify ownership for non-system views
    if (existingView.userId !== user.sub) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Update view
    const [updatedView] = await db
      .update(tableViews)
      .set({
        name: name !== undefined ? name : existingView.name,
        description: description !== undefined ? description : existingView.description,
        columnVisibility: columnVisibility !== undefined ? columnVisibility : existingView.columnVisibility,
        sorting: sorting !== undefined ? sorting : existingView.sorting,
        groupBy: groupBy !== undefined ? groupBy : existingView.groupBy,
        isDefault: isDefault !== undefined ? isDefault : existingView.isDefault,
        metadata: metadata !== undefined ? (metadata && typeof metadata === 'object' ? metadata : null) : existingView.metadata,
        updatedAt: new Date(),
      })
      .where(eq(tableViews.id, viewId))
      .returning();

    // Update filters if provided
    if (filters !== undefined) {
      // Delete existing filters
      await db.delete(tableViewFilters).where(eq(tableViewFilters.viewId, viewId));

      // Insert new filters
      if (Array.isArray(filters) && filters.length > 0) {
        await db.insert(tableViewFilters).values(
          filters.map((filter: any, index: number) => ({
            viewId: viewId,
            field: filter.field,
            operator: filter.operator,
            value: filter.value || null,
            valueType: filter.valueType || null,
            metadata: filter.metadata || null,
            sortOrder: index,
          }))
        );
      }
    }

    // Load filters for response
    const viewFilters = await db
      .select()
      .from(tableViewFilters)
      .where(eq(tableViewFilters.viewId, viewId))
      .orderBy(tableViewFilters.sortOrder);

    return NextResponse.json({
      data: {
        ...updatedView,
        filters: viewFilters,
      },
    });
  } catch (error: any) {
    console.error('Failed to update table view:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update view' }, { status: 500 });
  }
}

/**
 * DELETE /api/table-views/[id]
 * Delete a view
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const viewId = params.id;

    // Get view
    const [existingView] = await db
      .select()
      .from(tableViews)
      .where(eq(tableViews.id, viewId))
      .limit(1);

    if (!existingView) {
      return NextResponse.json({ error: 'View not found' }, { status: 404 });
    }

    if (existingView.isSystem) {
      return NextResponse.json({ error: 'Cannot delete system views' }, { status: 403 });
    }

    // Verify ownership
    if (existingView.userId !== user.sub) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Delete view (filters cascade)
    await db.delete(tableViews).where(eq(tableViews.id, viewId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete table view:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete view' }, { status: 500 });
  }
}

