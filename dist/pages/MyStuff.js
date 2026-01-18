'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUi, useHitUiSpecs, filterUiSpecByPlatform, getHitPlatform } from '@hit/ui-kit';
import { LucideIcon } from '../utils/lucide-dynamic';
function getStoredToken() {
    if (typeof document !== 'undefined') {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'hit_token' && value)
                return value;
        }
    }
    if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('hit_token');
    }
    return null;
}
function base64UrlToBase64(s) {
    let out = (s || '').replace(/-/g, '+').replace(/_/g, '/');
    const pad = out.length % 4;
    if (pad)
        out += '='.repeat(4 - pad);
    return out;
}
function decodeJwtPayload(token) {
    try {
        const parts = String(token || '').split('.');
        if (parts.length !== 3)
            return null;
        const json = atob(base64UrlToBase64(parts[1] || ''));
        const payload = JSON.parse(json);
        if (!payload || typeof payload !== 'object')
            return null;
        return payload;
    }
    catch {
        return null;
    }
}
function isTokenValid(token) {
    if (!token)
        return false;
    const payload = decodeJwtPayload(token);
    if (!payload)
        return false;
    const exp = payload.exp;
    if (!exp)
        return true;
    return Date.now() / 1000 < exp;
}
function getUserRoles(token) {
    if (!token)
        return [];
    const payload = decodeJwtPayload(token);
    if (!payload)
        return [];
    const role = payload.role;
    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    const merged = role && !roles.includes(role) ? [role, ...roles] : roles.length > 0 ? roles : role ? [role] : [];
    return merged.map((r) => String(r || '').trim().toLowerCase()).filter(Boolean);
}
function hasAnyRole(required, userRoles) {
    if (!required || required.length === 0)
        return true;
    const set = new Set(userRoles.map((r) => String(r || '').toLowerCase()));
    return required.some((r) => set.has(String(r || '').toLowerCase()));
}
function getHitConfig() {
    try {
        return globalThis.__HIT_CONFIG || {};
    }
    catch {
        return {};
    }
}
function hasWorkflowsEnabled() {
    const cfg = getHitConfig();
    return Boolean(cfg?.featurePacks?.workflows || cfg?.featurePacks?.['workflow-core']);
}
function useWorkflowTaskCount(enabled) {
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const refresh = useCallback(async () => {
        if (!enabled)
            return;
        const token = getStoredToken();
        if (!isTokenValid(token)) {
            setCount(0);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/workflows/tasks?limit=200`, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                credentials: 'include',
            });
            if (!res.ok) {
                setCount(0);
                return;
            }
            const json = await res.json().catch(() => ({}));
            const items = Array.isArray(json?.items) ? json.items : [];
            setCount(items.length);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load approvals');
        }
        finally {
            setLoading(false);
        }
    }, [enabled]);
    React.useEffect(() => {
        if (!enabled)
            return;
        refresh();
    }, [enabled, refresh]);
    return { count, loading, error, refresh };
}
export default function MyStuffPage({ onNavigate }) {
    const ui = useUi();
    const { Page, Card, Button, Badge, EmptyState, Alert, Spinner } = ui;
    const specs = useHitUiSpecs();
    const platform = getHitPlatform();
    const router = useRouter();
    const token = getStoredToken();
    const authenticated = isTokenValid(token);
    const roles = useMemo(() => getUserRoles(token), [token]);
    const mySpec = useMemo(() => {
        if (!specs?.my || typeof specs.my !== 'object')
            return {};
        return filterUiSpecByPlatform(specs.my, platform);
    }, [specs, platform]);
    const items = useMemo(() => {
        const rawItems = mySpec && typeof mySpec === 'object' && typeof mySpec.items === 'object' && mySpec.items
            ? mySpec.items
            : mySpec;
        const out = [];
        for (const [id, val] of Object.entries(rawItems || {})) {
            if (!val || typeof val !== 'object')
                continue;
            const item = { ...val, id: String(id) };
            out.push(item);
        }
        return out;
    }, [mySpec]);
    const workflowItems = useMemo(() => items.filter((i) => i.kind === 'workflowTasks'), [items]);
    const workflowsEnabled = hasWorkflowsEnabled();
    const workflowCount = useWorkflowTaskCount(workflowsEnabled && workflowItems.length > 0);
    const visibleItems = useMemo(() => {
        return items
            .filter((item) => {
            if (item.showWhen === 'unauthenticated')
                return !authenticated;
            if (item.showWhen === 'authenticated')
                return authenticated;
            if (!hasAnyRole(item.roles, roles))
                return false;
            if (item.kind === 'workflowTasks' && !workflowsEnabled)
                return false;
            return true;
        })
            .sort((a, b) => {
            const aw = typeof a.weight === 'number' ? a.weight : 100;
            const bw = typeof b.weight === 'number' ? b.weight : 100;
            if (aw !== bw)
                return aw - bw;
            return String(a.label || '').localeCompare(String(b.label || ''));
        });
    }, [items, authenticated, roles, workflowsEnabled]);
    const navigate = (path) => {
        if (onNavigate)
            onNavigate(path);
        else
            router.push(path);
    };
    if (!specs) {
        return (_jsx(Page, { title: "My Hub", description: "Quick access to your work.", onNavigate: navigate, children: _jsx(Spinner, {}) }));
    }
    return (_jsxs(Page, { title: mySpec?.title || 'My Hub', description: mySpec?.description || 'Quick access to your work.', onNavigate: navigate, children: [workflowCount.error ? _jsx(Alert, { variant: "warning", children: workflowCount.error }) : null, visibleItems.length === 0 ? (_jsx(EmptyState, { title: "Nothing here yet", description: "Your My Hub page will populate as features are enabled." })) : (_jsx("div", { className: "grid gap-4 md:grid-cols-2 xl:grid-cols-3", children: visibleItems.map((item) => {
                    const Icon = item.icon ? (props) => _jsx(LucideIcon, { name: item.icon, ...props }) : null;
                    const pendingBadge = item.kind === 'workflowTasks' && workflowCount.count > 0 ? workflowCount.count : item.badge;
                    const isDisabled = Boolean(item.disabled || item.status === 'comingSoon' || !item.path);
                    return (_jsxs(Card, { className: "flex flex-col gap-3", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [Icon ? _jsx(Icon, { size: 18 }) : null, _jsxs("div", { children: [_jsx("div", { className: "text-sm font-semibold", children: item.label }), item.description ? _jsx("div", { className: "text-xs opacity-70", children: item.description }) : null] })] }), pendingBadge ? _jsx(Badge, { variant: "info", children: pendingBadge }) : null, item.status === 'comingSoon' ? _jsx(Badge, { variant: "warning", children: "Coming soon" }) : null] }), _jsx("div", { children: _jsx(Button, { variant: "secondary", size: "sm", disabled: isDisabled, onClick: () => item.path && navigate(item.path), children: "Open" }) })] }, item.id));
                }) }))] }));
}
