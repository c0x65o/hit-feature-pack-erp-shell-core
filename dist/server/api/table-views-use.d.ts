import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * PATCH /api/table-views/[id]/use
 * Mark a view as used (update lastUsedAt)
 */
export declare function PATCH(request: NextRequest, { params }: {
    params: {
        id: string;
    };
}): Promise<NextResponse<{
    success: boolean;
}> | NextResponse<{
    error: any;
}>>;
//# sourceMappingURL=table-views-use.d.ts.map