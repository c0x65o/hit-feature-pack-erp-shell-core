import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * POST /api/table-data/batch
 *
 * Body:
 *  - tableId: string
 *  - ids: string[]
 *
 * Returns:
 *  - data: { items: any[] }
 */
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    data: {
        items: any;
    };
}>>;
//# sourceMappingURL=table-data-batch.d.ts.map