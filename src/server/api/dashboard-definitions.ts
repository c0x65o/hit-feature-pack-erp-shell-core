// API: /api/dashboard-definitions
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/dashboard-definitions?pack=projects&includeGlobal=true
 *
 * Returns dashboards visible to the user:
 * - public dashboards
 * - dashboards owned by the user
 * - dashboards shared with the user (user/group/role)
 *
 * Optional filtering:
 * - pack=<name>: include pack dashboards for that pack, plus globals if includeGlobal=true (default)
 */
export async function GET(request: NextRequest) {
  try {
    const user = extractUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb();
    const { searchParams } = new URL(request.url);
    const pack = (searchParams.get('pack') || '').trim();
    const includeGlobal = (searchParams.get('includeGlobal') || 'true').toLowerCase() !== 'false';

    const userGroups = (user.groups as string[]) || [];
    const userRoles = (user.roles as string[]) || [];

    const scopeFilter =
      pack
        ? sql`(
            (d."scope"->>'kind' = 'pack' AND d."scope"->>'pack' = ${pack})
            OR (${includeGlobal} AND d."scope"->>'kind' = 'global')
          )`
        : sql`true`;

    const groupList = userGroups.map((g) => sql`${g}`);
    const roleList = userRoles.map((r) => sql`${r}`);
    const sharedAccess =
      userGroups.length || userRoles.length
        ? sql`exists (
            select 1
            from "dashboard_definition_shares" s
            where s.dashboard_id = d.id
              and (
                (s.principal_type = 'user' and s.principal_id = ${user.sub})
                ${userGroups.length ? sql`or (s.principal_type = 'group' and s.principal_id in (${sql.join(groupList, sql`, `)}))` : sql``}
                ${userRoles.length ? sql`or (s.principal_type = 'role' and s.principal_id in (${sql.join(roleList, sql`, `)}))` : sql``}
              )
          )`
        : sql`exists (
            select 1
            from "dashboard_definition_shares" s
            where s.dashboard_id = d.id
              and (s.principal_type = 'user' and s.principal_id = ${user.sub})
          )`;

    const rows = await db.execute(sql`
      select
        d.id,
        d.key,
        d.name,
        d.description,
        d.owner_user_id as "ownerUserId",
        d.is_system as "isSystem",
        d.visibility,
        d.scope,
        d.version,
        d.updated_at as "updatedAt",
        (select count(*)::int from "dashboard_definition_shares" s where s.dashboard_id = d.id) as "shareCount"
      from "dashboard_definitions" d
      where
        ${scopeFilter}
        and (
          d.visibility = 'public'
          or d.owner_user_id = ${user.sub}
          or ${sharedAccess}
        )
      order by
        case when d.scope->>'kind' = 'global' then 0 else 1 end,
        d.name asc
    `);

    return NextResponse.json({ data: (rows as any).rows || [] });
  } catch (error: any) {
    console.error('Failed to list dashboard definitions:', error);
    return NextResponse.json({ error: error?.message || 'Failed to list dashboards' }, { status: 500 });
  }
}

function slugify(s: string): string {
  const x = String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return x || 'dashboard';
}

function normalizeVisibility(v: unknown): 'public' | 'private' {
  const s = String(v || '').toLowerCase().trim();
  return s === 'public' ? 'public' : 'private';
}

function normalizeScope(input: any, fallbackPack?: string): any {
  if (input && typeof input === 'object') {
    const kind = String((input as any).kind || '').toLowerCase().trim();
    if (kind === 'global') return { kind: 'global' };
    if (kind === 'pack') {
      const pack = String((input as any).pack || fallbackPack || '').trim();
      if (pack) return { kind: 'pack', pack };
    }
  }
  if (fallbackPack) return { kind: 'pack', pack: fallbackPack };
  return { kind: 'global' };
}

function normalizeDefinition(def: any): any {
  // Keep validation lightweight but strict enough to avoid broken dashboards.
  if (!def || typeof def !== 'object') throw new Error('definition must be an object');
  const widgets = Array.isArray(def.widgets) ? def.widgets : [];
  const layout = def.layout && typeof def.layout === 'object' ? def.layout : { grid: { cols: 12, rowHeight: 36, gap: 14 } };
  const time = def.time && typeof def.time === 'object' ? def.time : { mode: 'picker', default: 'last_30_days' };
  return { ...def, time, layout, widgets };
}

/**
 * POST /api/dashboard-definitions
 *
 * Create a user-owned dashboard definition.
 * Body:
 *  - name: string (required)
 *  - description?: string
 *  - visibility?: 'public' | 'private' (default: private)
 *  - scope?: { kind: 'global' } | { kind: 'pack', pack: string }
 *  - pack?: string (optional; used as scope fallback when scope is omitted)
 *  - key?: string (optional; otherwise generated)
 *  - definition?: object (required unless sourceKey provided)
 *  - sourceKey?: string (optional; copies an existing dashboard, then applies overrides)
 */
export async function POST(request: NextRequest) {
  try {
    const user = extractUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb();
    const body = await request.json().catch(() => ({}));

    const sourceKey = String(body?.sourceKey || '').trim();
    let source: any = null;
    if (sourceKey) {
      const res = await db.execute(sql`
        select
          d.id,
          d.key,
          d.name,
          d.description,
          d.owner_user_id as "ownerUserId",
          d.is_system as "isSystem",
          d.visibility,
          d.scope,
          d.version,
          d.definition
        from "dashboard_definitions" d
        where d.key = ${sourceKey}
        limit 1
      `);
      source = ((res as any).rows || [])[0] || null;
      if (!source) return NextResponse.json({ error: 'sourceKey not found' }, { status: 404 });
      // If source is private, only owner can copy (or admin).
      const isAdmin = (user.roles as string[])?.includes('admin') || false;
      const canRead = source.visibility === 'public' || source.ownerUserId === user.sub || isAdmin;
      if (!canRead) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const packFallback = String(body?.pack || '').trim() || (source?.scope?.kind === 'pack' ? String(source.scope.pack || '').trim() : '');
    const name = String(body?.name || source?.name || '').trim();
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const description = body?.description !== undefined ? String(body?.description || '') : (source?.description ?? null);
    const visibility = normalizeVisibility(body?.visibility ?? source?.visibility);
    const scope = normalizeScope(body?.scope ?? source?.scope, packFallback || undefined);

    const defIn = body?.definition ?? source?.definition;
    const definition = normalizeDefinition(defIn);

    const providedKey = String(body?.key || '').trim();
    const keyBase = providedKey || `user.${slugify(String(user.sub || 'user'))}.${slugify(name)}`;
    const key = providedKey || `${keyBase}.${Math.random().toString(36).slice(2, 8)}`;

    const now = new Date();
    const res = await db.execute(sql`
      insert into "dashboard_definitions" (
        id,
        key,
        owner_user_id,
        is_system,
        name,
        description,
        visibility,
        scope,
        version,
        definition,
        created_at,
        updated_at
      ) values (
        gen_random_uuid(),
        ${key},
        ${user.sub},
        false,
        ${name},
        ${description},
        ${visibility},
        ${JSON.stringify(scope)}::jsonb,
        0,
        ${JSON.stringify(definition)}::jsonb,
        ${now},
        ${now}
      )
      returning
        id,
        key,
        name,
        description,
        owner_user_id as "ownerUserId",
        is_system as "isSystem",
        visibility,
        scope,
        version,
        definition,
        updated_at as "updatedAt"
    `);
    const row = ((res as any).rows || [])[0];
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (error: any) {
    // key uniqueness collisions should be rare; surface a useful message anyway.
    const msg = error?.message || 'Failed to create dashboard';
    console.error('Failed to create dashboard definition:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


