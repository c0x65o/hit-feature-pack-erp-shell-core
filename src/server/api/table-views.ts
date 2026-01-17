// API: /api/table-views
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  tableViews,
  tableViewFilters,
  tableViewShares,
  type TableView,
  type TableViewFilter,
} from '@/lib/feature-pack-schemas';
import { eq, desc, and, inArray, or, sql } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
import { resolveUserPrincipals, resolveUserOrgScope } from '@hit/feature-pack-auth-core/server/lib/acl-utils';
import { getStaticViewsForTable } from '../lib/static-table-views';

// Required for Next.js App Router
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isAdmin(roles?: string[]): boolean {
  return Array.isArray(roles) && roles.some((r) => String(r || '').toLowerCase() === 'admin');
}

/**
 * GET /api/table-views?tableId=projects
 * List all views for a table:
 * - System/default views
 * - User's custom views
 * - Views shared with the user (by user, group, or role)
 */
export async function GET(request: NextRequest) {
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

    // Static system/default views (schema-defined).
    // These do NOT live in the DB and are read-only.
    const staticSystemViews = getStaticViewsForTable(tableId);
    const staticSystemIds = new Set(staticSystemViews.map((v) => v.id));
    const staticSystemNames = new Set(
      staticSystemViews.map((v) => String(v.name || '').trim().toLowerCase()).filter(Boolean)
    );

    // Get user's custom views
    const userViews = await db
      .select()
      .from(tableViews)
      .where(and(eq(tableViews.userId, user.sub), eq(tableViews.tableId, tableId), eq(tableViews.isSystem, false)))
      .orderBy(desc(tableViews.lastUsedAt), desc(tableViews.createdAt));

    // Get system/default views for this table (default views first, then by creation)
    const systemViewsRaw = await db
      .select()
      .from(tableViews)
      .where(and(eq(tableViews.tableId, tableId), eq(tableViews.isSystem, true)))
      .orderBy(desc(tableViews.isDefault), desc(tableViews.createdAt));
    // De-dupe DB system views that collide with schema-defined views.
    // - Prefer schema-defined (single source of truth)
    // - Also drop by (tableId,name) because some older migrations didn't use stable IDs
    const systemViews = systemViewsRaw.filter((v: TableView) => {
      if (staticSystemIds.has(v.id)) return false;
      const nm = String(v.name || '').trim().toLowerCase();
      if (nm && staticSystemNames.has(nm)) return false;
      return true;
    });

    // Build conditions for views shared with user
    // Shared with: user directly, or their groups, or their roles
    const principals = await resolveUserPrincipals({ request, user });
    const userGroups = principals.groupIds || [];
    const userRoles = principals.roles || [];
    const orgScope = await resolveUserOrgScope({ request, user });
    const divisionIds = orgScope.divisionIds || [];
    const departmentIds = orgScope.departmentIds || [];
    const locationIds = orgScope.locationIds || [];
    
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
      shareConditions.push(
        and(
          eq(tableViewShares.principalType, 'group'),
          inArray(tableViewShares.principalId, userGroups)
        )
      );
    }
    
    // Add role shares if user has roles
    if (userRoles.length > 0) {
      shareConditions.push(
        and(
          eq(tableViewShares.principalType, 'role'),
          inArray(tableViewShares.principalId, userRoles)
        )
      );
    }

    // Add LDD shares (Location/Division/Department) if user has scope ids
    if (divisionIds.length > 0) {
      // principalType is a DB enum in some installs; compare via ::text so unknown values don't error.
      shareConditions.push(
        and(sql`${tableViewShares.principalType}::text = ${'division'}`, inArray(tableViewShares.principalId, divisionIds))
      );
    }
    if (departmentIds.length > 0) {
      shareConditions.push(
        and(sql`${tableViewShares.principalType}::text = ${'department'}`, inArray(tableViewShares.principalId, departmentIds))
      );
    }
    if (locationIds.length > 0) {
      shareConditions.push(
        and(sql`${tableViewShares.principalType}::text = ${'location'}`, inArray(tableViewShares.principalId, locationIds))
      );
    }
    
    // Get views shared with this user (but not owned by them)
    const sharedViewsData = await db
      .select({
        view: tableViews,
        share: tableViewShares,
      })
      .from(tableViewShares)
      .innerJoin(tableViews, eq(tableViewShares.viewId, tableViews.id))
      .where(
        and(
          eq(tableViews.tableId, tableId),
          sql`${tableViews.userId} != ${user.sub}`, // Not owned by current user
          or(...shareConditions)
        )
      )
      .orderBy(desc(tableViewShares.createdAt));

    // Deduplicate shared views (user might have access through multiple paths)
    const sharedViewsMap = new Map<string, { view: TableView; sharedBy: string; sharedByName: string | null }>();
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
      ...userViews.map((v: TableView) => v.id),
      ...systemViews.map((v: TableView) => v.id),
      ...sharedViews.map((s) => s.view.id),
    ];
    const filtersMap = new Map<string, TableViewFilter[]>();
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
        filtersMap.get(filter.viewId)!.push(filter);
      }
    }

    // Build response with all views categorized
    const viewsWithFilters = [
      // Schema-defined system views first (read-only)
      ...staticSystemViews.map((view: any) => ({
        ...view,
        _category: 'system' as const,
      })),
      // DB system views (legacy / admin-created)
      ...systemViews.map((view: TableView) => ({
        ...view,
        filters: filtersMap.get(view.id) || [],
        _category: 'system' as const,
      })),
      // User's own views
      ...userViews.map((view: TableView) => ({
        ...view,
        filters: filtersMap.get(view.id) || [],
        _category: 'user' as const,
      })),
      // Views shared with user
      ...sharedViews.map((shared) => ({
        ...shared.view,
        filters: filtersMap.get(shared.view.id) || [],
        _category: 'shared' as const,
        _sharedBy: shared.sharedBy,
        _sharedByName: shared.sharedByName,
      })),
    ];

    return NextResponse.json({ data: viewsWithFilters });
  } catch (error: any) {
    console.error('Failed to fetch table views:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch views' }, { status: 500 });
  }
}

/**
 * POST /api/table-views
 * Create a new view
 */
export async function POST(request: NextRequest) {
  try {
    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const body = await request.json();
    const { tableId, name, description, filters, columnVisibility, sorting, groupBy, columnOrder, mobileColumns, isDefault, isSystem, metadata } = body;

    if (!tableId || !name) {
      return NextResponse.json({ error: 'tableId and name are required' }, { status: 400 });
    }

    // Only admins can create system views (global/shared by definition).
    if (isSystem && !isAdmin(user.roles)) {
      return NextResponse.json({ error: 'Only admins can create system views' }, { status: 403 });
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
        columnOrder: Array.isArray(columnOrder) ? columnOrder : null,
        mobileColumns: Array.isArray(mobileColumns) ? mobileColumns : null,
        isDefault: isDefault || false,
        isSystem: isSystem || false,
        isShared: false,
        metadata: metadata && typeof metadata === 'object' ? metadata : null,
      })
      .returning();

    // Create filters if provided
    if (filters && Array.isArray(filters) && filters.length > 0) {
      await db.insert(tableViewFilters).values(
        filters.map((filter: any, index: number) => ({
          viewId: view.id,
          field: filter.field,
          operator: filter.operator,
          value: filter.value || null,
          valueType: filter.valueType || null,
          metadata: filter.metadata || null,
          sortOrder: index,
        }))
      );
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
  } catch (error: any) {
    console.error('Failed to create table view:', error);
    return NextResponse.json({ error: error?.message || 'Failed to create view' }, { status: 500 });
  }
}

