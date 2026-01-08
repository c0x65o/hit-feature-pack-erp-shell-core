import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/table-views?tableId=projects
 * List all views for a table:
 * - System/default views
 * - User's custom views
 * - Views shared with the user (by user, group, or role)
 */
export declare function GET(request: NextRequest): Promise<NextResponse<{
    data: any[];
}> | NextResponse<{
    error: any;
}>>;
/**
 * POST /api/table-views
 * Create a new view
 */
export declare function POST(request: NextRequest): Promise<NextResponse<{
    data: any;
}> | NextResponse<{
    error: any;
}>>;
//# sourceMappingURL=table-views.d.ts.map