/**
 * Hard-fail dynamic Lucide icon resolver without importing the entire icon set.
 *
 * Problem:
 *   `import * as LucideIcons from 'lucide-react'` pulls ~1,300 icons into the module graph
 *   and explodes Next.js dev compile times.
 *
 * Solution:
 *   Use lucide-react's `dynamicIconImports` (a map of lazy import functions) and render icons
 *   via React.lazy + Suspense. Unknown icon names throw immediately (hard fail).
 */
'use client';

import React from 'react';
import dynamicIconImports from 'lucide-react/dynamicIconImports';

type LucideIconComponent = React.ComponentType<{
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}>;

type DynamicImports = Record<string, () => Promise<{ default: LucideIconComponent }>>;

const imports = dynamicIconImports as unknown as DynamicImports;
const lazyCache = new Map<string, React.LazyExoticComponent<LucideIconComponent>>();

function toKebabCaseFromPascalOrCamel(name: string): string {
  // UsersRound -> users-round
  // ShieldCheck -> shield-check
  // user-groups -> user-groups
  const trimmed = String(name || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('-')) return trimmed.toLowerCase();
  return trimmed
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

function normalizeLucideName(name: string): string {
  const raw = String(name || '').trim();
  if (!raw) return '';

  // Support "lucide:Users" style prefixes
  const val = raw.includes(':') ? raw.split(':', 2)[1] : raw;
  return toKebabCaseFromPascalOrCamel(val);
}

function getLazyIcon(name: string): React.LazyExoticComponent<LucideIconComponent> {
  const key = normalizeLucideName(name);
  if (!key) {
    throw new Error(`[hit-dashboard-shell] Lucide icon name is empty`);
  }

  const importer = imports[key];
  if (!importer) {
    throw new Error(
      `[hit-dashboard-shell] Unknown Lucide icon "${name}" (normalized: "${key}"). ` +
        `Fix the nav config/icon name to a valid Lucide icon.`
    );
  }

  const cached = lazyCache.get(key);
  if (cached) return cached;

  const lazy = React.lazy(async () => {
    const mod = await importer();
    return { default: mod.default };
  });
  lazyCache.set(key, lazy);
  return lazy;
}

export function LucideIcon({
  name,
  size,
  color,
  className,
  style,
}: {
  name: string;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = getLazyIcon(name);

  // Intentionally no fallback: we want unknown icons to hard-fail,
  // and known icons to show as soon as the chunk loads.
  return (
    <React.Suspense fallback={null}>
      <Icon size={size} color={color} className={className} style={style} />
    </React.Suspense>
  );
}

export type { LucideIconComponent };


