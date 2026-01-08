import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
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
 *
 * IMPORTANT:
 * - For per-row bucket values, metrics-core uses first-match-wins (exclusive buckets) ordering by sortOrder.
 * - For server-side grouping, we align with that behavior by using the evaluate endpoint and grouping IDs.
 */
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    data: {
        tableId: any;
        columnKey: any;
        entityKind: any;
        buckets: any[];
    };
}>>;
//# sourceMappingURL=table-data-grouped-buckets.d.ts.map