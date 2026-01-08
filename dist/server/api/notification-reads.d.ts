import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/notification-reads?ids=a,b,c
 *
 * Returns:
 *  - readIds: string[]
 */
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    readIds: any;
}>>;
/**
 * POST /api/notification-reads
 *
 * Body:
 *  - ids: string[]
 *
 * Behavior:
 *  - upserts read state for each id (idempotent)
 */
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    ok: boolean;
    upserted: number;
}>>;
//# sourceMappingURL=notification-reads.d.ts.map