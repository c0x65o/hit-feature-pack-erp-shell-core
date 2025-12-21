'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from 'react';
import { useUi } from '@hit/ui-kit';
import { AclPicker } from '@hit/ui-kit';
import { useThemeTokens } from '@hit/ui-kit';
import * as LucideIcons from 'lucide-react';
import * as SimpleIcons from 'react-icons/si';
function resolveLucideIcon(name) {
    if (!name)
        return null;
    const Comp = LucideIcons[name];
    return Comp || null;
}
function toPascal(s) {
    return String(s || '')
        .replace(/[_\-\s]+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join('');
}
function resolvePlatformIcon(name) {
    if (!name)
        return null;
    const raw = String(name || '').trim();
    if (!raw)
        return null;
    // Supported formats:
    // - "si:discord" (SimpleIcons via react-icons/si)
    // - "brand:discord" (alias to SimpleIcons)
    // - "lucide:Users" (force lucide)
    // - "Discord" (lucide default behavior)
    const [nsMaybe, valMaybe] = raw.includes(':') ? raw.split(':', 2) : [null, raw];
    const ns = (nsMaybe || '').toLowerCase();
    const val = String(valMaybe || '').trim();
    if (!val)
        return null;
    const tryLucide = (n) => resolveLucideIcon(n);
    const trySimple = (key) => {
        const pas = toPascal(key);
        const candidates = [
            `Si${pas}`,
            // common exceptions / alternates
            key.toLowerCase() === 'x' ? 'SiX' : '',
            key.toLowerCase() === 'twitter' ? 'SiX' : '',
            key.toLowerCase() === 'xcom' ? 'SiX' : '',
            key.toLowerCase() === 'x-dot-org' ? 'SiXdotorg' : '',
        ].filter(Boolean);
        for (const cand of candidates) {
            const Comp = SimpleIcons[cand];
            if (Comp)
                return Comp;
        }
        return null;
    };
    if (ns === 'lucide')
        return tryLucide(val);
    if (ns === 'si' || ns === 'simpleicons')
        return trySimple(val);
    if (ns === 'brand' || ns === 'platform') {
        const alias = val.toLowerCase();
        const m = {
            discord: 'discord',
            steam: 'steam',
            tiktok: 'tiktok',
            facebook: 'facebook',
            instagram: 'instagram',
            youtube: 'youtube',
            twitch: 'twitch',
            reddit: 'reddit',
            linkedin: 'linkedin',
            spotify: 'spotify',
            x: 'x',
            twitter: 'x',
        };
        return trySimple(m[alias] || alias);
    }
    // Default behavior: keep existing lucide names working,
    // but also allow passing "si:..." if you want guaranteed brand icons.
    return tryLucide(val) || trySimple(val);
}
function selectValue(v) {
    return typeof v === 'string' ? v : String(v?.target?.value ?? '');
}
function todayISODate() {
    return new Date().toISOString().slice(0, 10);
}
function addDays(d, days) {
    return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}
function startOfMonth(d) {
    const x = new Date(d);
    x.setDate(1);
    x.setHours(0, 0, 0, 0);
    return x;
}
function startOfYear(d) {
    const x = new Date(d);
    x.setMonth(0, 1);
    x.setHours(0, 0, 0, 0);
    return x;
}
function toRangeFromPreset(preset) {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    let start;
    if (preset === 'last_7_days')
        start = addDays(now, -7);
    else if (preset === 'last_30_days')
        start = addDays(now, -30);
    else if (preset === 'last_90_days')
        start = addDays(now, -90);
    else if (preset === 'month_to_date')
        start = startOfMonth(now);
    else if (preset === 'year_to_date')
        start = startOfYear(now);
    else
        start = addDays(now, -30);
    start.setHours(0, 0, 0, 0);
    return { start: start.toISOString(), end: end.toISOString() };
}
function getByPath(obj, path) {
    if (!obj || typeof obj !== 'object')
        return undefined;
    const parts = String(path || '').split('.').filter(Boolean);
    let cur = obj;
    for (const p of parts) {
        if (cur && typeof cur === 'object' && p in cur)
            cur = cur[p];
        else
            return undefined;
    }
    return cur;
}
function formatNumber(v, style = 'number') {
    if (!Number.isFinite(v))
        return '—';
    if (style === 'usd') {
        if (Math.abs(v) >= 1000000)
            return `$${(v / 1000000).toFixed(1)}M`;
        if (Math.abs(v) >= 1000)
            return `$${(v / 1000).toFixed(1)}K`;
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
    }
    if (style === 'percent')
        return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
    if (Math.abs(v) >= 1000000)
        return `${(v / 1000000).toFixed(1)}M`;
    if (Math.abs(v) >= 1000)
        return `${(v / 1000).toFixed(1)}K`;
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(v);
}
function palette(idx) {
    const colors = ['#6366f1', '#22c55e', '#06b6d4', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6', '#3b82f6'];
    return colors[idx % colors.length];
}
function Donut({ slices, format, }) {
    const { colors, radius, shadows } = useThemeTokens();
    const total = slices.reduce((a, s) => a + (Number.isFinite(s.value) ? s.value : 0), 0) || 1;
    const cx = 120;
    const cy = 120;
    const rOuter = 100;
    const rInner = 62;
    let startAngle = -Math.PI / 2;
    const paths = slices.map((s) => {
        const frac = Math.max(0, Math.min(1, s.value / total));
        const endAngle = startAngle + frac * Math.PI * 2;
        const large = endAngle - startAngle > Math.PI ? 1 : 0;
        const x1 = cx + rOuter * Math.cos(startAngle);
        const y1 = cy + rOuter * Math.sin(startAngle);
        const x2 = cx + rOuter * Math.cos(endAngle);
        const y2 = cy + rOuter * Math.sin(endAngle);
        const x3 = cx + rInner * Math.cos(endAngle);
        const y3 = cy + rInner * Math.sin(endAngle);
        const x4 = cx + rInner * Math.cos(startAngle);
        const y4 = cy + rInner * Math.sin(startAngle);
        const d = [
            `M ${x1} ${y1}`,
            `A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2}`,
            `L ${x3} ${y3}`,
            `A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4}`,
            'Z',
        ].join(' ');
        startAngle = endAngle;
        return { ...s, d };
    });
    const wrapRef = React.useRef(null);
    const [hovered, setHovered] = React.useState(null);
    const [mouse, setMouse] = React.useState(null);
    const onMove = (e) => {
        if (!wrapRef.current)
            return;
        const r = wrapRef.current.getBoundingClientRect();
        setMouse({ x: e.clientX - r.left, y: e.clientY - r.top });
    };
    return (_jsxs("div", { className: "donut-wrap", ref: wrapRef, onMouseMove: onMove, style: { position: 'relative' }, children: [_jsxs("svg", { viewBox: "0 0 240 240", className: "donut", children: [paths.map((p) => {
                        const isHot = hovered?.label === p.label;
                        const pct = (Number.isFinite(p.value) ? p.value : 0) / total * 100;
                        return (_jsx("path", { d: p.d, fill: p.color, fillOpacity: isHot ? 1 : 0.92, stroke: isHot ? colors.border.strong : 'transparent', strokeWidth: isHot ? 2 : 0, style: {
                                cursor: 'default',
                                filter: isHot ? 'drop-shadow(0 10px 18px rgba(0,0,0,0.16))' : 'none',
                            }, onMouseEnter: () => setHovered({ label: p.label, value: p.value, color: p.color, pct }), onMouseLeave: () => setHovered(null) }, p.label));
                    }), _jsx("text", { x: "120", y: "118", textAnchor: "middle", fontSize: "12", fill: "currentColor", fillOpacity: 0.55, children: "Total" }), _jsx("text", { x: "120", y: "146", textAnchor: "middle", fontSize: "20", fontWeight: "800", fill: "currentColor", children: formatNumber(total, format) })] }), _jsx("div", { className: "donut-legend", children: slices.map((s) => {
                    const isHot = hovered?.label === s.label;
                    const pct = (Number.isFinite(s.value) ? s.value : 0) / total * 100;
                    return (_jsxs("div", { className: "legend-row", style: {
                            padding: '6px 8px',
                            borderRadius: radius.md,
                            background: isHot ? colors.bg.muted : 'transparent',
                        }, onMouseEnter: () => setHovered({ label: s.label, value: s.value, color: s.color, pct }), onMouseLeave: () => setHovered(null), children: [_jsx("span", { className: "legend-dot", style: { backgroundColor: s.color } }), _jsx("span", { className: "legend-label", children: s.label }), _jsx("span", { className: "legend-value", children: formatNumber(s.value, format) })] }, s.label));
                }) }), hovered && mouse ? (_jsxs("div", { style: {
                    position: 'absolute',
                    left: Math.max(14, Math.min(mouse.x, 520)),
                    top: Math.max(14, mouse.y - 8),
                    transform: 'translate(-50%, -100%)',
                    pointerEvents: 'none',
                    background: colors.bg.surface,
                    color: colors.text.primary,
                    border: `1px solid ${colors.border.subtle}`,
                    borderRadius: radius.lg,
                    boxShadow: shadows.lg,
                    padding: '10px 12px',
                    minWidth: 220,
                    zIndex: 2,
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }, children: [_jsx("span", { style: { width: 10, height: 10, borderRadius: 999, background: hovered.color, display: 'inline-block' } }), _jsx("div", { style: {
                                    fontSize: 12,
                                    color: colors.text.secondary,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }, children: hovered.label })] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }, children: [_jsx("div", { style: { fontSize: 18, fontWeight: 800 }, children: formatNumber(Number(hovered.value || 0), format) }), _jsxs("div", { style: { fontSize: 12, color: colors.text.secondary, fontVariantNumeric: 'tabular-nums' }, children: [Number.isFinite(hovered.pct) ? hovered.pct.toFixed(1) : '0.0', "%"] })] })] })) : null] }));
}
function MultiLineChart({ title, format, series, bucket, bucketControl, }) {
    const { colors, radius, shadows } = useThemeTokens();
    const wPx = 900;
    const hPx = 240;
    const paddingX = 44;
    const paddingY = 34;
    const all = series.flatMap((s) => s.points.map((p) => p.v));
    const min = all.length ? Math.min(...all) : 0;
    const max = all.length ? Math.max(...all) : 1;
    const range = max - min || 1;
    const buckets = series[0]?.points?.map((p) => p.t) || [];
    const toX = (idx) => buckets.length <= 1 ? paddingX : paddingX + (idx / (buckets.length - 1)) * (wPx - paddingX * 2);
    const toY = (v) => hPx - paddingY - ((v - min) / range) * (hPx - paddingY * 2);
    const yLabels = [
        { y: toY(max), label: formatNumber(max, format) },
        { y: toY((max + min) / 2), label: formatNumber((max + min) / 2, format) },
        { y: toY(min), label: formatNumber(min, format) },
    ];
    const formatBucketLabel = (t) => {
        const d = new Date(t);
        if (bucket === 'month')
            return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
        if (bucket === 'week')
            return `Wk of ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
        if (bucket === 'hour')
            return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric' });
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };
    const xLabels = [];
    if (buckets.length >= 2) {
        xLabels.push({ x: toX(0), label: formatBucketLabel(buckets[0]) });
        if (buckets.length > 2)
            xLabels.push({ x: toX(Math.floor(buckets.length / 2)), label: formatBucketLabel(buckets[Math.floor(buckets.length / 2)]) });
        xLabels.push({ x: toX(buckets.length - 1), label: formatBucketLabel(buckets[buckets.length - 1]) });
    }
    const wrapRef = React.useRef(null);
    const [hoverIdx, setHoverIdx] = React.useState(null);
    const handleMove = (evt) => {
        if (!wrapRef.current || buckets.length === 0)
            return;
        const rect = wrapRef.current.getBoundingClientRect();
        const x = evt.clientX - rect.left;
        const frac = (x - 0) / rect.width;
        const idx = Math.round(frac * (buckets.length - 1));
        setHoverIdx(Math.max(0, Math.min(buckets.length - 1, idx)));
    };
    const handleLeave = () => setHoverIdx(null);
    const tooltip = hoverIdx !== null && buckets[hoverIdx] ? {
        t: buckets[hoverIdx],
        x: toX(hoverIdx),
        items: series.map((s) => ({
            label: s.label,
            color: s.color,
            v: s.points[hoverIdx]?.v ?? 0,
        })),
    } : null;
    return (_jsxs("div", { className: "card", ref: wrapRef, onMouseMove: handleMove, onMouseLeave: handleLeave, style: { position: 'relative' }, children: [_jsxs("div", { className: "card-head", children: [_jsx("div", { className: "card-title", children: title }), _jsxs("div", { style: { display: 'flex', gap: 10, alignItems: 'center' }, children: [bucketControl, _jsxs("div", { className: "card-subtle", children: [series.length, " series"] })] })] }), _jsxs("div", { className: "card-body", children: [_jsxs("svg", { viewBox: `0 0 ${wPx} ${hPx}`, preserveAspectRatio: "none", className: "chart-svg", children: [yLabels.map((yl, i) => (_jsx("line", { x1: paddingX, y1: yl.y, x2: wPx - paddingX, y2: yl.y, stroke: "currentColor", strokeOpacity: 0.10, strokeDasharray: "4 4" }, i))), series.map((s) => {
                                const pts = s.points;
                                const line = pts.map((p, idx) => `${toX(idx).toFixed(1)},${toY(p.v).toFixed(1)}`).join(' ');
                                return (_jsx("polyline", { fill: "none", stroke: s.color, strokeWidth: "2.3", strokeLinejoin: "round", strokeLinecap: "round", points: line }, s.label));
                            }), tooltip ? (_jsx("line", { x1: tooltip.x, y1: paddingY, x2: tooltip.x, y2: hPx - paddingY, stroke: "currentColor", strokeOpacity: 0.18 })) : null, yLabels.map((yl, i) => (_jsx("text", { x: paddingX - 8, y: yl.y + 4, textAnchor: "end", fontSize: "11", fill: "currentColor", fillOpacity: 0.55, children: yl.label }, i))), xLabels.map((xl, i) => (_jsx("text", { x: xl.x, y: hPx - 8, textAnchor: "middle", fontSize: "11", fill: "currentColor", fillOpacity: 0.55, children: xl.label }, i)))] }), tooltip ? (_jsxs("div", { style: {
                            position: 'absolute',
                            top: 58,
                            left: `${Math.max(12, Math.min(tooltip.x / wPx * 100, 88))}%`,
                            transform: 'translateX(-50%)',
                            pointerEvents: 'none',
                            color: colors.text.primary,
                            background: colors.bg.surface,
                            border: `1px solid ${colors.border.subtle}`,
                            borderRadius: radius.lg,
                            padding: '10px 12px',
                            minWidth: 220,
                            boxShadow: shadows.lg,
                        }, children: [_jsx("div", { style: { fontSize: 12, marginBottom: 8, color: colors.text.secondary }, children: formatBucketLabel(tooltip.t) }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: tooltip.items.map((it) => (_jsxs("div", { style: { display: 'grid', gridTemplateColumns: '10px 1fr auto', gap: 10, alignItems: 'center' }, children: [_jsx("span", { style: { width: 10, height: 10, borderRadius: 999, background: it.color, display: 'inline-block' } }), _jsx("span", { style: { fontSize: 12, color: colors.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, children: it.label }), _jsx("span", { style: { fontSize: 12, color: colors.text.secondary, fontVariantNumeric: 'tabular-nums' }, children: formatNumber(Number(it.v || 0), format) })] }, it.label))) })] })) : null, _jsx("div", { className: "legend", children: series.map((s) => (_jsxs("div", { className: "legend-pill", children: [_jsx("span", { className: "legend-dot", style: { backgroundColor: s.color } }), _jsx("span", { className: "legend-label", children: s.label })] }, s.label))) })] })] }));
}
export function Dashboards() {
    const { Page, Card, Button, Dropdown, Select, Input, Modal, Spinner, Badge } = useUi();
    const { colors, radius } = useThemeTokens();
    const [list, setList] = React.useState([]);
    const [selectedKey, setSelectedKey] = React.useState('');
    const [definition, setDefinition] = React.useState(null);
    const [loadingList, setLoadingList] = React.useState(false);
    const [loadingDash, setLoadingDash] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [catalogByKey, setCatalogByKey] = React.useState({});
    const [preset, setPreset] = React.useState('last_30_days');
    const [customStart, setCustomStart] = React.useState(() => todayISODate());
    const [customEnd, setCustomEnd] = React.useState(() => todayISODate());
    const [shareOpen, setShareOpen] = React.useState(false);
    const [shares, setShares] = React.useState([]);
    const [sharesLoading, setSharesLoading] = React.useState(false);
    const [sharesError, setSharesError] = React.useState(null);
    const [kpiValues, setKpiValues] = React.useState({});
    const [kpiCatalogTotals, setKpiCatalogTotals] = React.useState({});
    const [pieRows, setPieRows] = React.useState({});
    const [lineSeries, setLineSeries] = React.useState({});
    const [lineBucketByWidgetKey, setLineBucketByWidgetKey] = React.useState({});
    const [projectNames, setProjectNames] = React.useState({});
    const urlParams = React.useMemo(() => {
        if (typeof window === 'undefined')
            return new URLSearchParams();
        return new URLSearchParams(window.location.search);
    }, []);
    const pack = React.useMemo(() => (typeof window === 'undefined' ? '' : (new URLSearchParams(window.location.search).get('pack') || '').trim()), []);
    const range = React.useMemo(() => {
        if (preset === 'custom') {
            const start = new Date(`${customStart}T00:00:00.000Z`);
            const end = new Date(`${customEnd}T23:59:59.999Z`);
            return { start: start.toISOString(), end: end.toISOString() };
        }
        return toRangeFromPreset(preset);
    }, [preset, customStart, customEnd]);
    const loadCatalog = React.useCallback(async () => {
        try {
            const map = await fetchCatalogMap();
            if (Object.keys(map).length)
                setCatalogByKey(map);
        }
        catch {
            // ignore
        }
    }, []);
    function buildCatalogMap(items) {
        const map = {};
        for (const it of items) {
            const key = typeof it?.key === 'string' ? it.key : '';
            if (!key)
                continue;
            map[key] = {
                key,
                label: typeof it?.label === 'string' ? it.label : key,
                unit: typeof it?.unit === 'string' ? it.unit : 'count',
                icon: typeof it?.icon === 'string' ? it.icon : undefined,
                icon_color: typeof it?.icon_color === 'string' ? it.icon_color : undefined,
                category: typeof it?.category === 'string' ? it.category : undefined,
                rollup_strategy: typeof it?.rollup_strategy === 'string' ? it.rollup_strategy : undefined,
                time_kind: it?.time_kind === 'realtime' || it?.time_kind === 'none' || it?.time_kind === 'timeseries'
                    ? it.time_kind
                    : undefined,
                owner: it?.owner &&
                    typeof it.owner === 'object' &&
                    typeof it.owner.kind === 'string' &&
                    typeof it.owner.id === 'string'
                    ? it.owner
                    : undefined,
                entity_kinds: Array.isArray(it?.entity_kinds)
                    ? it.entity_kinds.filter((x) => typeof x === 'string')
                    : undefined,
                pointsCount: typeof it?.pointsCount === 'number' ? it.pointsCount : undefined,
            };
        }
        return map;
    }
    async function fetchCatalogMap() {
        const res = await fetch('/api/metrics/catalog');
        const json = await res.json().catch(() => ({}));
        if (!res.ok)
            return {};
        const items = Array.isArray(json.items) ? json.items : Array.isArray(json.data) ? json.data : [];
        return buildCatalogMap(items);
    }
    function pMapLimit(items, limit, fn) {
        const lim = Math.max(1, Math.min(25, Number(limit || 0) || 8));
        let i = 0;
        const out = new Array(items.length);
        const workers = new Array(Math.min(lim, items.length)).fill(0).map(async () => {
            while (true) {
                const idx = i++;
                if (idx >= items.length)
                    break;
                out[idx] = await fn(items[idx], idx);
            }
        });
        return Promise.all(workers).then(() => out);
    }
    function fallbackIconForMetric(cat) {
        const c = String(cat || '').toLowerCase();
        if (c.includes('revenue') || c.includes('sales'))
            return 'DollarSign';
        if (c.includes('marketing') || c.includes('followers') || c.includes('wishlist'))
            return 'Megaphone';
        if (c.includes('user') || c.includes('customer'))
            return 'Users';
        if (c.includes('project') || c.includes('game'))
            return 'Gamepad2';
        return 'BarChart3';
    }
    const loadList = React.useCallback(async () => {
        try {
            setLoadingList(true);
            setError(null);
            // When pack-scoped, default to pack dashboards only (no global) for MVP.
            const u = pack ? `/api/dashboard-definitions?pack=${encodeURIComponent(pack)}&includeGlobal=false` : '/api/dashboard-definitions';
            const res = await fetch(u);
            const json = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(json?.error || `Failed (${res.status})`);
            const items = Array.isArray(json.data) ? json.data : [];
            setList(items);
            const fromUrl = (typeof window !== 'undefined') ? (new URLSearchParams(window.location.search).get('key') || '').trim() : '';
            const pick = fromUrl || items[0]?.key || '';
            setSelectedKey((prev) => prev || pick);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setLoadingList(false);
        }
    }, [pack]);
    const loadDefinition = React.useCallback(async (key) => {
        if (!key)
            return;
        try {
            setLoadingDash(true);
            setError(null);
            const res = await fetch(`/api/dashboard-definitions/${encodeURIComponent(key)}`);
            const json = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(json?.error || `Failed (${res.status})`);
            setDefinition(json.data);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setLoadingDash(false);
        }
    }, []);
    React.useEffect(() => {
        loadCatalog();
        loadList();
    }, []);
    React.useEffect(() => {
        if (!selectedKey)
            return;
        // keep URL in sync
        if (typeof window !== 'undefined') {
            const sp = new URLSearchParams(window.location.search);
            sp.set('key', selectedKey);
            const next = `${window.location.pathname}?${sp.toString()}`;
            window.history.replaceState({}, '', next);
        }
        loadDefinition(selectedKey);
    }, [selectedKey]);
    const resolveProjectNames = React.useCallback(async (ids) => {
        const missing = ids.filter((id) => id && !projectNames[id]);
        if (!missing.length)
            return;
        const next = {};
        await Promise.all(missing.slice(0, 25).map(async (id) => {
            try {
                const res = await fetch(`/api/projects/${encodeURIComponent(id)}`);
                const json = await res.json().catch(() => ({}));
                if (!res.ok)
                    return;
                const name = typeof json?.data?.name === 'string' ? json.data.name : id;
                next[id] = name;
            }
            catch {
                // ignore
            }
        }));
        if (Object.keys(next).length)
            setProjectNames((p) => ({ ...p, ...next }));
    }, [projectNames]);
    // Return a mapping of id -> name (also updates state cache). Used to avoid render races.
    const fetchProjectNames = React.useCallback(async (ids) => {
        const unique = Array.from(new Set(ids.filter(Boolean)));
        const missing = unique.filter((id) => !projectNames[id]);
        const out = {};
        if (missing.length === 0)
            return out;
        await Promise.all(missing.slice(0, 25).map(async (id) => {
            try {
                const res = await fetch(`/api/projects/${encodeURIComponent(id)}`);
                const json = await res.json().catch(() => ({}));
                if (!res.ok)
                    return;
                const name = typeof json?.data?.name === 'string' ? json.data.name : id;
                out[id] = name;
            }
            catch {
                // ignore
            }
        }));
        if (Object.keys(out).length)
            setProjectNames((p) => ({ ...p, ...out }));
        return out;
    }, [projectNames]);
    const effectiveTime = React.useCallback((widget) => {
        const mode = widget?.time || 'inherit';
        if (mode === 'all_time')
            return null;
        return range;
    }, [range]);
    const queryMetrics = React.useCallback(async () => {
        if (!definition?.definition)
            return;
        const def = definition.definition;
        const widgets = Array.isArray(def.widgets) ? def.widgets : [];
        // KPI Catalog (auto-generated KPI tiles from metrics catalog)
        const kpiCatalogs = widgets.filter((w) => w?.kind === 'kpi_catalog');
        if (kpiCatalogs.length) {
            setKpiCatalogTotals((prev) => {
                const next = { ...prev };
                for (const w of kpiCatalogs)
                    next[w.key] = { loading: true, totalsByMetricKey: prev[w.key]?.totalsByMetricKey || {} };
                return next;
            });
            await Promise.all(kpiCatalogs.map(async (w) => {
                try {
                    // Fetch a local snapshot of the catalog so we can compute immediately (avoid setState timing).
                    const catalogMap = Object.keys(catalogByKey || {}).length ? catalogByKey : await fetchCatalogMap();
                    if (!Object.keys(catalogByKey || {}).length && Object.keys(catalogMap).length)
                        setCatalogByKey(catalogMap);
                    const pres = w?.presentation || {};
                    const entityKind = typeof pres?.entityKind === 'string' ? pres.entityKind : 'project';
                    const onlyWithPoints = pres?.onlyWithPoints === true;
                    const items = Object.values(catalogMap || {});
                    const filtered = items
                        .filter((it) => {
                        const kinds = Array.isArray(it.entity_kinds) ? it.entity_kinds : [];
                        if (kinds.length && !kinds.includes(entityKind))
                            return false;
                        if (onlyWithPoints && Number(it.pointsCount || 0) <= 0)
                            return false;
                        return true;
                    })
                        .sort((a, b) => String(a.label || a.key).localeCompare(String(b.label || b.key)));
                    const t = effectiveTime(w);
                    const totalsByMetricKey = {};
                    await pMapLimit(filtered, 10, async (it) => {
                        const mk = String(it.key || '').trim();
                        if (!mk)
                            return;
                        // Decide aggregation: sum-series metrics => sum; last/realtime => sum of last per entity.
                        const roll = String(it.rollup_strategy || '').toLowerCase();
                        const timeKind = String(it.time_kind || '').toLowerCase();
                        const agg = (roll === 'last' || timeKind === 'realtime' || timeKind === 'none') ? 'last' : 'sum';
                        const body = {
                            metricKey: mk,
                            bucket: 'none',
                            agg,
                            entityKind,
                            groupByEntityId: true,
                        };
                        if (t)
                            Object.assign(body, t);
                        const res = await fetch('/api/metrics/query', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body),
                        });
                        const json = await res.json().catch(() => ({}));
                        if (!res.ok)
                            throw new Error(json?.error || `metrics/query ${res.status}`);
                        const rows = Array.isArray(json.data) ? json.data : [];
                        const sum = rows.reduce((acc, r) => acc + Number(r.value ?? 0), 0);
                        totalsByMetricKey[mk] = Number.isFinite(sum) ? sum : 0;
                    });
                    setKpiCatalogTotals((p) => ({ ...p, [w.key]: { loading: false, totalsByMetricKey } }));
                }
                catch {
                    setKpiCatalogTotals((p) => ({ ...p, [w.key]: { loading: false, totalsByMetricKey: {} } }));
                }
            }));
        }
        // KPIs
        const kpis = widgets.filter((w) => w?.kind === 'kpi');
        setKpiValues((prev) => {
            const next = { ...prev };
            for (const w of kpis)
                next[w.key] = { loading: true };
            return next;
        });
        await Promise.all(kpis.map(async (w) => {
            try {
                // Optional non-metrics value source (e.g., project count from Projects API).
                const valueSource = w?.presentation?.valueSource;
                const metricKey = String(w?.query?.metricKey || '');
                const isProjectCount = metricKey === 'fp.projects.project_count';
                if (valueSource?.kind === 'api_count' || isProjectCount) {
                    const endpoint = typeof valueSource?.endpoint === 'string' ? valueSource.endpoint : '/api/projects';
                    const totalField = typeof valueSource?.totalField === 'string' ? valueSource.totalField : 'pagination.total';
                    const res = await fetch(`${endpoint}?page=1&pageSize=1`);
                    const json = await res.json().catch(() => ({}));
                    const total = Number(getByPath(json, totalField) ?? 0);
                    setKpiValues((p) => ({ ...p, [w.key]: { loading: false, value: Number.isFinite(total) ? total : 0 } }));
                    return;
                }
                // Generic non-metrics value source (extract a single numeric field from an endpoint).
                if (valueSource?.kind === 'api_value') {
                    const endpoint = typeof valueSource?.endpoint === 'string' ? valueSource.endpoint : '';
                    const valueField = typeof valueSource?.valueField === 'string' ? valueSource.valueField : '';
                    if (!endpoint || !valueField) {
                        setKpiValues((p) => ({ ...p, [w.key]: { loading: false, value: 0 } }));
                        return;
                    }
                    const res = await fetch(endpoint);
                    const json = await res.json().catch(() => ({}));
                    const raw = getByPath(json, valueField);
                    const v = Number(raw ?? 0);
                    setKpiValues((p) => ({ ...p, [w.key]: { loading: false, value: Number.isFinite(v) ? v : 0 } }));
                    return;
                }
                // Sum the latest value per entity (useful for totals like wishlist_cumulative_total across projects).
                if (valueSource?.kind === 'metrics_sum_last_per_entity' && typeof valueSource.metricKey === 'string') {
                    const t = effectiveTime(w); // usually null for all_time
                    const body = {
                        metricKey: String(valueSource.metricKey),
                        bucket: 'none',
                        agg: 'last',
                        entityKind: typeof valueSource.entityKind === 'string' ? valueSource.entityKind : (w?.query?.entityKind || undefined),
                        groupByEntityId: true,
                    };
                    if (t)
                        Object.assign(body, t);
                    const res = await fetch('/api/metrics/query', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok)
                        throw new Error(json?.error || `metrics/query ${res.status}`);
                    const rows = Array.isArray(json.data) ? json.data : [];
                    const sum = rows.reduce((acc, r) => acc + Number(r.value ?? 0), 0);
                    setKpiValues((p) => ({ ...p, [w.key]: { loading: false, value: Number.isFinite(sum) ? sum : 0 } }));
                    return;
                }
                // Generic aggregation per entity, then summed across entities.
                // Example: wishlist_net_change sum across all projects (all_time).
                if (valueSource?.kind === 'metrics_sum_agg_per_entity' && typeof valueSource.metricKey === 'string') {
                    const t = effectiveTime(w);
                    const agg = typeof valueSource.agg === 'string' ? valueSource.agg : 'sum';
                    const body = {
                        metricKey: String(valueSource.metricKey),
                        bucket: 'none',
                        agg,
                        entityKind: typeof valueSource.entityKind === 'string' ? valueSource.entityKind : (w?.query?.entityKind || undefined),
                        groupByEntityId: true,
                    };
                    if (t)
                        Object.assign(body, t);
                    const res = await fetch('/api/metrics/query', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok)
                        throw new Error(json?.error || `metrics/query ${res.status}`);
                    const rows = Array.isArray(json.data) ? json.data : [];
                    const sum = rows.reduce((acc, r) => acc + Number(r.value ?? 0), 0);
                    setKpiValues((p) => ({ ...p, [w.key]: { loading: false, value: Number.isFinite(sum) ? sum : 0 } }));
                    return;
                }
                // Sum of latest-per-entity across multiple metric keys (blended totals, e.g. followers across platforms).
                if (valueSource?.kind === 'metrics_sum_last_per_entity_multi' && Array.isArray(valueSource.metricKeys)) {
                    const t = effectiveTime(w); // usually null for all_time
                    const entityKind = typeof valueSource.entityKind === 'string' ? valueSource.entityKind : (w?.query?.entityKind || undefined);
                    const keys = valueSource.metricKeys.map((x) => String(x || '').trim()).filter(Boolean);
                    let sumAll = 0;
                    for (const mk of keys) {
                        const body = { metricKey: mk, bucket: 'none', agg: 'last', entityKind, groupByEntityId: true };
                        if (t)
                            Object.assign(body, t);
                        const res = await fetch('/api/metrics/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                        const json = await res.json().catch(() => ({}));
                        if (!res.ok)
                            throw new Error(json?.error || `metrics/query ${res.status}`);
                        const rows = Array.isArray(json.data) ? json.data : [];
                        sumAll += rows.reduce((acc, r) => acc + Number(r.value ?? 0), 0);
                    }
                    setKpiValues((p) => ({ ...p, [w.key]: { loading: false, value: Number.isFinite(sumAll) ? sumAll : 0 } }));
                    return;
                }
                const t = effectiveTime(w);
                const body = { ...(w.query || {}) };
                if (t)
                    Object.assign(body, t);
                const res = await fetch('/api/metrics/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                const json = await res.json().catch(() => ({}));
                if (!res.ok)
                    throw new Error(json?.error || `metrics/query ${res.status}`);
                const rows = Array.isArray(json.data) ? json.data : [];
                const v = Number(rows[0]?.value ?? 0);
                let prev = undefined;
                if (t && w?.presentation?.compare === 'previous_period') {
                    const start = new Date(t.start);
                    const end = new Date(t.end);
                    const dur = end.getTime() - start.getTime();
                    const prevEnd = new Date(start.getTime() - 1);
                    const prevStart = new Date(prevEnd.getTime() - dur);
                    const prevBody = { ...(w.query || {}), start: prevStart.toISOString(), end: prevEnd.toISOString() };
                    const r2 = await fetch('/api/metrics/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prevBody) });
                    const j2 = await r2.json().catch(() => ({}));
                    const rr = Array.isArray(j2.data) ? j2.data : [];
                    prev = Number(rr[0]?.value ?? 0);
                }
                setKpiValues((p) => ({ ...p, [w.key]: { loading: false, value: Number.isFinite(v) ? v : 0, prev } }));
            }
            catch {
                setKpiValues((p) => ({ ...p, [w.key]: { loading: false, value: 0 } }));
            }
        }));
        // Pie
        const pies = widgets.filter((w) => w?.kind === 'pie');
        setPieRows((prev) => {
            const next = { ...prev };
            for (const w of pies)
                next[w.key] = { loading: true };
            return next;
        });
        await Promise.all(pies.map(async (w) => {
            try {
                const t = effectiveTime(w);
                const body = { ...(w.query || {}) };
                if (t)
                    Object.assign(body, t);
                const res = await fetch('/api/metrics/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                const json = await res.json().catch(() => ({}));
                if (!res.ok)
                    throw new Error(json?.error || `metrics/query ${res.status}`);
                const rows = Array.isArray(json.data) ? json.data : [];
                setPieRows((p) => ({ ...p, [w.key]: { loading: false, rows } }));
            }
            catch {
                setPieRows((p) => ({ ...p, [w.key]: { loading: false, rows: [] } }));
            }
        }));
        // Line (multi series)
        const lines = widgets.filter((w) => w?.kind === 'line');
        setLineSeries((prev) => {
            const next = { ...prev };
            for (const w of lines)
                next[w.key] = { loading: true };
            return next;
        });
        await Promise.all(lines.map(async (w) => {
            try {
                const t = effectiveTime(w);
                if (!t)
                    throw new Error('Line widgets require time range');
                const bucketOverride = lineBucketByWidgetKey[w.key];
                // Explicit series: [{ key, query }]
                if (Array.isArray(w.series) && w.series.length > 0) {
                    const out = [];
                    for (let i = 0; i < w.series.length; i++) {
                        const s = w.series[i];
                        const body = { ...(s.query || {}), start: t.start, end: t.end };
                        const res = await fetch('/api/metrics/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                        const json = await res.json().catch(() => ({}));
                        if (!res.ok)
                            throw new Error(json?.error || `metrics/query ${res.status}`);
                        const rows = Array.isArray(json.data) ? json.data : [];
                        const pts = rows
                            .map((r) => ({ t: r.bucket ? new Date(r.bucket).getTime() : NaN, v: Number(r.value ?? 0) }))
                            .filter((p) => Number.isFinite(p.t))
                            .sort((a, b) => a.t - b.t);
                        out.push({ label: String(s.key || `Series ${i + 1}`), color: palette(i), points: pts });
                    }
                    setLineSeries((p) => ({ ...p, [w.key]: { loading: false, series: out } }));
                    return;
                }
                // Computed top-N entities
                if (w.seriesSpec?.mode === 'top_n_entities') {
                    const spec = w.seriesSpec;
                    const metricKey = String(spec.metricKey || '');
                    const entityKind = String(spec.entityKind || 'project');
                    const bucket = String(bucketOverride || spec.bucket || 'day');
                    const agg = String(spec.agg || 'sum');
                    const topN = Number(spec.topN || 5);
                    const includeOther = spec.includeOther !== false;
                    const otherLabel = String(spec.otherLabel || 'Other');
                    const cumulative = Boolean(spec.cumulative);
                    // totals for ranking
                    const totalsRes = await fetch('/api/metrics/query', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ metricKey, bucket: 'none', agg, entityKind, groupByEntityId: true, start: t.start, end: t.end }),
                    });
                    const totalsJson = await totalsRes.json().catch(() => ({}));
                    const totalsRows = Array.isArray(totalsJson.data) ? totalsJson.data : [];
                    const ranked = totalsRows
                        .map((r) => ({ entityId: String(r.entityId || ''), value: Number(r.value ?? 0) }))
                        .filter((r) => r.entityId)
                        .sort((a, b) => b.value - a.value);
                    const topIds = ranked.slice(0, topN).map((r) => r.entityId);
                    const fetchedNames = spec.labelSource?.source === 'projects' ? await fetchProjectNames(topIds) : {};
                    // series for top ids
                    const seriesRes = await fetch('/api/metrics/query', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ metricKey, bucket, agg, entityKind, groupByEntityId: true, entityIds: topIds, start: t.start, end: t.end }),
                    });
                    const seriesJson = await seriesRes.json().catch(() => ({}));
                    const seriesRows = Array.isArray(seriesJson.data) ? seriesJson.data : [];
                    // total series (for other)
                    const totalRes = await fetch('/api/metrics/query', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ metricKey, bucket, agg, entityKind, start: t.start, end: t.end }),
                    });
                    const totalJson = await totalRes.json().catch(() => ({}));
                    const totalRows = Array.isArray(totalJson.data) ? totalJson.data : [];
                    const buckets = totalRows
                        .map((r) => (r.bucket ? new Date(r.bucket).getTime() : NaN))
                        .filter((x) => Number.isFinite(x))
                        .sort((a, b) => a - b);
                    const totalByT = new Map();
                    for (const r of totalRows) {
                        const tt = r.bucket ? new Date(r.bucket).getTime() : NaN;
                        if (!Number.isFinite(tt))
                            continue;
                        totalByT.set(tt, Number(r.value ?? 0));
                    }
                    const byEntity = new Map();
                    for (const r of seriesRows) {
                        const id = String(r.entityId || '');
                        const tt = r.bucket ? new Date(r.bucket).getTime() : NaN;
                        if (!id || !Number.isFinite(tt))
                            continue;
                        if (!byEntity.has(id))
                            byEntity.set(id, new Map());
                        byEntity.get(id).set(tt, Number(r.value ?? 0));
                    }
                    const out = [];
                    topIds.forEach((id, idx) => {
                        const m = byEntity.get(id) || new Map();
                        const label = spec.labelSource?.source === 'projects' ? (fetchedNames[id] || projectNames[id] || id) : id;
                        out.push({ label, color: palette(idx), points: buckets.map((tt) => ({ t: tt, v: Number(m.get(tt) ?? 0) })) });
                    });
                    if (includeOther) {
                        out.push({
                            label: otherLabel,
                            color: '#94a3b8',
                            points: buckets.map((tt) => {
                                const total = Number(totalByT.get(tt) ?? 0);
                                const sumTop = topIds.reduce((acc, id) => acc + Number(byEntity.get(id)?.get(tt) ?? 0), 0);
                                return { t: tt, v: Math.max(0, total - sumTop) };
                            }),
                        });
                    }
                    if (cumulative) {
                        for (const s of out) {
                            let acc = 0;
                            s.points = s.points.map((p) => {
                                acc += p.v;
                                return { ...p, v: acc };
                            });
                        }
                    }
                    setLineSeries((p) => ({ ...p, [w.key]: { loading: false, series: out } }));
                    return;
                }
                // Computed top-N entities from blended metrics (e.g. followers = sum of last across platforms)
                if (w.seriesSpec?.mode === 'top_n_entities_multi_metrics') {
                    const spec = w.seriesSpec;
                    const entityKind = String(spec.entityKind || 'project');
                    const metricKeys = Array.isArray(spec.metricKeys) ? spec.metricKeys.map((x) => String(x || '').trim()).filter(Boolean) : [];
                    const bucket = String(bucketOverride || spec.bucket || 'day');
                    const agg = String(spec.agg || 'last');
                    const topN = Number(spec.topN || 5);
                    const includeOther = spec.includeOther !== false;
                    const otherLabel = String(spec.otherLabel || 'Other');
                    const cumulative = Boolean(spec.cumulative);
                    // 1) totals by entityId across all metric keys for ranking
                    const totalsByEntity = new Map();
                    for (const mk of metricKeys) {
                        const totalsRes = await fetch('/api/metrics/query', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ metricKey: mk, bucket: 'none', agg, entityKind, groupByEntityId: true, start: t.start, end: t.end }),
                        });
                        const totalsJson = await totalsRes.json().catch(() => ({}));
                        const totalsRows = Array.isArray(totalsJson.data) ? totalsJson.data : [];
                        for (const r of totalsRows) {
                            const id = String(r.entityId || '');
                            if (!id)
                                continue;
                            totalsByEntity.set(id, (totalsByEntity.get(id) || 0) + Number(r.value ?? 0));
                        }
                    }
                    const ranked = Array.from(totalsByEntity.entries())
                        .map(([entityId, value]) => ({ entityId, value }))
                        .sort((a, b) => b.value - a.value);
                    const topIds = ranked.slice(0, topN).map((r) => r.entityId);
                    const fetchedNames = spec.labelSource?.source === 'projects' ? await fetchProjectNames(topIds) : {};
                    // 2) per-bucket series for top IDs: sum across metric keys
                    const byEntity = new Map();
                    const bucketsSet = new Set();
                    for (const mk of metricKeys) {
                        const seriesRes = await fetch('/api/metrics/query', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ metricKey: mk, bucket, agg, entityKind, groupByEntityId: true, entityIds: topIds, start: t.start, end: t.end }),
                        });
                        const seriesJson = await seriesRes.json().catch(() => ({}));
                        const seriesRows = Array.isArray(seriesJson.data) ? seriesJson.data : [];
                        for (const r of seriesRows) {
                            const id = String(r.entityId || '');
                            const tt = r.bucket ? new Date(r.bucket).getTime() : NaN;
                            if (!id || !Number.isFinite(tt))
                                continue;
                            bucketsSet.add(tt);
                            if (!byEntity.has(id))
                                byEntity.set(id, new Map());
                            byEntity.get(id).set(tt, (byEntity.get(id).get(tt) || 0) + Number(r.value ?? 0));
                        }
                    }
                    const buckets = Array.from(bucketsSet.values()).sort((a, b) => a - b);
                    // 3) optional "Other" = all entities minus top, computed via groupByEntityId across all entities
                    let otherSeries = null;
                    if (includeOther) {
                        // compute blended total per bucket across all entities
                        const totalByBucket = new Map();
                        for (const mk of metricKeys) {
                            const res = await fetch('/api/metrics/query', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ metricKey: mk, bucket, agg, entityKind, groupByEntityId: true, start: t.start, end: t.end }),
                            });
                            const json = await res.json().catch(() => ({}));
                            const rows = Array.isArray(json.data) ? json.data : [];
                            for (const r of rows) {
                                const tt = r.bucket ? new Date(r.bucket).getTime() : NaN;
                                if (!Number.isFinite(tt))
                                    continue;
                                totalByBucket.set(tt, (totalByBucket.get(tt) || 0) + Number(r.value ?? 0));
                            }
                        }
                        otherSeries = buckets.map((tt) => {
                            const total = Number(totalByBucket.get(tt) ?? 0);
                            const sumTop = topIds.reduce((acc, id) => acc + Number(byEntity.get(id)?.get(tt) ?? 0), 0);
                            return { t: tt, v: Math.max(0, total - sumTop) };
                        });
                    }
                    const out = [];
                    topIds.forEach((id, idx) => {
                        const m = byEntity.get(id) || new Map();
                        const label = spec.labelSource?.source === 'projects' ? (fetchedNames[id] || projectNames[id] || id) : id;
                        out.push({ label, color: palette(idx), points: buckets.map((tt) => ({ t: tt, v: Number(m.get(tt) ?? 0) })) });
                    });
                    if (includeOther && otherSeries) {
                        out.push({ label: otherLabel, color: '#94a3b8', points: otherSeries });
                    }
                    if (cumulative) {
                        for (const s of out) {
                            let acc = 0;
                            s.points = s.points.map((p) => {
                                acc += p.v;
                                return { ...p, v: acc };
                            });
                        }
                    }
                    setLineSeries((p) => ({ ...p, [w.key]: { loading: false, series: out } }));
                    return;
                }
                throw new Error('Unsupported line widget config');
            }
            catch {
                setLineSeries((p) => ({ ...p, [w.key]: { loading: false, series: [] } }));
            }
        }));
    }, [definition?.key, effectiveTime, range.start, range.end, resolveProjectNames, projectNames, lineBucketByWidgetKey]);
    React.useEffect(() => {
        if (!definition)
            return;
        queryMetrics();
    }, [definition?.key, preset, customStart, customEnd]);
    const openShares = async () => {
        if (!definition)
            return;
        setShareOpen(true);
        setSharesError(null);
        setSharesLoading(true);
        try {
            const res = await fetch(`/api/dashboard-definitions/${encodeURIComponent(definition.key)}/shares`);
            const json = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(json?.error || `Failed (${res.status})`);
            setShares(Array.isArray(json.data) ? json.data : []);
        }
        catch (e) {
            setSharesError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setSharesLoading(false);
        }
    };
    const widgetList = Array.isArray(definition?.definition?.widgets) ? definition.definition.widgets : [];
    return (_jsxs(Page, { title: "Dashboards", children: [_jsx("style", { children: `
        .wrap {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .topbar { display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
        .controls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .subtitle { font-size: 12px; opacity: 0.75; margin-top: -6px; }
        .grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 12px; }
        .span-12 { grid-column: span 12; }
        .span-6 { grid-column: span 6; }
        .span-4 { grid-column: span 4; }
        .span-3 { grid-column: span 3; }
        @media (max-width: 1100px) { .span-6 { grid-column: span 12; } .span-3 { grid-column: span 6; } }
        @media (max-width: 700px) { .span-3 { grid-column: span 12; } .span-4 { grid-column: span 12; } }
        .kpi { padding: 14px; display: flex; flex-direction: column; gap: 8px; }
        .kpi-title { font-size: 12px; opacity: 0.75; }
        .kpi-val { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; }
        .kpi-delta { font-size: 12px; opacity: 0.8; display: flex; gap: 6px; align-items: center; }
        .kpi-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .kpi-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(148,163,184,0.25);
          background: rgba(148,163,184,0.12);
          flex-shrink: 0;
        }
        .kpi-action {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--hit-muted-foreground);
          text-decoration: none;
          margin-top: 4px;
        }
        .kpi-action:hover { color: var(--hit-foreground); text-decoration: underline; }
        .kpi-catalog-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 1100px) { .kpi-catalog-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 700px) { .kpi-catalog-grid { grid-template-columns: repeat(1, minmax(0, 1fr)); } }
        .kpi-mini { padding: 12px; display: flex; flex-direction: column; gap: 8px; border-radius: 12px; }
        .kpi-mini-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .kpi-mini-title { font-size: 12px; opacity: 0.82; line-height: 1.2; }
        .kpi-mini-val { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
        .kpi-mini-badges { display: flex; gap: 6px; flex-wrap: wrap; }
        .donut-wrap { display: grid; grid-template-columns: 260px 1fr; gap: 14px; align-items: center; }
        @media (max-width: 900px) { .donut-wrap { grid-template-columns: 1fr; } }
        .donut { width: 100%; height: 240px; }
        .donut-legend { display: flex; flex-direction: column; gap: 10px; }
        .legend-row { display: grid; grid-template-columns: 10px 1fr auto; gap: 10px; align-items: center; }
        .legend-dot { width: 10px; height: 10px; border-radius: 999px; }
        .legend-label { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .legend-value { font-size: 13px; opacity: 0.85; }
        .chart-svg { width: 100%; height: 240px; }
        .legend { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
        .legend-pill { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 999px; border: 1px solid rgba(148,163,184,0.14); background: rgba(148,163,184,0.08); font-size: 12px; }
      ` }), _jsxs("div", { className: "wrap", children: [_jsxs("div", { className: "topbar", children: [_jsx("div", { style: { minWidth: 260 }, children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }, children: [_jsx("strong", { children: definition?.name || 'Dashboard' }), pack ? _jsxs(Badge, { variant: "info", children: ["pack: ", pack] }) : _jsx(Badge, { variant: "info", children: "global" }), definition?.visibility ? _jsx(Badge, { variant: "default", children: definition.visibility }) : null] }) }), _jsxs("div", { className: "controls", children: [_jsx(Dropdown, { align: "right", trigger: _jsx(Button, { variant: "secondary", children: "Switch" }), items: list.map((d) => ({
                                            label: d.key === selectedKey ? `${d.name} (current)` : d.name,
                                            disabled: d.key === selectedKey,
                                            onClick: () => setSelectedKey(d.key),
                                        })) }), _jsx(Select, { value: preset, onChange: (v) => setPreset(selectValue(v)), options: [
                                            { value: 'last_7_days', label: 'Last 7 days' },
                                            { value: 'last_30_days', label: 'Last 30 days' },
                                            { value: 'last_90_days', label: 'Last 90 days' },
                                            { value: 'month_to_date', label: 'Month to date' },
                                            { value: 'year_to_date', label: 'Year to date' },
                                            { value: 'custom', label: 'Custom' },
                                        ] }), preset === 'custom' ? (_jsxs(_Fragment, { children: [_jsx(Input, { type: "date", value: customStart, onChange: (e) => setCustomStart(e.target.value) }), _jsx(Input, { type: "date", value: customEnd, onChange: (e) => setCustomEnd(e.target.value) })] })) : null, _jsx(Button, { onClick: () => queryMetrics(), disabled: loadingDash, children: "Refresh" }), _jsx(Button, { variant: "secondary", onClick: openShares, disabled: !definition, children: "Share" })] })] }), _jsx("div", { className: "subtitle", children: definition?.description || '—' }), error ? _jsx("div", { style: { color: '#ef4444', fontSize: 13 }, children: error }) : null, _jsxs("div", { className: "grid", children: [loadingDash ? (_jsx("div", { className: "span-12", children: _jsx(Card, { children: _jsx("div", { style: { padding: 18 }, children: _jsx(Spinner, {}) }) }) })) : null, !loadingDash && definition ? (widgetList.map((w) => {
                                const grid = w.grid || {};
                                const span = typeof grid.w === 'number' ? grid.w : (w.kind === 'kpi' ? 3 : w.kind === 'pie' ? 6 : 12);
                                const spanClass = span === 12 ? 'span-12' : span === 6 ? 'span-6' : span === 4 ? 'span-4' : 'span-3';
                                const metricKey = String(w?.query?.metricKey || w?.series?.[0]?.query?.metricKey || w?.seriesSpec?.metricKey || '');
                                const cat = metricKey ? catalogByKey[metricKey] : undefined;
                                const fmt = (w?.presentation?.format === 'usd' || cat?.unit === 'usd') ? 'usd' : 'number';
                                if (w.kind === 'kpi_catalog') {
                                    const st = kpiCatalogTotals[w.key];
                                    const pres = w?.presentation || {};
                                    const entityKind = typeof pres?.entityKind === 'string' ? pres.entityKind : 'project';
                                    const onlyWithPoints = pres?.onlyWithPoints === true;
                                    const items = Object.values(catalogByKey || {});
                                    const filtered = items
                                        .filter((it) => {
                                        const kinds = Array.isArray(it.entity_kinds) ? it.entity_kinds : [];
                                        if (kinds.length && !kinds.includes(entityKind))
                                            return false;
                                        if (onlyWithPoints && Number(it.pointsCount || 0) <= 0)
                                            return false;
                                        return true;
                                    })
                                        .sort((a, b) => String(a.label || a.key).localeCompare(String(b.label || b.key)));
                                    return (_jsx("div", { className: "span-12", children: _jsx(Card, { title: w.title || 'KPIs', children: _jsx("div", { style: { padding: 14 }, children: st?.loading ? (_jsx(Spinner, {})) : (_jsx("div", { className: "kpi-catalog-grid", children: filtered.map((it) => {
                                                        const mk = it.key;
                                                        const val = Number(st?.totalsByMetricKey?.[mk] ?? 0);
                                                        const format = (it.unit === 'usd') ? 'usd' : 'number';
                                                        const iconName = String(it.icon || fallbackIconForMetric(it.category) || '');
                                                        const Icon = resolvePlatformIcon(iconName);
                                                        const iconColor = String(it.icon_color || colors.accent.default);
                                                        return (_jsxs("div", { className: "kpi-mini", style: {
                                                                border: `1px solid ${colors.border.subtle}`,
                                                                background: colors.bg.surface,
                                                            }, children: [_jsxs("div", { className: "kpi-mini-top", children: [_jsxs("div", { style: { minWidth: 0 }, children: [_jsx("div", { className: "kpi-mini-title", title: mk, children: it.label || mk }), _jsx("div", { className: "kpi-mini-val", children: formatNumber(val, format) })] }), Icon ? (_jsx("div", { className: "kpi-icon", style: {
                                                                                width: 34,
                                                                                height: 34,
                                                                                borderRadius: radius.lg,
                                                                                border: `1px solid ${colors.border.subtle}`,
                                                                                background: colors.bg.muted,
                                                                                color: iconColor,
                                                                            }, children: _jsx(Icon, { size: 18, style: { color: iconColor } }) })) : null] }), _jsxs("div", { className: "kpi-mini-badges", children: [it.category ? _jsx(Badge, { children: it.category }) : null, it.unit ? _jsx(Badge, { children: it.unit }) : null, _jsx(Badge, { children: String(it.rollup_strategy || (it.time_kind === 'realtime' ? 'last' : 'sum')) })] })] }, mk));
                                                    }) })) }) }) }, w.key));
                                }
                                if (w.kind === 'kpi') {
                                    const st = kpiValues[w.key];
                                    const val = Number(st?.value ?? 0);
                                    const prev = typeof st?.prev === 'number' ? st.prev : null;
                                    let pct = 0;
                                    if (prev !== null && prev > 0)
                                        pct = ((val - prev) / prev) * 100;
                                    const iconName = String(w?.presentation?.icon || cat?.icon || '');
                                    const Icon = resolvePlatformIcon(iconName);
                                    const iconColor = String(w?.presentation?.iconColor || cat?.icon_color || colors.accent.default);
                                    const action = w?.presentation?.action;
                                    return (_jsx("div", { className: spanClass, children: _jsx(Card, { children: _jsxs("div", { className: "kpi", children: [_jsxs("div", { className: "kpi-head", children: [_jsxs("div", { children: [_jsx("div", { className: "kpi-title", children: w.title || cat?.label || metricKey }), _jsx("div", { className: "kpi-val", children: st?.loading ? '—' : formatNumber(val, fmt) })] }), Icon ? (_jsx("div", { className: "kpi-icon", style: {
                                                                    borderRadius: radius.lg,
                                                                    border: `1px solid ${colors.border.subtle}`,
                                                                    background: colors.bg.muted,
                                                                    color: iconColor,
                                                                }, children: _jsx(Icon, { size: 22, style: { color: iconColor } }) })) : null] }), prev !== null ? (_jsxs("div", { className: "kpi-delta", children: [_jsx("span", { style: { color: pct >= 0 ? '#22c55e' : '#ef4444' }, children: formatNumber(pct, 'percent') }), _jsx("span", { style: { opacity: 0.7 }, children: "vs previous period" })] })) : (_jsx("div", { className: "kpi-delta" })), action?.href && action?.label ? (_jsx("a", { className: "kpi-action", href: String(action.href), children: String(action.label) })) : null] }) }) }, w.key));
                                }
                                if (w.kind === 'pie') {
                                    const st = pieRows[w.key];
                                    const rows = Array.isArray(st?.rows) ? st?.rows : [];
                                    const groupByKey = String(w?.presentation?.groupByKey || 'region');
                                    const topN = Number(w?.presentation?.topN || 5);
                                    const otherLabel = String(w?.presentation?.otherLabel || 'Other');
                                    const normalized = rows
                                        .map((r) => ({ label: String(r[groupByKey] ?? 'Unknown'), value: Number(r.value ?? 0) }))
                                        .sort((a, b) => b.value - a.value);
                                    const top = normalized.slice(0, topN);
                                    const otherSum = normalized.slice(topN).reduce((acc, r) => acc + (Number.isFinite(r.value) ? r.value : 0), 0);
                                    const slices = [
                                        ...top.map((r, idx) => ({ ...r, color: palette(idx) })),
                                        ...(otherSum > 0 ? [{ label: otherLabel, value: otherSum, color: '#94a3b8' }] : []),
                                    ];
                                    return (_jsx("div", { className: spanClass, children: _jsx(Card, { title: w.title || 'Pie', children: _jsx("div", { style: { padding: 14 }, children: st?.loading ? _jsx(Spinner, {}) : _jsx(Donut, { slices: slices, format: fmt }) }) }) }, w.key));
                                }
                                if (w.kind === 'line') {
                                    const st = lineSeries[w.key];
                                    const series = st?.series || [];
                                    const currentBucket = (lineBucketByWidgetKey[w.key] || w?.seriesSpec?.bucket || 'day');
                                    const bucketControl = (_jsx(Select, { value: currentBucket, onChange: (v) => setLineBucketByWidgetKey((p) => ({ ...p, [w.key]: selectValue(v) })), options: [
                                            { value: 'day', label: 'Daily' },
                                            { value: 'week', label: 'Weekly' },
                                            { value: 'month', label: 'Monthly' },
                                        ] }));
                                    return (_jsx("div", { className: spanClass, children: st?.loading ? (_jsx(Card, { title: w.title || 'Line', children: _jsx("div", { style: { padding: 18 }, children: _jsx(Spinner, {}) }) })) : (_jsx(MultiLineChart, { title: w.title || 'Line', format: fmt, series: series, bucket: currentBucket, bucketControl: bucketControl })) }, w.key));
                                }
                                return (_jsx("div", { className: spanClass, children: _jsx(Card, { title: w.title || w.kind, children: _jsxs("div", { style: { padding: 14, opacity: 0.75, fontSize: 12 }, children: ["Unsupported widget kind: ", String(w.kind)] }) }) }, w.key));
                            })) : null] }), _jsx(Modal, { open: shareOpen, onClose: () => setShareOpen(false), title: "Share dashboard", description: definition ? `ACL for ${definition.name}` : '', children: _jsxs("div", { style: { padding: 12 }, children: [sharesError ? _jsx("div", { style: { color: '#ef4444', fontSize: 13, marginBottom: 10 }, children: sharesError }) : null, sharesLoading ? _jsx(Spinner, {}) : (_jsx(AclPicker, { config: {
                                        mode: 'granular',
                                        principals: { users: true, groups: true, roles: true },
                                        granularPermissions: [{ key: 'READ', label: 'Read' }],
                                    }, disabled: !definition, loading: sharesLoading, error: sharesError, entries: shares.map((s) => ({
                                        id: s.id,
                                        principalType: s.principalType,
                                        principalId: s.principalId,
                                        permissions: ['READ'],
                                    })), onAdd: async (entry) => {
                                        if (!definition)
                                            return;
                                        const res = await fetch(`/api/dashboard-definitions/${encodeURIComponent(definition.key)}/shares`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ principalType: entry.principalType, principalId: entry.principalId }),
                                        });
                                        const json = await res.json().catch(() => ({}));
                                        if (!res.ok)
                                            throw new Error(json?.error || `Failed (${res.status})`);
                                        setShares((prev) => [...prev, json.data]);
                                    }, onRemove: async (entry) => {
                                        if (!definition)
                                            return;
                                        const qs = `principalType=${encodeURIComponent(entry.principalType)}&principalId=${encodeURIComponent(entry.principalId)}`;
                                        const res = await fetch(`/api/dashboard-definitions/${encodeURIComponent(definition.key)}/shares?${qs}`, { method: 'DELETE' });
                                        const json = await res.json().catch(() => ({}));
                                        if (!res.ok)
                                            throw new Error(json?.error || `Failed (${res.status})`);
                                        setShares((prev) => prev.filter((s) => !(s.principalType === entry.principalType && s.principalId === entry.principalId)));
                                    }, onUpdate: async () => { } }))] }) })] })] }));
}
export default Dashboards;
