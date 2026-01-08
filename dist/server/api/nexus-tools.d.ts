import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    generated: boolean;
    kind: string;
    pack: string;
    tools: any;
    dynamic: Record<string, any> | null;
}>>;
//# sourceMappingURL=nexus-tools.d.ts.map