'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUi, useHitUiSpecs, filterUiSpecByPlatform, getHitPlatform } from '@hit/ui-kit';
import { LucideIcon } from '../utils/lucide-dynamic';

type MyItem = {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  path?: string;
  kind?: string;
  weight?: number;
  roles?: string[];
  showWhen?: 'authenticated' | 'unauthenticated' | 'always';
  badge?: string | number;
  status?: string;
  disabled?: boolean;
};

function getStoredToken(): string | null {
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'hit_token' && value) return value;
    }
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('hit_token');
  }
  return null;
}

function base64UrlToBase64(s: string): string {
  let out = (s || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = out.length % 4;
  if (pad) out += '='.repeat(4 - pad);
  return out;
}

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const json = atob(base64UrlToBase64(parts[1] || ''));
    const payload = JSON.parse(json);
    if (!payload || typeof payload !== 'object') return null;
    return payload as Record<string, any>;
  } catch {
    return null;
  }
}

function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload) return false;
  const exp = payload.exp;
  if (!exp) return true;
  return Date.now() / 1000 < exp;
}

function getUserRoles(token: string | null): string[] {
  if (!token) return [];
  const payload = decodeJwtPayload(token);
  if (!payload) return [];
  const role = payload.role;
  const roles = Array.isArray(payload.roles) ? payload.roles : [];
  const merged = role && !roles.includes(role) ? [role, ...roles] : roles.length > 0 ? roles : role ? [role] : [];
  return merged.map((r: any) => String(r || '').trim().toLowerCase()).filter(Boolean);
}

function hasAnyRole(required: string[] | undefined, userRoles: string[]) {
  if (!required || required.length === 0) return true;
  const set = new Set(userRoles.map((r) => String(r || '').toLowerCase()));
  return required.some((r) => set.has(String(r || '').toLowerCase()));
}

function getHitConfig(): any {
  try {
    return (globalThis as any).__HIT_CONFIG || {};
  } catch {
    return {};
  }
}

function hasWorkflowsEnabled(): boolean {
  const cfg = getHitConfig();
  return Boolean(cfg?.featurePacks?.workflows || cfg?.featurePacks?.['workflow-core']);
}

function useWorkflowTaskCount(enabled: boolean) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
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
      const items = Array.isArray((json as any)?.items) ? (json as any).items : [];
      setCount(items.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  React.useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [enabled, refresh]);

  return { count, loading, error, refresh };
}

export default function MyStuffPage({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const ui = useUi();
  const { Page, Card, Button, Badge, EmptyState, Alert, Spinner } = ui;
  const specs = useHitUiSpecs();
  const platform = getHitPlatform();
  const router = useRouter();

  const token = getStoredToken();
  const authenticated = isTokenValid(token);
  const roles = useMemo(() => getUserRoles(token), [token]);

  const mySpec = useMemo(() => {
    if (!specs?.my || typeof specs.my !== 'object') return {};
    return filterUiSpecByPlatform(specs.my, platform) as any;
  }, [specs, platform]);

  const items = useMemo(() => {
    const rawItems =
      mySpec && typeof mySpec === 'object' && typeof mySpec.items === 'object' && mySpec.items
        ? (mySpec.items as Record<string, any>)
        : (mySpec as Record<string, any>);
    const out: MyItem[] = [];
    for (const [id, val] of Object.entries(rawItems || {})) {
      if (!val || typeof val !== 'object') continue;
      const item = { ...(val as Record<string, any>), id: String(id) } as MyItem;
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
        if (item.showWhen === 'unauthenticated') return !authenticated;
        if (item.showWhen === 'authenticated') return authenticated;
        if (!hasAnyRole(item.roles, roles)) return false;
        if (item.kind === 'workflowTasks' && !workflowsEnabled) return false;
        return true;
      })
      .sort((a, b) => {
        const aw = typeof a.weight === 'number' ? a.weight : 100;
        const bw = typeof b.weight === 'number' ? b.weight : 100;
        if (aw !== bw) return aw - bw;
        return String(a.label || '').localeCompare(String(b.label || ''));
      });
  }, [items, authenticated, roles, workflowsEnabled]);

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else router.push(path);
  };

  if (!specs) {
    return (
      <Page title="My Hub" description="Quick access to your work." onNavigate={navigate}>
        <Spinner />
      </Page>
    );
  }

  return (
    <Page
      title={mySpec?.title || 'My Hub'}
      description={mySpec?.description || 'Quick access to your work.'}
      onNavigate={navigate}
    >
      {workflowCount.error ? <Alert variant="warning">{workflowCount.error}</Alert> : null}
      {visibleItems.length === 0 ? (
        <EmptyState title="Nothing here yet" description="Your My Hub page will populate as features are enabled." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((item) => {
            const Icon = item.icon ? (props: any) => <LucideIcon name={item.icon as any} {...props} /> : null;
            const pendingBadge =
              item.kind === 'workflowTasks' && workflowCount.count > 0 ? workflowCount.count : item.badge;
            const isDisabled = Boolean(item.disabled || item.status === 'comingSoon' || !item.path);
            return (
              <Card key={item.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {Icon ? <Icon size={18} /> : null}
                    <div>
                      <div className="text-sm font-semibold">{item.label}</div>
                      {item.description ? <div className="text-xs opacity-70">{item.description}</div> : null}
                    </div>
                  </div>
                  {pendingBadge ? <Badge variant="info">{pendingBadge}</Badge> : null}
                  {item.status === 'comingSoon' ? <Badge variant="warning">Coming soon</Badge> : null}
                </div>
                <div>
                  <Button variant="secondary" size="sm" disabled={isDisabled} onClick={() => item.path && navigate(item.path)}>
                    Open
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Page>
  );
}
