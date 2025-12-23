/**
 * Hard-fail dynamic Lucide icon resolver without importing the entire icon set.
 *
 * Problem:
 *   `import * as LucideIcons from 'lucide-react'` pulls ~1,300 icons into the module graph
 *   and explodes Next.js dev compile times.
 *
 * Solution:
 *   Use a small, explicit allowlist map of Lucide icons (hard fail on unknown names).
 *
 * Why not lucide-react/dynamicIconImports?
 *   That file is huge and can increase cold-compile parse time even if icons are lazy.
 */
'use client';

import React from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Building,
  Building2,
  Calendar,
  ChartBar,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CirclePlay,
  ClipboardList,
  Clock,
  Cog,
  FileText,
  Filter,
  FolderKanban,
  Gamepad2,
  History,
  Home,
  Key,
  Layers,
  LayoutDashboard,
  Link2,
  List,
  ListChecks,
  Lock,
  LogIn,
  Mail,
  MapPin,
  Music,
  Package,
  Palette,
  Plug,
  Rocket,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tag,
  TrendingUp,
  Upload,
  User,
  UserPlus,
  Users,
  UsersRound,
  Workflow,
  Wrench,
} from 'lucide-react';

type LucideIconComponent = React.ComponentType<{
  size?: number | string;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}>;

const ICONS: Record<string, LucideIconComponent> = {
  // Common shell/navigation icons
  Activity,
  BarChart3,
  BookOpen,
  Building,
  Building2,
  Calendar,
  ChartBar,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CirclePlay,
  ClipboardList,
  Clock,
  Cog,
  FileText,
  Filter,
  FolderKanban,
  Gamepad2,
  History,
  Home,
  Key,
  Layers,
  LayoutDashboard,
  Link2,
  List,
  ListChecks,
  Lock,
  LogIn,
  Mail,
  MapPin,
  Music,
  Package,
  Palette,
  Plug,
  Rocket,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tag,
  TrendingUp,
  Upload,
  User,
  UserPlus,
  Users,
  UsersRound,
  Workflow,
  Wrench,
};

function toPascalFromKebab(name: string): string {
  return String(name || '')
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

function normalizeKey(name: string): string {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const val = raw.includes(':') ? raw.split(':', 2)[1] : raw;
  if (!val) return '';
  return val.includes('-') || val.includes('_') || val.includes(' ') ? toPascalFromKebab(val) : val;
}

export function LucideIcon({
  name,
  size,
  color,
  className,
  style,
}: {
  name: string;
  size?: number | string;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const key = normalizeKey(name);
  if (!key) {
    throw new Error(`[hit-dashboard-shell] Lucide icon name is empty`);
  }
  const Icon = ICONS[key];
  if (!Icon) {
    throw new Error(
      `[hit-dashboard-shell] Unknown Lucide icon "${name}" (normalized: "${key}"). ` +
        `Add it to the dashboard-shell icon allowlist or fix the nav config/icon name.`
    );
  }
  return <Icon size={size} color={color} className={className} style={style} />;
}

export type { LucideIconComponent };


