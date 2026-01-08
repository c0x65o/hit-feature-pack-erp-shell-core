import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { extractUserFromRequest } from '../auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function loadCapabilities(projectRoot) {
    try {
        const p = path.join(projectRoot, '.hit', 'generated', 'capabilities.json');
        if (!fs.existsSync(p))
            return null;
        const raw = fs.readFileSync(p, 'utf8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export async function GET(request) {
    const user = extractUserFromRequest(request);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const pack = (searchParams.get('pack') || '').trim();
    if (!pack) {
        return NextResponse.json({ error: "Missing required query param: 'pack'" }, { status: 400 });
    }
    const projectRoot = process.cwd();
    const caps = loadCapabilities(projectRoot);
    const endpoints = Array.isArray(caps?.endpoints) ? caps.endpoints : [];
    // Tool surface is simply endpoints belonging to the feature pack.
    const tools = endpoints.filter((ep) => String(ep?._featurePack || '') === pack);
    // Dynamic, user-scoped capability unions:
    // Some packs (notably metrics-core) have *data-level ACL* where the tool itself is static
    // (e.g. /api/metrics/query) but the *allowed keys/options* are user-specific.
    //
    // Nexus/agents should not even see forbidden items (fail closed).
    let dynamic = null;
    if (pack === 'metrics-core') {
        try {
            const origin = new URL(request.url).origin;
            const auth = request.headers.get('authorization');
            const cookie = request.headers.get('cookie');
            const headers = {};
            if (auth)
                headers['authorization'] = auth;
            if (cookie)
                headers['cookie'] = cookie;
            const resp = await fetch(`${origin}/api/metrics/catalog`, { headers });
            const json = await resp.json().catch(() => null);
            const items = Array.isArray(json?.items) ? json.items : [];
            const allowedMetricKeys = items
                .map((it) => String(it?.key || '').trim())
                .filter((k) => Boolean(k));
            dynamic = {
                metrics: {
                    allowedMetricKeys,
                },
            };
        }
        catch {
            // Fail closed: if we can't compute per-user allowed keys, expose none.
            dynamic = { metrics: { allowedMetricKeys: [] } };
        }
    }
    return NextResponse.json({
        generated: Boolean(caps?.generated),
        kind: 'hit-nexus-tools',
        pack,
        tools,
        dynamic,
    });
}
