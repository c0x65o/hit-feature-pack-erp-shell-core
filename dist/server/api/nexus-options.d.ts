import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
type PackMeta = {
    name: string;
    title?: string | null;
    description?: string | null;
    ai?: {
        agentPrompt?: string | null;
    } | null;
};
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    generated: boolean;
    kind: string;
    nexusPrompt: any;
    debugEnabled: boolean;
    packs: PackMeta[];
}>>;
export {};
//# sourceMappingURL=nexus-options.d.ts.map