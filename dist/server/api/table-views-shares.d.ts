import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/table-views/[id]/shares
 * List all share entries for a view (owner only)
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
 * POST /api/table-views/[id]/shares
 * Add a share entry for a view
 *
 * Body: { principalType: 'user' | 'group' | 'role', principalId: string }
 *
 * Non-admins can only share with users (principalType: 'user')
 * Admins can share with users, groups, or roles
 */
export declare function POST(request: NextRequest, { params }: {
    params: {
        id: string;
    };
}): Promise<NextResponse<{
    data: any;
}> | NextResponse<{
    error: any;
}>>;
/**
 * DELETE /api/table-views/[id]/shares
 * Remove a share entry for a view
 *
 * Query params: ?principalType=user&principalId=someone@example.com
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
//# sourceMappingURL=table-views-shares.d.ts.map