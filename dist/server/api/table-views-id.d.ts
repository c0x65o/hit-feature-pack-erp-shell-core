import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/table-views/[id]
 * Get a single view by ID
 */
export declare function GET(request: NextRequest, { params }: {
    params: {
        id: string;
    };
}): Promise<NextResponse<{
    data: any;
}> | NextResponse<{
    error: any;
}>>;
/**
 * PUT /api/table-views/[id]
 * Update an existing view
 */
export declare function PUT(request: NextRequest, { params }: {
    params: {
        id: string;
    };
}): Promise<NextResponse<{
    data: any;
}> | NextResponse<{
    error: any;
}>>;
/**
 * DELETE /api/table-views/[id]
 * Delete a view
 */
export declare function DELETE(request: NextRequest, { params }: {
    params: {
        id: string;
    };
}): Promise<NextResponse<{
    success: boolean;
}> | NextResponse<{
    error: any;
}>>;
//# sourceMappingURL=table-views-id.d.ts.map