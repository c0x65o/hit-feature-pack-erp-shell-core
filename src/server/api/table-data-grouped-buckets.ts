// API: /api/table-data/grouped-buckets
import { NextRequest, NextResponse } from 'next/server';
import { extractUserFromRequest } from '../auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function requireAdmin(request: NextRequest) {
  const user = extractUserFromRequest(request);
  if (!user) return { ok: false as const, res: jsonError('Unauthorized', 401) };
  const roles = Array.isArray((user as any).roles) ? ((user as any).roles as string[]) : [];
  if (!roles.includes('admin')) return { ok: false as const, res: jsonError('Forbidden', 403) };
  return { ok: true as const };
}

async function callSameOrigin(request: NextRequest, path: string, init: RequestInit): Promise<Response> {
  const url = new URL(request.url);
  const target = `${url.origin}${path}`;

  const headers = new Headers(init.headers || {});
  // Forward caller auth + service token if present.
  const auth = request.headers.get('authorization') || request.headers.get('Authorization');
  if (auth) headers.set('Authorization', auth);
  const svc = request.headers.get('x-hit-service-token') || request.headers.get('X-HIT-Service-Token');
  if (svc) headers.set('X-HIT-Service-Token', svc);

  return fetch(target, { ...init, headers });
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
 */
export async function POST(request: NextRequest) {
  const gate = requireAdmin(request);
  if (!gate.ok) return gate.res;

  const body = (await request.json().catch(() => null)) as any;
  if (!body) return jsonError('Invalid JSON body', 400);

  const tableId = typeof body.tableId === 'string' ? body.tableId.trim() : '';
  const columnKey = typeof body.columnKey === 'string' ? body.columnKey.trim() : '';
  const entityKind = typeof body.entityKind === 'string' ? body.entityKind.trim() : '';
  const pageSize = body.pageSize;
  const bucketPages = body.bucketPages;

  if (!tableId) return jsonError('Missing tableId', 400);
  if (!columnKey) return jsonError('Missing columnKey', 400);
  if (!entityKind) return jsonError('Missing entityKind', 400);

  const segRes = await callSameOrigin(request, '/api/metrics/segments/table-buckets/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tableId, columnKey, entityKind, pageSize, bucketPages }),
  });
  const segJson = await segRes.json().catch(() => ({}));
  if (!segRes.ok) return jsonError(segJson?.error || `Failed to query bucket segments (${segRes.status})`, segRes.status);

  const buckets = Array.isArray(segJson?.data?.buckets) ? segJson.data.buckets : [];
  const out: any[] = [];

  for (const b of buckets) {
    const ids = Array.isArray(b?.items) ? b.items : [];
    const batchRes = await callSameOrigin(request, '/api/table-data/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId, ids }),
    });
    const batchJson = await batchRes.json().catch(() => ({}));
    if (!batchRes.ok) return jsonError(batchJson?.error || `Failed to load rows for bucket (${batchRes.status})`, batchRes.status);
    const rows = Array.isArray(batchJson?.data?.items) ? batchJson.data.items : [];
    out.push({ ...b, rows });
  }

  return NextResponse.json({ data: { tableId, columnKey, entityKind, buckets: out } });
}


