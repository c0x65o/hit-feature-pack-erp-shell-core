'use client';

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import {
  Menu,
  Bell,
  User,
  Settings,
  LogOut,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { Monitor, Moon, Sun, X, RotateCw, Camera, Trash2 } from 'lucide-react';
import { ThemeProvider, useThemeTokens, useTheme } from '@hit/ui-kit/theme';
import { styles } from '@hit/ui-kit/components/utils';
import { clearUserAvatarCache } from '@hit/ui-kit/components/UserAvatar';
import type { NavItem, ShellUser, Notification, ShellConfig, ConnectionStatus } from '../types';
import { LucideIcon } from '../utils/lucide-dynamic';
import { ProfilePictureCropModal } from '@hit/feature-pack-auth-core';

// =============================================================================
// CONTEXT
// =============================================================================

interface ShellContextType {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  expandedNodes: Set<string>;
  toggleNode: (id: string) => void;
}

const ShellContext = createContext<ShellContextType | null>(null);

export function useShell() {
  const context = useContext(ShellContext);
  if (!context) throw new Error('useShell must be used within DashboardShell');
  return context;
}

// =============================================================================
// THEME + AUTH HELPERS
// =============================================================================

type ThemePreference = 'light' | 'dark' | 'system';

// Storage keys for persisting user preferences and UI state
const THEME_STORAGE_KEY = 'erp-shell-core-theme';
const THEME_COOKIE_KEY = 'erp-shell-core-theme';
const TOKEN_COOKIE_KEY = 'hit_token';
const ORIGINAL_TOKEN_STORAGE_KEY = 'hit_token_original';
const LAST_IMPERSONATED_EMAIL_KEY = 'hit_last_impersonated_email';

const MENU_OPEN_KEY = 'erp-shell-core-menu-open';
const EXPANDED_NODES_KEY = 'erp-shell-core-expanded-nodes';
const NAV_SCROLL_KEY = 'erp-shell-core-nav-scroll';

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split(';').map((c) => c.trim()).find((cookie) => cookie.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
}

function getStoredToken(): string | null {
  const cookieToken = getCookieValue(TOKEN_COOKIE_KEY);
  if (cookieToken) return cookieToken;
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(TOKEN_COOKIE_KEY);
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

function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_COOKIE_KEY, token);

  // Best-effort cookie max-age from JWT exp (falls back to 1 hour).
  let maxAge = 3600;
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp === 'number') {
    maxAge = Math.max(0, exp - Math.floor(Date.now() / 1000));
  }

  document.cookie = `${TOKEN_COOKIE_KEY}=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function getSavedThemePreference(): ThemePreference | null {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  }
  const cookiePref = getCookieValue(THEME_COOKIE_KEY);
  if (cookiePref === 'light' || cookiePref === 'dark' || cookiePref === 'system') {
    return cookiePref;
  }
  return null;
}

function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }
  return preference;
}

function toInitials(input: string | null | undefined): string {
  const s = String(input || '').trim();
  if (!s) return '?';
  // Split on spaces and common separators, keep first 2 initials.
  const parts = s
    .replace(/[._-]/g, ' ')
    .split(' ')
    .map((x) => x.trim())
    .filter(Boolean);
  const initials = parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return initials || '?';
}

function employeeDisplayName(employee: any): string {
  const preferred = String(employee?.preferredName || employee?.preferred_name || '').trim();
  if (preferred) return preferred;
  const first = String(employee?.firstName || employee?.first_name || '').trim();
  const last = String(employee?.lastName || employee?.last_name || '').trim();
  return [first, last].filter(Boolean).join(' ').trim();
}

function applyThemeToDocument(theme: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

function persistThemePreference(preference: ThemePreference) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  }
  if (typeof document !== 'undefined') {
    document.cookie = `${THEME_COOKIE_KEY}=${preference}; path=/; max-age=31536000; SameSite=Lax`;
  }
}

// =============================================================================
// NAV GROUP HELPERS
// =============================================================================

const groupConfig: Record<string, { label: string; order: number }> = {
  main: { label: 'MAIN', order: 1 },
  system: { label: 'SYSTEM', order: 2 },
};

function groupNavItems(items: NavItem[]): { group: string; label: string; items: NavItem[] }[] {
  const groups: Record<string, NavItem[]> = {};
  const seenIds: Record<string, Set<string>> = {}; // Track seen IDs per group

  items.forEach((item) => {
    const group = item.group || 'main';
    if (!groups[group]) {
      groups[group] = [];
      seenIds[group] = new Set();
    }
    // Deduplicate by id within each group
    if (!seenIds[group].has(item.id)) {
      seenIds[group].add(item.id);
      groups[group].push(item);
    }
  });

  Object.keys(groups).forEach((group) => {
    groups[group].sort((a, b) => (a.weight ?? 500) - (b.weight ?? 500));
  });

  return Object.entries(groups)
    .map(([group, items]) => ({
      group,
      label: groupConfig[group]?.label || group.toUpperCase(),
      items,
    }))
    .sort((a, b) => {
      const orderA = groupConfig[a.group]?.order ?? 999;
      const orderB = groupConfig[b.group]?.order ?? 999;
      return orderA - orderB;
    });
}

// =============================================================================
// NAV FILTERING HELPERS
// =============================================================================

function navPathMatches(activePath: string, itemPath: string): boolean {
  const a = String(activePath || '').trim();
  const b = String(itemPath || '').trim();
  if (!a || !b) return false;

  // Fast path
  if (a === b) return true;

  const split = (p: string) => {
    const [pathname, qs = ''] = p.split('?', 2);
    return { pathname: pathname || '', sp: new URLSearchParams(qs) };
  };

  const ap = split(a);
  const bp = split(b);
  if (ap.pathname !== bp.pathname) return false;

  // If the nav item has no query params, ignore active query params.
  const bpHasParams = Array.from(bp.sp.keys()).length > 0;
  if (!bpHasParams) return true;

  // If nav item has query params, treat them as a required subset.
  for (const [k, v] of bp.sp.entries()) {
    if (ap.sp.get(k) !== v) return false;
  }
  return true;
}

function navHasActiveDescendant(item: NavItem, activePath: string): boolean {
  const children = item.children as unknown as NavItem[] | undefined;
  if (!children || children.length === 0) return false;
  for (const child of children) {
    if (child.path && navPathMatches(activePath, child.path)) return true;
    if (navHasActiveDescendant(child, activePath)) return true;
  }
  return false;
}

function filterNavByRoles(
  items: NavItem[], 
  userRoles?: string[]
): NavItem[] {
  // Feature flags are now filtered at generation time, so we only need to filter by roles
  const roleSet = new Set((userRoles || []).map((r) => String(r || '').toLowerCase()));
  return items
    .filter((item) => {
      // Check role-based access
      if (item.roles && item.roles.length > 0) {
        // If item requires specific roles, user must have at least one
        if (!userRoles || userRoles.length === 0) {
          return false;
        }
        const hasRequiredRole = item.roles.some((role) => roleSet.has(String(role || '').toLowerCase()));
        if (!hasRequiredRole) {
          return false;
        }
      }
      return true;
    })
    .map((item) => {
      if (!item.children) {
        return item;
      }
      const children = filterNavByRoles(item.children as NavItem[], userRoles);
      return {
        ...item,
        children: children.length > 0 ? children : undefined,
      } as NavItem;
    });
}

function flattenNavPaths(items: NavItem[]): string[] {
  const out: string[] = [];
  const walk = (xs: NavItem[]) => {
    for (const x of xs) {
      if (x?.path) out.push(String(x.path));
      const kids = x.children as unknown as NavItem[] | undefined;
      if (kids && kids.length > 0) walk(kids);
    }
  };
  walk(items || []);
  return Array.from(new Set(out.filter(Boolean)));
}

function filterNavByPagePermissions(items: NavItem[], allowedByPath: Record<string, boolean>): NavItem[] {
  const allowed = (p: string | undefined) => (p ? Boolean(allowedByPath[String(p)]) : false);
  const walk = (xs: NavItem[]): NavItem[] => {
    return (xs || [])
      .map((item) => {
        const kids = item.children as unknown as NavItem[] | undefined;
        const nextKids = kids ? walk(kids) : [];

        // Keep item if:
        // - its own path is allowed, OR
        // - it has any allowed children (so parent container stays visible)
        const keep = allowed(item.path) || nextKids.length > 0;
        if (!keep) return null;

        return {
          ...item,
          children: nextKids.length > 0 ? nextKids : undefined,
        } as NavItem;
      })
      .filter(Boolean) as NavItem[];
  };
  return walk(items);
}

async function checkPagePermissionsBatch(pagePaths: string[]): Promise<Record<string, boolean>> {
  const token = getStoredToken();
  if (!token) return Object.fromEntries((pagePaths || []).map((p) => [p, false]));
  if (!pagePaths || pagePaths.length === 0) return {};

  try {
    const res = await fetch(`/api/proxy/auth/permissions/pages/check-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify(pagePaths),
    });
    if (!res.ok) return Object.fromEntries((pagePaths || []).map((p) => [p, false]));
    const json = await res.json().catch(() => ({}));
    // Expect { [path]: boolean }
    if (!json || typeof json !== 'object') {
      return Object.fromEntries((pagePaths || []).map((p) => [p, false]));
    }
    const out: Record<string, boolean> = {};
    for (const p of pagePaths) out[p] = Boolean((json as any)[p]);
    return out;
  } catch {
    return Object.fromEntries((pagePaths || []).map((p) => [p, false]));
  }
}

// =============================================================================
// NAV ITEM COMPONENT
// =============================================================================

interface NavItemComponentProps {
  item: NavItem;
  level?: number;
  activePath: string;
  onNavigate?: (path: string) => void;
}

function NavItemComponent({ item, level = 0, activePath, onNavigate }: NavItemComponentProps) {
  const { expandedNodes, toggleNode } = useShell();
  const { colors, radius, textStyles: ts, spacing } = useThemeTokens();
  
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedNodes.has(item.id);
  const hasActiveDescendant = navHasActiveDescendant(item, activePath);
  const isActive = (item.path ? navPathMatches(activePath, item.path) : false) || (hasChildren && hasActiveDescendant);

  const iconName = item.icon ? String(item.icon) : '';

  const handleClick = () => {
    if (hasChildren) {
      toggleNode(item.id);
    } else if (item.path) {
      if (onNavigate) {
        onNavigate(item.path);
      }
    }
  };

  const hasActiveChild = hasChildren && hasActiveDescendant;

  return (
    <div>
      <button
        onClick={handleClick}
        style={styles({
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          width: level > 0 ? `calc(100% - ${level * 12}px)` : '100%',
          padding: level > 0 ? `${spacing.sm} ${spacing.md} ${spacing.sm} ${spacing['3xl']}` : `${spacing.sm} ${spacing.md}`,
          marginLeft: level > 0 ? `${level * 12}px` : '0',
          marginBottom: spacing.px,
          fontSize: level === 0 ? ts.body.fontSize : ts.bodySmall.fontSize,
          fontWeight: level === 0 ? ts.label.fontWeight : ts.body.fontWeight,
          color: (isActive && !hasChildren) ? colors.text.inverse : hasActiveChild ? colors.text.primary : colors.text.secondary,
          backgroundColor: (isActive && !hasChildren) ? colors.primary.default : 'transparent',
          border: 'none',
          borderRadius: radius.md,
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 150ms ease',
        })}
      >
        {iconName ? <LucideIcon name={iconName} size={18} style={{ flexShrink: 0 }} /> : null}
        <span style={styles({ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>
          {item.label}
        </span>
        {item.badge !== undefined && (
          <span style={styles({
            backgroundColor: colors.error.default,
            color: colors.text.inverse,
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: radius.full,
            minWidth: '20px',
            textAlign: 'center',
          })}>
            {item.badge}
          </span>
        )}
        {hasChildren && (
          <span style={styles({ display: 'flex', marginRight: '-4px' })}>
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        )}
      </button>
      {hasChildren && isExpanded && (
        <div style={styles({ marginTop: spacing.px })}>
          {item.children!.map((child, idx) => (
            <NavItemComponent
              key={`${item.id}-${idx}`}
              item={{ ...child, id: `${item.id}-${idx}` } as NavItem}
              level={level + 1}
              activePath={activePath}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// COLLAPSED RAIL ICON COMPONENT WITH FLYOUT
// =============================================================================

interface CollapsedNavItemProps {
  item: NavItem;
  activePath: string;
  onNavigate?: (path: string) => void;
  isOpen: boolean;
  onOpen: (itemId: string) => void;
  onStartClose: () => void;
  onCancelClose: () => void;
}

function CollapsedNavItem({ item, activePath, onNavigate, isOpen, onOpen, onStartClose, onCancelClose }: CollapsedNavItemProps) {
  const { colors, radius, textStyles: ts, spacing, shadows } = useThemeTokens();
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredChildIdx, setHoveredChildIdx] = useState<number | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const hasChildren = item.children && item.children.length > 0;
  const hasActiveDescendant = navHasActiveDescendant(item, activePath);
  const isActive = (item.path ? navPathMatches(activePath, item.path) : false) || (hasChildren && hasActiveDescendant);
  const hasActiveChild = hasChildren && hasActiveDescendant;

  const iconName = item.icon ? String(item.icon) : '';

  const handleMouseEnter = () => {
    onCancelClose();
    setIsHovered(true);
    onOpen(item.id);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    onStartClose();
  };

  const handleFlyoutMouseEnter = () => {
    onCancelClose();
  };

  const handleFlyoutMouseLeave = () => {
    onStartClose();
  };

  const handleClick = () => {
    if (!hasChildren && item.path) {
      if (onNavigate) {
        onNavigate(item.path);
      }
    }
  };

  const handleChildClick = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    }
  };

  const renderFlyoutItems = (nodes: Omit<NavItem, 'id'>[], depth: number = 0): React.ReactNode => {
    return nodes.map((node, idx) => {
      const child = node as NavItem;
      const childIconName = child.icon ? String(child.icon) : '';
      const childIsActive = (child.path ? navPathMatches(activePath, child.path) : false) || navHasActiveDescendant(child, activePath);
      const childIsHovered = hoveredChildIdx === idx && depth === 0;

      const paddingLeft = depth > 0 ? spacing.lg : spacing.md;
      const paddingRight = spacing.md;

      return (
        <React.Fragment key={`flyout-${item.id}-${depth}-${idx}`}>
          <button
            onClick={() => child.path && handleChildClick(child.path)}
            onMouseEnter={() => (depth === 0 ? setHoveredChildIdx(idx) : undefined)}
            onMouseLeave={() => (depth === 0 ? setHoveredChildIdx(null) : undefined)}
            disabled={!child.path}
            style={styles({
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
              width: '100%',
              padding: `${spacing.sm} ${paddingRight} ${spacing.sm} ${paddingLeft}`,
              border: 'none',
              borderRadius: radius.md,
              cursor: child.path ? 'pointer' : 'default',
              textAlign: 'left',
              transition: 'all 150ms ease',
              backgroundColor: childIsActive ? colors.primary.default : (childIsHovered ? `${colors.primary.default}18` : 'transparent'),
              color: childIsActive ? colors.text.inverse : (childIsHovered ? colors.primary.default : colors.text.secondary),
              fontSize: ts.body.fontSize,
              fontWeight: childIsHovered ? 500 : 400,
              opacity: child.path ? 1 : 0.75,
            })}
          >
            {childIconName ? <LucideIcon name={childIconName} size={16} style={{ flexShrink: 0 }} /> : null}
            <span style={styles({ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>
              {child.label}
            </span>
          </button>

          {child.children && child.children.length > 0 && (
            <div style={styles({ paddingLeft: spacing.md })}>
              {renderFlyoutItems(child.children as unknown as Omit<NavItem, 'id'>[], depth + 1)}
            </div>
          )}
        </React.Fragment>
      );
    });
  };

  // Determine icon button styles - more prominent hover
  const getIconBgColor = () => {
    if ((isActive && !hasChildren) || hasActiveChild) return colors.primary.default;
    if (isHovered || isOpen) return `${colors.primary.default}20`;
    return 'transparent';
  };

  const getIconColor = () => {
    if ((isActive && !hasChildren) || hasActiveChild) return colors.text.inverse;
    if (isHovered || isOpen) return colors.primary.default;
    return colors.text.secondary;
  };

  const getIconBorder = () => {
    if ((isActive && !hasChildren) || hasActiveChild) return 'none';
    if (isHovered || isOpen) return `2px solid ${colors.primary.default}`;
    return '2px solid transparent';
  };

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Icon button in the rail */}
      <button
        ref={buttonRef}
        onClick={handleClick}
        style={styles({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '48px',
          height: '48px',
          margin: `${spacing.xs} auto`,
          border: getIconBorder(),
          borderRadius: radius.md,
          cursor: 'pointer',
          transition: 'all 150ms ease',
          backgroundColor: getIconBgColor(),
          color: getIconColor(),
        })}
      >
        {iconName ? <LucideIcon name={iconName} size={22} /> : <span style={{ fontSize: '14px', fontWeight: 600 }}>{item.label.charAt(0)}</span>}
      </button>

      {/* Flyout menu - uses fixed positioning to escape overflow containers */}
      {isOpen && buttonRef.current && (
        <div
          style={styles({
            position: 'fixed',
            top: `${buttonRef.current.getBoundingClientRect().top}px`,
            left: `${buttonRef.current.getBoundingClientRect().right + 4}px`,
            minWidth: '220px',
            maxWidth: '280px',
            backgroundColor: colors.bg.surface,
            border: `1px solid ${colors.border.default}`,
            borderRadius: radius.md,
            boxShadow: shadows.xl,
            zIndex: 9999,
          })}
          onMouseEnter={handleFlyoutMouseEnter}
          onMouseLeave={handleFlyoutMouseLeave}
        >
          {/* Flyout header */}
          <div
            style={styles({
              padding: `${spacing.md} ${spacing.lg}`,
              borderBottom: `1px solid ${colors.border.subtle}`,
              backgroundColor: colors.bg.muted,
            })}
          >
            <div style={styles({
              fontSize: ts.body.fontSize,
              fontWeight: 600,
              color: colors.text.primary,
            })}>
              {item.label}
            </div>
          </div>

          {/* Flyout items */}
          <div style={styles({ padding: spacing.sm })}>
            {hasChildren ? (
              <div>
                {renderFlyoutItems(item.children as unknown as Omit<NavItem, 'id'>[])}
              </div>
            ) : (
              <button
                onClick={() => handleChildClick(item.path!)}
                onMouseEnter={() => setHoveredChildIdx(0)}
                onMouseLeave={() => setHoveredChildIdx(null)}
                style={styles({
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.sm,
                  width: '100%',
                  padding: `${spacing.sm} ${spacing.md}`,
                  border: 'none',
                  borderRadius: radius.md,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 150ms ease',
                  backgroundColor: hoveredChildIdx === 0 ? `${colors.primary.default}18` : (isActive ? colors.primary.default : 'transparent'),
                  color: hoveredChildIdx === 0 ? colors.primary.default : (isActive ? colors.text.inverse : colors.text.secondary),
                  fontSize: ts.body.fontSize,
                  fontWeight: hoveredChildIdx === 0 ? 500 : 400,
                })}
              >
                {iconName ? <LucideIcon name={iconName} size={16} style={{ flexShrink: 0 }} /> : null}
                <span>Go to {item.label}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// NAV GROUP HEADER COMPONENT
// =============================================================================

function NavGroupHeader({ label }: { label: string }) {
  const { colors, textStyles: ts, spacing } = useThemeTokens();
  
  return (
    <div style={styles({
      padding: `${spacing.lg} ${spacing.md} ${spacing.sm}`,
      fontSize: '11px',
      fontWeight: 600,
      color: colors.text.muted,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
    })}>
      {label}
    </div>
  );
}

// =============================================================================
// SHELL CONTENT (USES THEME)
// =============================================================================

interface ShellContentProps {
  children: React.ReactNode;
  config: ShellConfig;
  navItems: NavItem[];
  user: ShellUser | null;
  activePath: string;
  onNavigate?: (path: string) => void;
  onLogout?: () => void;
  initialNotifications: Notification[];
  connectionStatus?: ConnectionStatus;
  version?: string;
}

function ShellContent({
  children,
  config,
  navItems,
  user,
  activePath,
  onNavigate,
  onLogout,
  initialNotifications,
  connectionStatus = 'connected',
  version,
}: ShellContentProps) {
  const { colors, radius, textStyles: ts, spacing, shadows } = useThemeTokens();
  const { setTheme: setUiKitTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [menuOpen, setMenuOpenState] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => new Set());
  
  // Collapsed rail flyout state - shared across all nav items
  const [openFlyoutId, setOpenFlyoutId] = useState<string | null>(null);
  const flyoutCloseTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Refs for nav scroll position preservation
  const expandedNavRef = React.useRef<HTMLElement | null>(null);
  const collapsedNavRef = React.useRef<HTMLElement | null>(null);

  const handleFlyoutOpen = useCallback((itemId: string) => {
    // Clear any pending close timeout
    if (flyoutCloseTimeoutRef.current) {
      clearTimeout(flyoutCloseTimeoutRef.current);
      flyoutCloseTimeoutRef.current = null;
    }
    // Immediately open the new flyout (closes the previous one)
    setOpenFlyoutId(itemId);
  }, []);

  const handleFlyoutStartClose = useCallback(() => {
    // Start the 500ms delay before closing
    flyoutCloseTimeoutRef.current = setTimeout(() => {
      setOpenFlyoutId(null);
    }, 500);
  }, []);

  const handleFlyoutCancelClose = useCallback(() => {
    // Cancel the pending close
    if (flyoutCloseTimeoutRef.current) {
      clearTimeout(flyoutCloseTimeoutRef.current);
      flyoutCloseTimeoutRef.current = null;
    }
  }, []);

  // Cleanup flyout timeout on unmount
  React.useEffect(() => {
    return () => {
      if (flyoutCloseTimeoutRef.current) {
        clearTimeout(flyoutCloseTimeoutRef.current);
      }
    };
  }, []);

  // Read config synchronously from window global (set by HitAppProvider)
  // Config is STATIC - generated at build time from hit.yaml
  const [hitConfig] = useState<any | null>(() => {
    if (typeof window === 'undefined') return null;
    const win = window as unknown as { __HIT_CONFIG?: any };
    return win.__HIT_CONFIG || null;
  });
  const [currentUser, setCurrentUser] = useState<ShellUser | null>(user);
  const [authToken, setAuthTokenState] = useState<string | null>(null);
  const [endingImpersonation, setEndingImpersonation] = useState(false);
  const [impersonationError, setImpersonationError] = useState<string | null>(null);
  const [startingImpersonation, setStartingImpersonation] = useState(false);
  const [lastImpersonatedEmail, setLastImpersonatedEmail] = useState<string | null>(null);
  // Initialize theme from DOM (set by blocking script) to prevent flash
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    // Read from localStorage/cookie on client
    if (typeof window !== 'undefined') {
      const saved = getSavedThemePreference();
      if (saved) return saved;
    }
    return 'system';
  });
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    // Read from DOM (already set by blocking script in layout.tsx)
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }
    return 'dark';
  });
  const [themeLoaded, setThemeLoaded] = useState(() => {
    // If we're on client, we already loaded theme from DOM
    return typeof document !== 'undefined';
  });
  const [profileForm, setProfileForm] = useState({
    password: '',
    confirmPassword: '',
  });
  const [profileMetadata, setProfileMetadata] = useState<Record<string, any>>({});
  const [profileFields, setProfileFields] = useState<Record<string, any>>({});
  const [profileFieldMetadata, setProfileFieldMetadata] = useState<Array<{
    field_key: string;
    field_label: string;
    field_type: string;
    required: boolean;
    user_can_edit: boolean;
    display_order: number;
  }>>([]);
  const [profileStatus, setProfileStatus] = useState<{ saving: boolean; error: string | null; success: string | null }>({
    saving: false,
    error: null,
    success: null,
  });
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [hrmEnabled, setHrmEnabled] = useState<boolean>(() => Boolean((hitConfig as any)?.featurePacks?.hrm));
  const [hrmEmployee, setHrmEmployee] = useState<any | null>(null);
  const [hrmForm, setHrmForm] = useState<{ firstName: string; lastName: string; preferredName: string }>({
    firstName: '',
    lastName: '',
    preferredName: '',
  });
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Keep a lightweight view of the auth token for impersonation UX (token swaps happen without remounting the shell).
  useEffect(() => {
    const refresh = () => {
      setAuthTokenState(getStoredToken());
      if (typeof window !== 'undefined') {
        const v = window.localStorage.getItem(LAST_IMPERSONATED_EMAIL_KEY);
        setLastImpersonatedEmail(v && v.trim() ? v.trim() : null);
      }
    };
    refresh();
    const t = window.setInterval(refresh, 1000);
    return () => window.clearInterval(t);
  }, []);

  const impersonation = React.useMemo(() => {
    const payload = authToken ? decodeJwtPayload(authToken) : null;
    const fromClaims = Boolean(payload?.impersonated);
    const byRaw = payload?.impersonated_by;
    const by = typeof byRaw === 'string' && byRaw.trim() ? byRaw.trim() : undefined;
    return {
      active: fromClaims,
      by: fromClaims ? by : undefined,
    };
  }, [authToken]);

  const endImpersonation = useCallback(async ({ clearLast }: { clearLast: boolean }) => {
    if (endingImpersonation) return;
    const token = getStoredToken();
    if (!token) return;

    setImpersonationError(null);
    setEndingImpersonation(true);
    try {
      const res = await fetch('/api/proxy/auth/impersonate/end', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || 'Failed to end impersonation');
      }
      const json = await res.json();
      const nextToken = (json as any)?.token;
      if (!nextToken) {
        throw new Error('Impersonation end did not return a token');
      }
      if (typeof window !== 'undefined') {
        localStorage.removeItem(ORIGINAL_TOKEN_STORAGE_KEY);
        if (clearLast) localStorage.removeItem(LAST_IMPERSONATED_EMAIL_KEY);
      }
      setAuthToken(nextToken);
      window.location.reload();
    } catch (err) {
      setImpersonationError(err instanceof Error ? err.message : 'Failed to end impersonation');
    } finally {
      setEndingImpersonation(false);
    }
  }, [endingImpersonation]);

  const resumeLastImpersonation = useCallback(async () => {
    if (startingImpersonation) return;
    const token = getStoredToken();
    if (!token) return;
    if (typeof window === 'undefined') return;

    const lastEmail = localStorage.getItem(LAST_IMPERSONATED_EMAIL_KEY) || '';
    if (!lastEmail.trim()) return;

    setImpersonationError(null);
    setStartingImpersonation(true);
    try {
      // Stash admin token so we can toggle back.
      localStorage.setItem(ORIGINAL_TOKEN_STORAGE_KEY, token);

      const res = await fetch('/api/proxy/auth/impersonate/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_email: lastEmail }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || 'Failed to start impersonation');
      }
      const json = await res.json();
      const nextToken = (json as any)?.token;
      if (!nextToken) throw new Error('Impersonation did not return a token');
      setAuthToken(nextToken);
      window.location.reload();
    } catch (err) {
      setImpersonationError(err instanceof Error ? err.message : 'Failed to start impersonation');
    } finally {
      setStartingImpersonation(false);
    }
  }, [startingImpersonation]);

  const setMenuOpen = useCallback((open: boolean) => {
    setMenuOpenState(open);
    if (typeof window !== 'undefined') {
      localStorage.setItem(MENU_OPEN_KEY, String(open));
    }
  }, []);

  const applyThemePreference = useCallback((preference: ThemePreference) => {
    const resolved = resolveTheme(preference);
    setThemePreference(preference);
    setResolvedTheme(resolved);
    applyThemeToDocument(resolved);
    persistThemePreference(preference);
    // Sync with @hit/ui-kit ThemeProvider so useThemeTokens() returns correct colors
    setUiKitTheme(resolved);
  }, [setUiKitTheme]);

  const loadInitialTheme = useCallback(() => {
    const saved = getSavedThemePreference();
    const shellTopLevel = (hitConfig as any)?.erpShellCore ?? {};
    const shellPackOptions =
      (hitConfig as any)?.featurePacks?.['erp-shell-core'] ??
      (hitConfig as any)?.featurePacks?.erpShellCore ??
      {};
    const defaultPref =
      (shellTopLevel?.defaultTheme as ThemePreference | undefined) ||
      (shellPackOptions?.default_theme as ThemePreference | undefined) ||
      (shellPackOptions?.defaultTheme as ThemePreference | undefined) ||
      config.defaultTheme ||
      'dark';
    const preference = (saved || defaultPref || 'dark') as ThemePreference;
    applyThemePreference(preference);
    setThemeLoaded(true);
  }, [applyThemePreference, hitConfig, config.defaultTheme]);

  useEffect(() => {
    if (!themeLoaded) {
      loadInitialTheme();
    }
  }, [themeLoaded, loadInitialTheme]);

  useEffect(() => {
    if (themePreference !== 'system') return;
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyThemePreference('system');
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [themePreference, applyThemePreference]);

  useEffect(() => {
    // Map profile_picture_url to avatar if present (user prop might have either field)
    const mappedUser = user ? {
      ...user,
      avatar: (user as any).profile_picture_url || user.avatar || undefined,
    } : null;
    setCurrentUser(mappedUser);
    // Identity: email is the stable identifier; display name may be enriched via HRM (employees) when installed.
    setProfileLoaded(false);
    setProfileMetadata({});
    setProfileStatus((prev) => ({ ...prev, error: null, success: null }));
  }, [user]);

  // HRM pack can enrich identity (employee display name). Keep it optional and fail-soft.
  useEffect(() => {
    const enabled = Boolean((hitConfig as any)?.featurePacks?.hrm);
    setHrmEnabled(enabled);
  }, [hitConfig]);

  useEffect(() => {
    if (!hrmEnabled) return;
    if (!currentUser?.email) return;
    let cancelled = false;
    const fetchEmployee = async () => {
      try {
        const token = getStoredToken();
        if (!token) return;
        const res = await fetch('/api/hrm/employees/me', {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        if (cancelled) return;
        if (res.status === 404) {
          setHrmEnabled(false);
          return;
        }
        if (!res.ok) return;
        const json = await res.json().catch(() => ({}));
        const employee = (json as any)?.employee || null;
        setHrmEmployee(employee);
        setHrmForm({
          firstName: String(employee?.firstName || employee?.first_name || '').trim(),
          lastName: String(employee?.lastName || employee?.last_name || '').trim(),
          preferredName: String(employee?.preferredName || employee?.preferred_name || '').trim(),
        });
      } catch {
        // Ignore (optional feature)
      }
    };
    fetchEmployee();
    return () => {
      cancelled = true;
    };
  }, [hrmEnabled, currentUser?.email]);

  const userDisplayName = React.useMemo(() => {
    const fromHrm = hrmEmployee ? employeeDisplayName(hrmEmployee) : '';
    if (fromHrm) return fromHrm;
    const pfFirst = String((profileFields as any)?.first_name || '').trim();
    const pfLast = String((profileFields as any)?.last_name || '').trim();
    const fromProfileFields = [pfFirst, pfLast].filter(Boolean).join(' ').trim();
    if (fromProfileFields) return fromProfileFields;
    const fromJwt = String((currentUser as any)?.name || '').trim();
    if (fromJwt) return fromJwt;
    return String(currentUser?.email || 'User');
  }, [hrmEmployee, profileFields, currentUser?.name, currentUser?.email]);

  // Fetch profile picture on initial load if missing
  useEffect(() => {
    if (!currentUser?.email || currentUser?.avatar) {
      return; // Skip if no user or avatar already exists
    }

    const email = currentUser.email;
    let cancelled = false;

    const fetchProfilePicture = async () => {
      try {
        const token = getStoredToken();
        if (!token || cancelled) return;

        const response = await fetch(`/api/proxy/auth/users/${encodeURIComponent(email)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (cancelled) return;

        if (response.ok) {
          const userData = await response.json();
          const profilePictureUrl = userData.profile_picture_url;
          if (profilePictureUrl && !cancelled) {
            setCurrentUser((prev) => {
              if (!prev || prev.email !== email || prev.avatar) return prev;
              return {
                ...prev,
                avatar: profilePictureUrl,
              };
            });
          }
        }
      } catch (err) {
        // Silently fail - avatar is optional
      }
    };

    fetchProfilePicture();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.email]); // Only run when email changes

  // Listen for user profile updates (e.g., after picture upload)
  useEffect(() => {
    const handleUserProfileUpdate = async (event: CustomEvent) => {
      const detail = event.detail as { profile_picture_url?: string | null; email?: string };
      const updatedEmail = detail?.email;
      
      // Clear the UserAvatar cache so other components pick up the new picture
      if (updatedEmail) {
        clearUserAvatarCache(updatedEmail);
      }
      
      // Only update if it's for the current user
      if (!currentUser || (updatedEmail && updatedEmail !== currentUser.email)) {
        return;
      }

      // Fetch updated user data from auth API
      try {
        const token = getStoredToken();
        if (!token) return;

        const response = await fetch(`/api/proxy/auth/users/${encodeURIComponent(currentUser.email || '')}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (response.ok) {
          const userData = await response.json();
          // Map profile_picture_url to avatar
          setCurrentUser({
            ...currentUser,
            avatar: userData.profile_picture_url || undefined,
          });
        }
      } catch (err) {
        // If fetch fails, fall back to using the event data
        const updatedProfilePictureUrl = detail?.profile_picture_url;
        if (updatedProfilePictureUrl !== undefined) {
          setCurrentUser({
            ...currentUser,
            avatar: updatedProfilePictureUrl || undefined,
          });
        }
      }
    };

    const eventListener = (event: Event) => {
      handleUserProfileUpdate(event as CustomEvent);
    };

    window.addEventListener('user-profile-updated', eventListener);
    return () => {
      window.removeEventListener('user-profile-updated', eventListener);
    };
  }, [currentUser]);

  const enrichNotificationsWithReadState = useCallback((items: Notification[]) => {
    return items.map((n) => ({
      ...n,
      read: readNotificationIds.has(String(n.id)),
    }));
  }, [readNotificationIds]);

  const fetchReadIds = useCallback(async (ids: string[]): Promise<string[]> => {
    const token = getStoredToken();
    if (!token) return [] as string[];
    if (ids.length === 0) return [] as string[];

    const qp = ids.map((x) => encodeURIComponent(x)).join(',');
    const res = await fetch(`/api/notification-reads?ids=${qp}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [] as string[];
    const json = await res.json().catch(() => ({}));
    const readIds = Array.isArray((json as any)?.readIds) ? (json as any).readIds : [];
    return readIds.map((x: any) => String(x));
  }, []);

  const upsertReadIds = useCallback(async (ids: string[]): Promise<void> => {
    const token = getStoredToken();
    if (!token) return;
    if (ids.length === 0) return;
    await fetch(`/api/notification-reads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids }),
    }).catch(() => {});
  }, []);

  const mapWorkflowTaskToNotification = useCallback((t: any): Notification => {
    const taskId = String(t?.id ?? '');
    const runId = String(t?.runId ?? t?.run_id ?? '');
    const statusRaw = String(t?.status ?? 'open');
    const status: 'open' | 'resolved' = statusRaw === 'open' ? 'open' : 'resolved';

    const prompt = t?.prompt && typeof t.prompt === 'object' ? t.prompt : {};
    const title =
      typeof prompt?.title === 'string'
        ? prompt.title
        : t?.type === 'approval'
          ? 'Approval required'
          : 'Workflow task';
    const message =
      typeof prompt?.message === 'string'
        ? prompt.message
        : typeof prompt?.text === 'string'
          ? prompt.text
          : `A workflow is waiting for human action.`;

    const decidedBy = t?.decidedByUserId || t?.decided_by_user_id || null;
    const decision = t?.decision && typeof t.decision === 'object' ? t.decision : {};
    const decisionSummary = typeof decision?.action === 'string' ? decision.action : null;

    const base: Notification = {
      id: `workflows:task:${taskId}`,
      type: 'system',
      title,
      message,
      timestamp: t?.createdAt || t?.created_at || new Date().toISOString(),
      read: false,
      priority: 'high',
      status,
      resolved:
        status === 'resolved'
          ? {
              at: t?.decidedAt || t?.decided_at || undefined,
              by: decidedBy ? String(decidedBy) : undefined,
              summary: decisionSummary ? String(decisionSummary) : undefined,
            }
          : undefined,
      meta: {
        pack: 'workflows',
        taskId,
        runId,
        workflowId: t?.workflowId || t?.workflow_id,
        rawStatus: statusRaw,
      },
    };

    if (status === 'open' && taskId && runId) {
      base.actions = [
        {
          id: 'approve',
          label: 'Approve',
          variant: 'primary',
          kind: 'api',
          method: 'POST',
          path: `/api/workflows/runs/${encodeURIComponent(runId)}/tasks/${encodeURIComponent(taskId)}/approve`,
          confirm: {
            title: 'Approve request?',
            message: 'This will approve the workflow task.',
            confirmText: 'Approve',
            cancelText: 'Cancel',
          },
        },
        {
          id: 'deny',
          label: 'Deny',
          variant: 'danger',
          kind: 'api',
          method: 'POST',
          path: `/api/workflows/runs/${encodeURIComponent(runId)}/tasks/${encodeURIComponent(taskId)}/deny`,
          confirm: {
            title: 'Deny request?',
            message: 'This will deny the workflow task.',
            confirmText: 'Deny',
            cancelText: 'Cancel',
          },
        },
      ];
    }

    return base;
  }, []);

  const fetchWorkflowTaskNotifications = useCallback(async (): Promise<Notification[]> => {
    // Only attempt if the workflows feature pack is installed (or if the endpoint exists).
    const hasWorkflows = Boolean(hitConfig?.featurePacks?.workflows);
    if (!hasWorkflows) return [];

    const token = getStoredToken();
    if (!token) return [];

    const res = await fetch(`/api/workflows/tasks?limit=50&includeResolved=true&resolvedWithinHours=24`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      // If workflows is installed but endpoint isn't available yet, don't spam errors.
      return [];
    }
    const json = await res.json().catch(() => ({}));
    const items = Array.isArray((json as any)?.items) ? (json as any).items : [];
    const mapped: Notification[] = items.map((t: any) => mapWorkflowTaskToNotification(t));

    return mapped;
  }, [hitConfig?.featurePacks?.workflows, mapWorkflowTaskToNotification]);

  const fetchConfiguredProviderNotifications = useCallback(async (): Promise<Notification[]> => {
    const token = getStoredToken();
    if (!token) return [];

    // Allow apps to plug additional providers into the shell feed without modifying shell code.
    // Expected shape:
    //   hitConfig.erpShellCore.notificationProviders = [{ id: 'crm', path: '/api/crm/notifications' }, ...]
    const rawProviders =
      (hitConfig as any)?.erpShellCore?.notificationProviders ||
      (hitConfig as any)?.erpShellCore?.notification_providers ||
      (hitConfig as any)?.featurePacks?.['erp-shell-core']?.notificationProviders ||
      (hitConfig as any)?.featurePacks?.['erp-shell-core']?.notification_providers ||
      (hitConfig as any)?.featurePacks?.erpShellCore?.notificationProviders ||
      [];

    const providers: Array<{ id: string; path: string }> = Array.isArray(rawProviders)
      ? rawProviders
          .map((p: any) => ({
            id: typeof p?.id === 'string' ? p.id.trim() : '',
            path: typeof p?.path === 'string' ? p.path.trim() : '',
          }))
          .filter((p: any) => p.id && p.path)
      : [];

    if (providers.length === 0) return [];

    const results = await Promise.all(
      providers.map(async (p) => {
        try {
          const res = await fetch(p.path, { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) return [] as Notification[];
          const json = await res.json().catch(() => null);
          const items = Array.isArray((json as any)?.items)
            ? (json as any).items
            : Array.isArray(json)
              ? json
              : [];
          return items
            .filter(Boolean)
            .map((n: any): Notification => {
              const id = n?.id !== undefined && n?.id !== null ? n.id : Math.random().toString(36).slice(2);
              return {
                id: `${p.id}:${String(id)}`,
                type: typeof n?.type === 'string' ? n.type : p.id,
                title: typeof n?.title === 'string' ? n.title : 'Notification',
                message: typeof n?.message === 'string' ? n.message : '',
                timestamp: n?.timestamp || new Date().toISOString(),
                read: Boolean(n?.read),
                priority: n?.priority,
                status: n?.status,
                resolved: n?.resolved,
                actions: n?.actions,
                meta: { ...(n?.meta || {}), providerId: p.id },
              };
            });
        } catch {
          return [] as Notification[];
        }
      })
    );

    return results.flat();
  }, [hitConfig]);

  const refreshNotifications = useCallback(async (opts?: { markRead?: boolean }) => {
    if (!config.showNotifications) return [] as Notification[];
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const workflowsItems = await fetchWorkflowTaskNotifications();
      const providerItems = await fetchConfiguredProviderNotifications();
      const merged = [...workflowsItems, ...providerItems, ...initialNotifications];
      const ids = merged.map((n) => String(n.id));
      const readIds = await fetchReadIds(ids);
      const readSet = new Set<string>(readIds);
      setReadNotificationIds(readSet);
      const enriched = merged.map((n) => ({ ...n, read: readSet.has(String(n.id)) }));
      if (opts?.markRead) {
        const markIds = enriched.map((n) => String(n.id));
        await upsertReadIds(markIds);
        const nextSet = new Set<string>(readSet);
        for (const id of markIds) nextSet.add(id);
        setReadNotificationIds(nextSet);
        setNotifications(enriched.map((n) => ({ ...n, read: true })));
      } else {
        setNotifications(enriched);
      }
      return enriched;
    } catch (e) {
      setNotificationsError(e instanceof Error ? e.message : 'Failed to load notifications');
      return [] as Notification[];
    } finally {
      setNotificationsLoading(false);
    }
  }, [
    config.showNotifications,
    fetchReadIds,
    fetchConfiguredProviderNotifications,
    fetchWorkflowTaskNotifications,
    initialNotifications,
    upsertReadIds,
  ]);

  function safeKey(id: string): string {
    return encodeURIComponent(String(id || '').trim()).replace(/%/g, '_');
  }

  // Real-time: subscribe to events gateway and update workflow notifications instantly.
  useEffect(() => {
    if (!mounted) return;
    let unsubscribers: Array<() => void> = [];
    let cancelled = false;

    const hasWorkflows = Boolean(hitConfig?.featurePacks?.workflows);
    const patternsFromConfig =
      (hitConfig as any)?.erpShellCore?.notificationRealtimePatterns ||
      (hitConfig as any)?.erpShellCore?.notification_realtime_patterns ||
      (hitConfig as any)?.featurePacks?.['erp-shell-core']?.notificationRealtimePatterns ||
      (hitConfig as any)?.featurePacks?.['erp-shell-core']?.notification_realtime_patterns ||
      (hitConfig as any)?.featurePacks?.erpShellCore?.notificationRealtimePatterns ||
      [];
    const rolePatterns =
      hasWorkflows && Array.isArray(currentUser?.roles)
        ? currentUser!.roles!.map((r) => `workflows.inbox.role.${safeKey(String(r || '').toLowerCase())}.*`)
        : [];
    const userPatterns =
      hasWorkflows && (currentUser?.id || currentUser?.email)
        ? [
            ...(currentUser?.id ? [`workflows.inbox.user.${safeKey(String(currentUser.id))}.*`] : []),
            ...(currentUser?.email ? [`workflows.inbox.user.${safeKey(String(currentUser.email))}.*`] : []),
          ]
        : [];

    const patterns: string[] = [
      ...(hasWorkflows ? [...rolePatterns, ...userPatterns] : []),
      ...(Array.isArray(patternsFromConfig) ? patternsFromConfig.map((p: any) => String(p || '').trim()).filter(Boolean) : []),
    ];

    // Dedup
    const uniqPatterns = Array.from(new Set(patterns));
    if (uniqPatterns.length === 0) return;

    (async () => {
      try {
        const sdk = await import('@hit/sdk');
        const eventsClient = (sdk as any)?.events;
        if (!eventsClient?.subscribe) return;

        unsubscribers = uniqPatterns.map((pattern) => {
          const sub = eventsClient.subscribe(pattern, (evt: any) => {
            if (cancelled) return;
            // For workflow inbox pushes, the payload is { task: {...} }.
            const eventType = evt?.event_type || evt?.eventType || '';
            if (typeof eventType === 'string' && eventType.startsWith('workflows.inbox.')) {
              const task = evt?.payload?.task || evt?.payload || null;
              if (task && typeof task === 'object') {
                // Reuse the same mapping as the pull-based path.
                try {
                  const n = mapWorkflowTaskToNotification(task);

                  setNotifications((prev) => {
                    const next = [n, ...prev.filter((x) => String(x.id) !== String(n.id))];
                    // Enrich with read state
                    return next.map((x) => ({ ...x, read: readNotificationIds.has(String(x.id)) }));
                  });
                } catch {
                  refreshNotifications().catch(() => {});
                }
                return;
              }
            }
            // Non-workflow realtime patterns continue to use refresh fallback.
            refreshNotifications().catch(() => {});
          });
          return () => sub?.unsubscribe?.();
        });
      } catch {
        // SDK not available or realtime not configured; ignore.
      }
    })();

    return () => {
      cancelled = true;
      for (const u of unsubscribers) {
        try { u(); } catch {}
      }
      unsubscribers = [];
    };
  }, [hitConfig, mounted, refreshNotifications, currentUser?.roles, currentUser?.id, currentUser?.email, readNotificationIds, mapWorkflowTaskToNotification]);

  // Fetch whenever the dropdown opens (and once on mount).
  useEffect(() => {
    if (!mounted) return;
    refreshNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const runNotificationAction = useCallback(async (action: any) => {
    if (!action || action.kind !== 'api') return;
    const token = getStoredToken();
    if (!token) {
      setNotificationsError('You must be signed in to take this action.');
      return;
    }

    const needsConfirm = action.confirm && typeof action.confirm === 'object';
    if (needsConfirm) {
      const ok = window.confirm(`${action.confirm.title}\n\n${action.confirm.message}`);
      if (!ok) return;
    }

    try {
      const res = await fetch(action.path, {
        method: action.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: action.body ? JSON.stringify(action.body) : JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (json as any)?.error || (json as any)?.detail || `Action failed (${res.status})`;
        setNotificationsError(String(msg));
      } else {
        setNotificationsError(null);
      }
    } catch (e) {
      setNotificationsError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      await refreshNotifications();
    }
  }, [refreshNotifications]);

  // Note: hitConfig is now read synchronously from window.__HIT_CONFIG
  // No fetch needed - config is static and injected by HitAppProvider

  // Load persisted state from localStorage on mount
  useEffect(() => {
    if (!themeLoaded) {
      loadInitialTheme();
    }
    setMounted(true);
    if (typeof window !== 'undefined') {
      // Restore menu open state
      const savedMenuOpen = localStorage.getItem(MENU_OPEN_KEY);
      if (savedMenuOpen !== null) {
        setMenuOpenState(savedMenuOpen !== 'false');
      }
      // Restore expanded nodes (but start collapsed by default - only restore if user explicitly expanded something)
      const savedNodes = localStorage.getItem(EXPANDED_NODES_KEY);
      if (savedNodes) {
        try {
          const parsed = JSON.parse(savedNodes);
          // Only restore if there are actually expanded nodes (user explicitly expanded something)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setExpandedNodes(new Set(parsed));
          }
          // Otherwise, keep it collapsed (empty Set)
        } catch {
          // Invalid JSON, ignore - start collapsed
        }
      }
      // Note: Nav starts collapsed by default (empty Set) - nodes only expand when user clicks
    }
  }, [themeLoaded, loadInitialTheme]);

  // Restore nav scroll position on mount and save on scroll
  useEffect(() => {
    const restoreScroll = () => {
      if (typeof window === 'undefined') return;
      const savedScroll = sessionStorage.getItem(NAV_SCROLL_KEY);
      if (savedScroll) {
        const scrollTop = parseInt(savedScroll, 10);
        // Try both nav refs (expanded or collapsed)
        if (expandedNavRef.current) {
          expandedNavRef.current.scrollTop = scrollTop;
        }
        if (collapsedNavRef.current) {
          collapsedNavRef.current.scrollTop = scrollTop;
        }
      }
    };
    
    // Restore after a short delay to ensure DOM is ready
    const timeoutId = setTimeout(restoreScroll, 50);
    return () => clearTimeout(timeoutId);
  }, []);

  // Save nav scroll position on scroll
  const handleNavScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(NAV_SCROLL_KEY, String(e.currentTarget.scrollTop));
    }
  }, []);

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(EXPANDED_NODES_KEY, JSON.stringify([...next]));
      }
      return next;
    });
  }, []);

  const openAppearance = useCallback(() => {
    setShowAppearanceModal(true);
    setShowProfileModal(false);
    setShowProfileMenu(false);
    setShowNotifications(false);
  }, []);

  const closeAppearance = useCallback(() => {
    setShowAppearanceModal(false);
  }, []);

  const openProfileModal = useCallback(() => {
    setShowProfileModal(true);
    setShowAppearanceModal(false);
    setShowProfileMenu(false);
    setShowNotifications(false);
  }, []);

  const closeProfileModal = useCallback(() => {
    setShowProfileModal(false);
    setProfileStatus((prev) => ({ ...prev, error: null, success: null }));
    setImageToCrop(null);
    setCropModalOpen(false);
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!currentUser?.email) return;
    setProfileStatus((prev) => ({ ...prev, error: null, success: null }));
    try {
      const token = getStoredToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      
      // Fetch user profile data using /me endpoint
      const response = await fetch(`/api/proxy/auth/me`, {
        headers,
        credentials: 'include',
      });
      if (response.status === 401) {
        throw new Error('You must be signed in to update your profile.');
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || data?.error || 'Unable to load profile');
      }
      setProfileMetadata(data.metadata || {});
      setProfileFields(data.profile_fields || {});
      setProfilePictureUrl(data.profile_picture_url || null);
      
      // Update currentUser avatar if profile picture is available
      if (data.profile_picture_url) {
        setCurrentUser((prev) => prev ? {
          ...prev,
          avatar: data.profile_picture_url || undefined,
        } : null);
      }
      
      // Fetch profile field metadata (including email)
      try {
        const fieldsResponse = await fetch(`/api/proxy/auth/me/profile-fields`, {
          headers,
          credentials: 'include',
        });
        if (fieldsResponse.ok) {
          const fieldsData = await fieldsResponse.json().catch(() => []);
          // Defensive: endpoint may return an error object (or null), but UI expects an array.
          setProfileFieldMetadata(Array.isArray(fieldsData) ? fieldsData : []);
        }
      } catch (fieldsError) {
        // Silently fail if profile fields feature is not enabled
        console.debug('Profile fields not available:', fieldsError);
      }
      
      setProfileLoaded(true);

      // If HRM is enabled, also load employee profile for editing in the modal.
      if (hrmEnabled) {
        try {
          const eRes = await fetch('/api/hrm/employees/me', {
            headers,
            credentials: 'include',
          });
          if (eRes.status === 404) {
            setHrmEnabled(false);
          } else if (eRes.ok) {
            const eJson = await eRes.json().catch(() => ({}));
            const employee = (eJson as any)?.employee || null;
            setHrmEmployee(employee);
            setHrmForm({
              firstName: String(employee?.firstName || employee?.first_name || '').trim(),
              lastName: String(employee?.lastName || employee?.last_name || '').trim(),
              preferredName: String(employee?.preferredName || employee?.preferred_name || '').trim(),
            });
          }
        } catch {
          // optional
        }
      }
    } catch (error) {
      setProfileStatus((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load profile',
        success: null,
      }));
    }
  }, [currentUser?.email, hrmEnabled, onLogout]);

  const handleProfileSave = useCallback(async () => {
    if (!currentUser?.email) {
      setProfileStatus({ saving: false, error: 'No user loaded.', success: null });
      return;
    }
    if (profileForm.password && profileForm.password !== profileForm.confirmPassword) {
      setProfileStatus({ saving: false, error: 'Passwords do not match.', success: null });
      return;
    }

    setProfileStatus({ saving: true, error: null, success: null });
    try {
      const token = getStoredToken();
      if (!token) {
        throw new Error('You must be signed in to update your profile.');
      }

      // HRM employee profile (optional). Save first so displayName updates immediately.
      if (hrmEnabled) {
        const firstName = String(hrmForm.firstName || '').trim();
        const lastName = String(hrmForm.lastName || '').trim();
        const preferredName = String(hrmForm.preferredName || '').trim();

        // Only attempt save if the user filled anything in (avoid forcing HRM in existing installs).
        if (firstName || lastName || preferredName) {
          const hrmRes = await fetch('/api/hrm/employees/me', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            credentials: 'include',
            body: JSON.stringify({
              firstName,
              lastName,
              preferredName: preferredName || null,
            }),
          });
          if (hrmRes.status === 404) {
            setHrmEnabled(false);
          } else if (!hrmRes.ok) {
            const hrmJson = await hrmRes.json().catch(() => ({}));
            throw new Error(hrmJson?.error || hrmJson?.detail || 'Failed to update employee profile');
          } else {
            const hrmJson = await hrmRes.json().catch(() => ({}));
            const employee = (hrmJson as any)?.employee || null;
            setHrmEmployee(employee);
          }
        }
      }

      const payload: Record<string, any> = {};
      // Note: metadata.name is no longer used - email is used as the identifier
      if (Object.keys(profileMetadata).length > 0) {
        payload.metadata = profileMetadata;
      }
      if (profileForm.password) {
        payload.password = profileForm.password;
      }
      
      // Build profile_fields payload - include all required fields and any modified fields
      const nextProfileFields: Record<string, any> = { ...profileFields };
      
      // Ensure all required fields are included (even if disabled/uneditable)
      // This prevents backend validation errors for required fields like email
      for (const fieldMeta of profileFieldMetadata) {
        if (fieldMeta.required && !(fieldMeta.field_key in nextProfileFields)) {
          // For email, get it from currentUser
          if (fieldMeta.field_key === 'email' && currentUser?.email) {
            nextProfileFields[fieldMeta.field_key] = currentUser.email;
          }
          // For other required fields, check if they exist in the fetched profile_fields
          // (they should have been loaded in fetchProfile, but include them to be safe)
          else if (profileFields[fieldMeta.field_key] !== undefined) {
            nextProfileFields[fieldMeta.field_key] = profileFields[fieldMeta.field_key];
          }
        }
      }
      
      // Include profile_fields if there are any fields to send
      if (Object.keys(nextProfileFields).length > 0) {
        payload.profile_fields = nextProfileFields;
      }

      const response = await fetch(`/api/proxy/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || data?.error || 'Failed to update profile');
      }

      setProfileMetadata(data.metadata || profileMetadata);
      setProfileFields(data.profile_fields || profileFields);
      // Note: email is used as the identifier, not a separate name field
      setProfileStatus({ saving: false, error: null, success: 'Profile updated successfully.' });
      setProfileForm((prev) => ({ ...prev, password: '', confirmPassword: '' }));
      setProfileLoaded(true);
    } catch (error) {
      setProfileStatus({
        saving: false,
        error: error instanceof Error ? error.message : 'Failed to update profile',
        success: null,
      });
    }
  }, [
    currentUser?.email,
    profileForm.confirmPassword,
    profileForm.password,
    profileMetadata,
    profileFields,
    profileFieldMetadata,
    hrmEnabled,
    hrmForm.firstName,
    hrmForm.lastName,
    hrmForm.preferredName,
  ]);

  const handlePictureUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setProfileStatus({
        saving: false,
        error: 'File must be an image',
        success: null,
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setProfileStatus({
        saving: false,
        error: 'File size must be less than 5MB',
        success: null,
      });
      return;
    }

    // Convert file to data URL and show crop modal
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageToCrop(reader.result as string);
      setCropModalOpen(true);
    };
    reader.onerror = () => {
      setProfileStatus({
        saving: false,
        error: 'Failed to read image file',
        success: null,
      });
    };
    reader.readAsDataURL(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleCropComplete = useCallback(async (croppedImageBase64: string) => {
    if (!currentUser?.email) return;

    try {
      setUploadingPicture(true);
      const token = getStoredToken();
      if (!token) {
        throw new Error('You must be signed in to update your profile.');
      }

      // Update profile picture using PUT /me endpoint with base64 string
      const response = await fetch(`/api/proxy/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ profile_picture_url: croppedImageBase64 }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || data?.error || 'Failed to upload profile picture');
      }

      setProfilePictureUrl(data.profile_picture_url || null);
      
      // Update currentUser avatar
      setCurrentUser((prev) => prev ? {
        ...prev,
        avatar: data.profile_picture_url || undefined,
      } : null);

      // Dispatch event to update top header avatar
      if (typeof window !== 'undefined') {
        const updateEvent = new CustomEvent('user-profile-updated', {
          detail: { profile_picture_url: data.profile_picture_url, email: currentUser.email },
        });
        window.dispatchEvent(updateEvent);
      }

      setProfileStatus({
        saving: false,
        error: null,
        success: 'Profile picture updated successfully.',
      });
    } catch (err) {
      setProfileStatus({
        saving: false,
        error: err instanceof Error ? err.message : 'Failed to upload profile picture',
        success: null,
      });
    } finally {
      setUploadingPicture(false);
      setImageToCrop(null);
    }
  }, [currentUser?.email]);

  const handlePictureDelete = useCallback(async () => {
    if (!currentUser?.email) return;

    if (!confirm('Are you sure you want to delete your profile picture?')) {
      return;
    }

    try {
      setUploadingPicture(true);
      const token = getStoredToken();
      if (!token) {
        throw new Error('You must be signed in to update your profile.');
      }

      // Delete profile picture by setting it to null via PUT /me
      const response = await fetch(`/api/proxy/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ profile_picture_url: null }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || data?.error || 'Failed to delete profile picture');
      }

      setProfilePictureUrl(null);
      
      // Update currentUser avatar
      setCurrentUser((prev) => prev ? {
        ...prev,
        avatar: undefined,
      } : null);

      // Dispatch event to update top header avatar
      if (typeof window !== 'undefined') {
        const updateEvent = new CustomEvent('user-profile-updated', {
          detail: { profile_picture_url: null, email: currentUser.email },
        });
        window.dispatchEvent(updateEvent);
      }

      setProfileStatus({
        saving: false,
        error: null,
        success: 'Profile picture deleted successfully.',
      });
    } catch (err) {
      setProfileStatus({
        saving: false,
        error: err instanceof Error ? err.message : 'Failed to delete profile picture',
        success: null,
      });
    } finally {
      setUploadingPicture(false);
    }
  }, [currentUser?.email]);

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  useEffect(() => {
    if (showProfileModal && !profileLoaded && !profileStatus.saving) {
      fetchProfile();
    }
  }, [fetchProfile, profileLoaded, profileStatus.saving, showProfileModal]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const contextValue: ShellContextType = {
    menuOpen,
    setMenuOpen,
    expandedNodes,
    toggleNode,
  };

  const iconButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    background: 'none',
    border: 'none',
    borderRadius: radius.lg,
    color: colors.text.secondary,
    cursor: 'pointer',
    transition: 'all 150ms ease',
  };

  const showSidebar = menuOpen;
  const COLLAPSED_RAIL_WIDTH = '64px';
  const EXPANDED_SIDEBAR_WIDTH = '280px';

  const [pagePermsLoading, setPagePermsLoading] = useState(false);
  const [allowedByPath, setAllowedByPath] = useState<Record<string, boolean>>({});

  // Compute role-filtered nav, then permission-filter (batched).
  // Memoize so callers that reconstruct arrays each render don't retrigger permission checks.
  const roleFilteredNav = React.useMemo(
    () => filterNavByRoles(navItems, currentUser?.roles),
    [navItems, currentUser?.roles]
  );

  // Stable signature for permission checks: the set of reachable paths (after role filtering).
  // This prevents "nav flashes" caused by referential changes in navItems.
  const navPathsKey = React.useMemo(() => {
    const paths = flattenNavPaths(roleFilteredNav).sort();
    return paths.join('\n');
  }, [roleFilteredNav]);

  useEffect(() => {
    let cancelled = false;
    const paths = navPathsKey ? navPathsKey.split('\n').filter(Boolean) : [];
    // Fail-closed while loading to avoid showing links that will 403.
    setPagePermsLoading(true);
    setAllowedByPath({});

    checkPagePermissionsBatch(paths)
      .then((m) => {
        if (cancelled) return;
        setAllowedByPath(m || {});
      })
      .finally(() => {
        if (cancelled) return;
        setPagePermsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.email, currentUser?.roles, navPathsKey]);

  const permissionFilteredNav = pagePermsLoading
    ? ([] as NavItem[])
    : filterNavByPagePermissions(roleFilteredNav, allowedByPath);

  const groupedNavItems = groupNavItems(permissionFilteredNav);
  // Flatten all items for the collapsed rail
  const allFlatNavItems = groupedNavItems.flatMap(group => group.items);

  // Prevent flash of unstyled content during hydration
  // Use CSS variables that respect the theme already set by blocking script in layout.tsx
  if (!mounted) {
    return (
      <div style={{ 
        display: 'flex', 
        height: '100vh', 
        // Use theme-aware colors: light theme = white bg, dark theme = dark bg
        // The blocking script already set data-theme and .dark class on <html>
        backgroundColor: resolvedTheme === 'light' ? '#ffffff' : '#0f0f0f',
        color: resolvedTheme === 'light' ? '#0f0f0f' : '#ffffff',
      }} />
    );
  }

  return (
    <ShellContext.Provider value={contextValue}>
      <div style={styles({
        display: 'flex',
        height: '100vh',
        backgroundColor: colors.bg.page,
        color: colors.text.primary,
        margin: 0,
        padding: 0,
      })}>
        {/* Collapsed Rail - always visible, shows icons when sidebar is collapsed */}
        {!showSidebar && (
          <aside style={styles({
            width: COLLAPSED_RAIL_WIDTH,
            minWidth: COLLAPSED_RAIL_WIDTH,
            height: '100%',
            backgroundColor: colors.bg.muted,
            borderRight: `1px solid ${colors.border.subtle}`,
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            zIndex: 100,
          })}>
            {/* Rail Header - Logo only */}
            <div style={styles({
              height: '64px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderBottom: `1px solid ${colors.border.subtle}`,
              flexShrink: 0,
            })}>
              <button
                onClick={() => setMenuOpen(true)}
                style={styles({
                  width: '40px',
                  height: '40px',
                  background: 'linear-gradient(135deg, #F26522, #FF8C42)',
                  borderRadius: radius.md,
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'transform 150ms ease',
                })}
                title={`Expand ${config.brandName} navigation`}
              >
                {config.logoUrl ? (
                  <img src={config.logoUrl} alt={config.brandName} style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                ) : (
                  <span style={styles({ color: '#FFFFFF', fontWeight: 700, fontSize: ts.heading3.fontSize })}>
                    {config.brandName.charAt(0)}
                  </span>
                )}
              </button>
            </div>

            {/* Rail Navigation Icons with Flyouts */}
            <nav 
              ref={collapsedNavRef}
              onScroll={handleNavScroll}
              style={styles({
                flex: 1,
                overflowY: 'auto',
                padding: `${spacing.sm} 0`,
              })}
            >
              {allFlatNavItems.map((item) => (
                <CollapsedNavItem
                  key={item.id}
                  item={item}
                  activePath={activePath}
                  onNavigate={onNavigate}
                  isOpen={openFlyoutId === item.id}
                  onOpen={(itemId) => handleFlyoutOpen(itemId)}
                  onStartClose={handleFlyoutStartClose}
                  onCancelClose={handleFlyoutCancelClose}
                />
              ))}
            </nav>

            {/* Rail Footer - Connection status indicator */}
            <div style={styles({
              padding: spacing.md,
              borderTop: `1px solid ${colors.border.subtle}`,
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'center',
            })}>
              <div style={styles({
                width: '10px',
                height: '10px',
                backgroundColor: connectionStatus === 'connected' ? colors.success.default 
                  : connectionStatus === 'connecting' ? colors.warning.default
                  : colors.error.default,
                borderRadius: radius.full,
                ...(connectionStatus === 'connecting' ? { animation: 'pulse 1.5s ease-in-out infinite' } : {}),
              })} title={
                connectionStatus === 'connected' ? 'WebSocket Connected' 
                : connectionStatus === 'connecting' ? 'Connecting...'
                : 'Disconnected'
              } />
            </div>
          </aside>
        )}

        {/* Expanded Sidebar - Full navigation */}
        {showSidebar && (
          <aside style={styles({
            width: EXPANDED_SIDEBAR_WIDTH,
            minWidth: EXPANDED_SIDEBAR_WIDTH,
            height: '100%',
            backgroundColor: colors.bg.muted,
            borderRight: `1px solid ${colors.border.subtle}`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0,
            margin: 0,
            padding: 0,
          })}>
            {/* Sidebar Header */}
            <div style={styles({
              height: '64px',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `0 ${spacing.md}`,
              margin: 0,
              borderBottom: `1px solid ${colors.border.subtle}`,
              flexShrink: 0,
              boxSizing: 'border-box',
            })}>
              <div style={styles({ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0, flex: 1 })}>
                <div style={styles({
                  width: '32px',
                  height: '32px',
                  background: 'linear-gradient(135deg, #F26522, #FF8C42)',
                  borderRadius: radius.md,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                })}>
                  {config.logoUrl ? (
                    <img src={config.logoUrl} alt={config.brandName} style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                  ) : (
                    <span style={styles({ color: '#FFFFFF', fontWeight: 700, fontSize: ts.body.fontSize })}>
                      {config.brandName.charAt(0)}
                    </span>
                  )}
                </div>
                <span style={styles({ fontSize: ts.heading3.fontSize, fontWeight: ts.heading3.fontWeight, color: colors.text.primary })}>
                  {config.brandName}
                </span>
              </div>
              <button 
                onClick={() => setMenuOpen(false)} 
                style={{ 
                  ...iconButtonStyle, 
                  width: '36px', 
                  height: '36px',
                  flexShrink: 0,
                }}
              >
                <Menu size={20} />
              </button>
            </div>

            {/* Navigation */}
            <nav 
              ref={expandedNavRef}
              onScroll={handleNavScroll}
              style={styles({
                flex: 1,
                overflowY: 'auto',
                padding: `${spacing.sm} ${spacing.md}`,
                minWidth: EXPANDED_SIDEBAR_WIDTH,
              })}
            >
              {groupedNavItems.map((group) => (
                <div key={group.group}>
                  <NavGroupHeader label={group.label} />
                  {group.items.map((item) => (
                    <NavItemComponent
                      key={`${group.group}-${item.id}`}
                      item={item}
                      activePath={activePath}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              ))}
            </nav>

            {/* Sidebar Footer - Connection status */}
            <div style={styles({
              padding: spacing.lg,
              borderTop: `1px solid ${colors.border.subtle}`,
              flexShrink: 0,
              minWidth: EXPANDED_SIDEBAR_WIDTH,
            })}>
              <div style={styles({ display: 'flex', alignItems: 'center', gap: spacing.sm, fontSize: ts.bodySmall.fontSize, color: colors.text.muted })}>
                <div style={styles({
                  width: '8px',
                  height: '8px',
                  backgroundColor: connectionStatus === 'connected' ? colors.success.default 
                    : connectionStatus === 'connecting' ? colors.warning.default
                    : colors.error.default,
                  borderRadius: radius.full,
                  ...(connectionStatus === 'connecting' ? { animation: 'pulse 1.5s ease-in-out infinite' } : {}),
                })} />
                <span>
                  {connectionStatus === 'connected' ? `Connected${version ? ` v${version}` : ''}` 
                    : connectionStatus === 'connecting' ? 'Connecting...'
                    : 'Disconnected'}
                </span>
              </div>
            </div>
          </aside>
        )}

        {/* Main Content */}
        <div style={styles({ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' })}>
          {/* Top Bar */}
          <header style={styles({
            height: '64px',
            backgroundColor: colors.bg.surface,
            borderBottom: `1px solid ${colors.border.subtle}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `0 ${spacing['2xl']}`,
            flexShrink: 0,
          })}>
            <div style={styles({ display: 'flex', alignItems: 'center', gap: spacing.lg })}>
              {/* Spacer - navigation is handled by collapsed rail */}
            </div>

            <div style={styles({ display: 'flex', alignItems: 'center', gap: spacing.sm })}>
              {config.showThemeToggle && (
                <button
                  onClick={openAppearance}
                  style={iconButtonStyle}
                  aria-label="Theme settings"
                >
                  {resolvedTheme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                </button>
              )}
              {config.showNotifications && (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => {
                      const next = !showNotifications;
                      setShowNotifications(next);
                      setShowProfileMenu(false);
                      if (next) {
                        refreshNotifications({ markRead: true });
                      }
                    }}
                    style={iconButtonStyle}
                  >
                    <Bell size={20} />
                    {unreadCount > 0 && (
                      <span style={styles({
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '18px',
                        height: '18px',
                        backgroundColor: colors.error.default,
                        color: colors.text.inverse,
                        fontSize: '11px',
                        fontWeight: 600,
                        borderRadius: radius.full,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      })}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <>
                      <div
                        onClick={() => setShowNotifications(false)}
                        style={styles({ position: 'fixed', inset: 0, zIndex: 40 })}
                      />
                      <div
                        style={styles({
                          position: 'absolute',
                          right: 0,
                          top: '100%',
                          marginTop: spacing.sm,
                          width: 'min(420px, calc(100vw - 32px))',
                          backgroundColor: colors.bg.surface,
                          border: `1px solid ${colors.border.default}`,
                          borderRadius: radius.lg,
                          boxShadow: shadows.xl,
                          zIndex: 50,
                          overflow: 'hidden',
                        })}
                      >
                        <div style={styles({
                          padding: `${spacing.md} ${spacing.lg}`,
                          borderBottom: `1px solid ${colors.border.subtle}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: spacing.md,
                        })}>
                          <div style={styles({ display: 'flex', flexDirection: 'column', gap: spacing.px })}>
                            <div style={styles({ fontSize: ts.body.fontSize, fontWeight: 700, color: colors.text.primary })}>
                              Inbox
                            </div>
                            <div style={styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted })}>
                              {notificationsLoading ? 'Loading…' : `${notifications.length} item(s)`}
                            </div>
                          </div>
                          <div style={styles({ display: 'flex', alignItems: 'center', gap: spacing.xs })}>
                            <button
                              onClick={() => refreshNotifications()}
                              style={styles({
                                ...iconButtonStyle,
                                width: '36px',
                                height: '36px',
                                backgroundColor: colors.bg.muted,
                              })}
                              aria-label="Refresh notifications"
                              title="Refresh"
                            >
                              <RotateCw size={16} />
                            </button>
                            <button
                              onClick={() => setShowNotifications(false)}
                              style={styles({
                                ...iconButtonStyle,
                                width: '36px',
                                height: '36px',
                                backgroundColor: colors.bg.muted,
                              })}
                              aria-label="Close notifications"
                              title="Close"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>

                        {notificationsError && (
                          <div style={styles({
                            padding: `${spacing.sm} ${spacing.lg}`,
                            backgroundColor: colors.bg.muted,
                            borderBottom: `1px solid ${colors.border.subtle}`,
                            color: colors.error.default,
                            fontSize: ts.bodySmall.fontSize,
                          })}>
                            {notificationsError}
                          </div>
                        )}

                        <div style={styles({ maxHeight: '420px', overflowY: 'auto' })}>
                          {notifications.length === 0 && !notificationsLoading ? (
                            <div style={styles({
                              padding: `${spacing.lg} ${spacing.lg}`,
                              color: colors.text.muted,
                              fontSize: ts.body.fontSize,
                            })}>
                              No notifications yet.
                            </div>
                          ) : (
                            <div style={styles({ padding: spacing.sm, display: 'flex', flexDirection: 'column', gap: spacing.sm })}>
                              {notifications.map((n) => {
                                const isUnread = !n.read;
                                const status = n.status || (n.read ? 'resolved' : 'open');
                                const tsRaw = n.timestamp;
                                const tsStr = (() => {
                                  try {
                                    const d = tsRaw instanceof Date ? tsRaw : new Date(tsRaw);
                                    return d.toLocaleString();
                                  } catch {
                                    return String(tsRaw);
                                  }
                                })();

                                return (
                                  <div
                                    key={String(n.id)}
                                    style={styles({
                                      padding: `${spacing.md} ${spacing.lg}`,
                                      borderRadius: radius.lg,
                                      border: `1px solid ${isUnread ? colors.primary.default : colors.border.subtle}`,
                                      backgroundColor: isUnread ? `${colors.primary.default}10` : colors.bg.page,
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: spacing.sm,
                                    })}
                                  >
                                    <div style={styles({ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md })}>
                                      <div style={styles({ display: 'flex', flexDirection: 'column', gap: spacing.xs, minWidth: 0, flex: 1 })}>
                                        <div style={styles({
                                          fontSize: ts.body.fontSize,
                                          fontWeight: 700,
                                          color: colors.text.primary,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        })}>
                                          {n.title}
                                        </div>
                                        <div style={styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted })}>
                                          {tsStr}
                                        </div>
                                      </div>
                                      <div style={styles({
                                        padding: '2px 8px',
                                        borderRadius: radius.full,
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        backgroundColor: status === 'open' ? `${colors.warning.default}20` : `${colors.success.default}20`,
                                        color: status === 'open' ? colors.warning.default : colors.success.default,
                                        flexShrink: 0,
                                      })}>
                                        {status === 'open' ? 'OPEN' : 'RESOLVED'}
                                      </div>
                                    </div>

                                    <div style={styles({ fontSize: ts.body.fontSize, color: colors.text.secondary })}>
                                      {n.message}
                                    </div>

                                    {n.resolved?.summary || n.resolved?.by ? (
                                      <div style={styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted })}>
                                        {n.resolved?.summary ? `${n.resolved.summary}` : 'Resolved'}
                                        {n.resolved?.by ? ` by ${n.resolved.by}` : ''}
                                      </div>
                                    ) : null}

                                    {Array.isArray(n.actions) && n.actions.length > 0 ? (
                                      <div style={styles({ display: 'flex', gap: spacing.sm, justifyContent: 'flex-end', flexWrap: 'wrap' })}>
                                        {n.actions.map((a) => (
                                          <button
                                            key={a.id}
                                            onClick={() => runNotificationAction(a)}
                                            style={styles({
                                              padding: `${spacing.xs} ${spacing.md}`,
                                              borderRadius: radius.md,
                                              border: 'none',
                                              cursor: 'pointer',
                                              fontSize: ts.bodySmall.fontSize,
                                              fontWeight: 700,
                                              backgroundColor: a.variant === 'danger' ? colors.error.default : a.variant === 'secondary' ? colors.bg.muted : colors.primary.default,
                                              color: a.variant === 'secondary' ? colors.text.primary : colors.text.inverse,
                                            })}
                                          >
                                            {a.label}
                                          </button>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {config.showUserMenu && (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifications(false); }}
                    style={styles({
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.md,
                      padding: `${spacing.xs} ${spacing.md} ${spacing.xs} ${spacing.xs}`,
                      background: 'none',
                      border: 'none',
                      borderRadius: radius.lg,
                      cursor: 'pointer',
                    })}
                  >
                    {currentUser?.avatar ? (
                      <img
                        src={currentUser.avatar}
                        alt={userDisplayName || currentUser?.email || 'User'}
                        style={styles({
                          width: '36px',
                          height: '36px',
                          borderRadius: radius.full,
                          objectFit: 'cover',
                          ...(impersonation.active ? { boxShadow: `0 0 0 2px ${colors.warning.default}` } : {}),
                        })}
                      />
                    ) : (
                      <div style={styles({
                        width: '36px',
                        height: '36px',
                        background: `linear-gradient(135deg, ${colors.primary.default}, ${colors.accent.default})`,
                        borderRadius: radius.full,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        ...(impersonation.active ? { boxShadow: `0 0 0 2px ${colors.warning.default}` } : {}),
                      })}>
                        <span style={styles({ color: colors.text.inverse, fontWeight: 700, fontSize: '12px' })}>
                          {toInitials(userDisplayName)}
                        </span>
                      </div>
                    )}
                    <div style={styles({ textAlign: 'left' })}>
                      <div style={styles({ fontSize: ts.body.fontSize, fontWeight: ts.label.fontWeight, color: colors.text.primary })}>
                        {userDisplayName || currentUser?.email || 'User'}
                      </div>
                      <div style={styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted })}>
                        {currentUser?.roles?.[0] || 'Member'}
                      </div>
                    </div>
                  </button>

                  {showProfileMenu && (
                    <>
                      <div onClick={() => setShowProfileMenu(false)} style={styles({ position: 'fixed', inset: 0, zIndex: 40 })} />
                      <div style={styles({
                        position: 'absolute',
                        right: 0,
                        top: '100%',
                        marginTop: spacing.sm,
                        width: '220px',
                        backgroundColor: colors.bg.surface,
                        border: `1px solid ${colors.border.default}`,
                        borderRadius: radius.lg,
                        boxShadow: shadows.xl,
                        zIndex: 50,
                        overflow: 'hidden',
                      })}>
                        <div style={styles({ 
                          padding: `${spacing.md} ${spacing.lg}`, 
                          borderBottom: `1px solid ${colors.border.subtle}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.sm,
                        })}>
                          {currentUser?.avatar ? (
                            <img
                              src={currentUser.avatar}
                              alt={userDisplayName || currentUser?.email || 'User'}
                              style={styles({
                                width: '40px',
                                height: '40px',
                                borderRadius: radius.full,
                                objectFit: 'cover',
                                ...(impersonation.active ? { boxShadow: `0 0 0 2px ${colors.warning.default}` } : {}),
                              })}
                            />
                          ) : (
                            <div style={styles({
                              width: '40px',
                              height: '40px',
                              background: `linear-gradient(135deg, ${colors.primary.default}, ${colors.accent.default})`,
                              borderRadius: radius.full,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              ...(impersonation.active ? { boxShadow: `0 0 0 2px ${colors.warning.default}` } : {}),
                            })}>
                              <span style={styles({ color: colors.text.inverse, fontWeight: 800, fontSize: '13px' })}>
                                {toInitials(userDisplayName)}
                              </span>
                            </div>
                          )}
                          <div style={styles({ flex: 1, minWidth: 0 })}>
                            <div style={styles({ fontSize: ts.body.fontSize, fontWeight: ts.label.fontWeight, color: colors.text.primary })}>
                              {userDisplayName || currentUser?.email || 'User'}
                            </div>
                            <div style={styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted })}>
                              {currentUser?.roles?.[0] || 'Member'}
                            </div>
                          </div>
                        </div>
                        {impersonation.active && (
                          <div style={styles({
                            padding: `${spacing.sm} ${spacing.lg}`,
                            borderBottom: `1px solid ${colors.border.subtle}`,
                            backgroundColor: `${colors.warning.default}12`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: spacing.xs,
                          })}>
                            <div style={styles({ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', color: colors.warning.default })}>
                              ASSUMING USER
                            </div>
                            <div style={styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.primary, wordBreak: 'break-word' })}>
                              {currentUser?.email || 'Unknown user'}
                            </div>
                            {impersonation.by ? (
                              <div style={styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted })}>
                                Admin: {impersonation.by}
                              </div>
                            ) : null}
                            {impersonationError ? (
                              <div style={styles({ fontSize: ts.bodySmall.fontSize, color: colors.error.default })}>
                                {impersonationError}
                              </div>
                            ) : null}
                            <div style={styles({ marginTop: spacing.xs, display: 'flex', justifyContent: 'flex-end', gap: spacing.sm })}>
                              <button
                                onClick={() => { setShowProfileMenu(false); endImpersonation({ clearLast: false }); }}
                                disabled={endingImpersonation}
                                title="Switch back (keeps this user ready to re-assume)"
                                style={styles({
                                  width: '34px',
                                  height: '34px',
                                  borderRadius: radius.full,
                                  border: `1px solid ${colors.warning.default}`,
                                  backgroundColor: colors.bg.surface,
                                  color: colors.text.primary,
                                  cursor: endingImpersonation ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                })}
                              >
                                <RotateCw size={16} />
                              </button>
                              <button
                                onClick={() => { setShowProfileMenu(false); endImpersonation({ clearLast: true }); }}
                                disabled={endingImpersonation}
                                style={styles({
                                  padding: `${spacing.xs} ${spacing.md}`,
                                  borderRadius: radius.md,
                                  border: `1px solid ${colors.warning.default}`,
                                  backgroundColor: colors.bg.surface,
                                  color: colors.text.primary,
                                  cursor: endingImpersonation ? 'not-allowed' : 'pointer',
                                  fontSize: ts.bodySmall.fontSize,
                                  fontWeight: 700,
                                })}
                              >
                                {endingImpersonation ? 'Exiting…' : 'Exit assume'}
                              </button>
                            </div>
                          </div>
                        )}
                        {!impersonation.active && lastImpersonatedEmail && (currentUser?.roles?.includes('admin') || currentUser?.roles?.includes('owner')) && (
                          <div style={styles({
                            padding: `${spacing.sm} ${spacing.lg}`,
                            borderBottom: `1px solid ${colors.border.subtle}`,
                            backgroundColor: `${colors.warning.default}08`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: spacing.sm,
                          })}>
                            <div style={styles({ minWidth: 0 })}>
                              <div style={styles({ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', color: colors.warning.default })}>
                                READY TO TOGGLE
                              </div>
                              <div style={styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.primary, wordBreak: 'break-word' })}>
                                {lastImpersonatedEmail}
                              </div>
                              {impersonationError ? (
                                <div style={styles({ fontSize: ts.bodySmall.fontSize, color: colors.error.default })}>
                                  {impersonationError}
                                </div>
                              ) : null}
                            </div>
                            <button
                              onClick={() => { setShowProfileMenu(false); resumeLastImpersonation(); }}
                              disabled={startingImpersonation}
                              title="Assume last user"
                              style={styles({
                                width: '34px',
                                height: '34px',
                                borderRadius: radius.full,
                                border: `1px solid ${colors.warning.default}`,
                                backgroundColor: colors.bg.surface,
                                color: colors.text.primary,
                                cursor: startingImpersonation ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              })}
                            >
                              <RotateCw size={16} />
                            </button>
                          </div>
                        )}
                        <div style={styles({ padding: spacing.sm })}>
                          <button
                            onClick={openProfileModal}
                            style={styles({
                              display: 'flex',
                              alignItems: 'center',
                              gap: spacing.sm,
                              width: '100%',
                              padding: `${spacing.sm} ${spacing.md}`,
                              background: 'none',
                              border: 'none',
                              borderRadius: radius.md,
                              color: colors.text.primary,
                              fontSize: ts.body.fontSize,
                              cursor: 'pointer',
                              textAlign: 'left',
                            })}
                          >
                            <User size={16} style={{ color: colors.text.muted }} />
                            Profile
                          </button>
                          <button
                            onClick={openAppearance}
                            style={styles({
                              display: 'flex',
                              alignItems: 'center',
                              gap: spacing.sm,
                              width: '100%',
                              padding: `${spacing.sm} ${spacing.md}`,
                              background: 'none',
                              border: 'none',
                              borderRadius: radius.md,
                              color: colors.text.primary,
                              fontSize: ts.body.fontSize,
                              cursor: 'pointer',
                              textAlign: 'left',
                            })}
                          >
                            <Settings size={16} style={{ color: colors.text.muted }} />
                            Settings
                          </button>
                        </div>
                        <div style={styles({ padding: spacing.sm, borderTop: `1px solid ${colors.border.subtle}` })}>
                          <button
                            onClick={() => { setShowProfileMenu(false); onLogout?.(); }}
                            style={styles({
                              display: 'flex',
                              alignItems: 'center',
                              gap: spacing.sm,
                              width: '100%',
                              padding: `${spacing.sm} ${spacing.md}`,
                              background: 'none',
                              border: 'none',
                              borderRadius: radius.md,
                              color: colors.error.default,
                              fontSize: ts.body.fontSize,
                              cursor: 'pointer',
                              textAlign: 'left',
                            })}
                          >
                            <LogOut size={16} />
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </header>

          {/* Page Content */}
          <main
            style={styles({
              flex: 1,
              overflow: 'auto',
              padding: spacing['2xl'],
              backgroundColor: colors.bg.page,
            })}
            onClick={() => { setShowNotifications(false); setShowProfileMenu(false); }}
          >
            <div style={styles({ maxWidth: '1280px', margin: '0 auto' })}>
              {children}
            </div>
          </main>
        </div>
      </div>

      {showAppearanceModal && (
        <>
          <div
            onClick={closeAppearance}
            style={styles({
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(4px)',
              zIndex: 90,
            })}
          />
          <div
            style={styles({
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: spacing['2xl'],
              zIndex: 100,
            })}
          >
            <div
              style={styles({
                width: 'min(640px, 100%)',
                backgroundColor: colors.bg.surface,
                borderRadius: radius.xl,
                border: `1px solid ${colors.border.default}`,
                boxShadow: shadows.xl,
                overflow: 'hidden',
              })}
            >
              <div
                style={styles({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: `${spacing.lg} ${spacing.xl}`,
                  borderBottom: `1px solid ${colors.border.subtle}`,
                })}
              >
                <div>
                  <div style={styles({ fontSize: ts.heading3.fontSize, fontWeight: ts.heading3.fontWeight })}>Appearance</div>
                  <div style={styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted })}>
                    Switch between light, dark, or system. We save your choice in a cookie and localStorage.
                  </div>
                </div>
                <button
                  onClick={closeAppearance}
                  style={{
                    ...iconButtonStyle,
                    width: '36px',
                    height: '36px',
                    backgroundColor: colors.bg.muted,
                  }}
                  aria-label="Close appearance settings"
                >
                  <X size={18} />
                </button>
              </div>

              <div style={styles({ padding: spacing.xl, display: 'flex', flexDirection: 'column', gap: spacing.xl })}>
                <div style={styles({ display: 'flex', flexDirection: 'column', gap: spacing.md })}>
                    <div style={styles({ fontWeight: ts.label.fontWeight, fontSize: ts.body.fontSize })}>Theme</div>
                    <div style={styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted })}>
                      Switch between light and dark. We store your choice in a cookie and localStorage so it sticks across visits.
                    </div>
                    <div style={styles({ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: spacing.md })}>
                      {[
                        { value: 'light' as ThemePreference, label: 'Light', icon: <Sun size={16} /> },
                        { value: 'dark' as ThemePreference, label: 'Dark', icon: <Moon size={16} /> },
                        { value: 'system' as ThemePreference, label: 'System', icon: <Monitor size={16} /> },
                      ].map((option) => {
                        const active = themePreference === option.value;
                        return (
                          <button
                            key={option.value}
                            onClick={() => applyThemePreference(option.value)}
                            style={styles({
                              display: 'flex',
                              alignItems: 'center',
                              gap: spacing.sm,
                              padding: `${spacing.md} ${spacing.lg}`,
                              borderRadius: radius.lg,
                              border: `1px solid ${active ? colors.border.strong : colors.border.subtle}`,
                              backgroundColor: active ? colors.bg.muted : colors.bg.page,
                              cursor: 'pointer',
                              textAlign: 'left',
                              color: colors.text.primary,
                              boxShadow: active ? shadows.md : 'none',
                            })}
                          >
                            <span
                              style={styles({
                                width: '32px',
                                height: '32px',
                                borderRadius: radius.full,
                                backgroundColor: active ? colors.bg.muted : colors.bg.surface,
                                display: 'grid',
                                placeItems: 'center',
                                color: active ? colors.primary.default : colors.text.secondary,
                              })}
                            >
                              {option.icon}
                            </span>
                            <div style={styles({ display: 'flex', flexDirection: 'column', gap: spacing.px })}>
                              <span style={styles({ fontWeight: ts.label.fontWeight })}>{option.label}</span>
                              <span style={styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted })}>
                                {option.value === 'system' ? 'Match your device preference' : `Force ${option.label.toLowerCase()} mode`}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div style={styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.secondary })}>
                      Using <strong>{resolvedTheme}</strong> theme (preference: {themePreference}).
                    </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {showProfileModal && (
        <>
          <div
            onClick={closeProfileModal}
            style={styles({
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(4px)',
              zIndex: 90,
            })}
          />
          <div
            style={styles({
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: spacing['2xl'],
              zIndex: 100,
            })}
          >
            <div
              style={styles({
                width: 'min(640px, 100%)',
                backgroundColor: colors.bg.surface,
                borderRadius: radius.xl,
                border: `1px solid ${colors.border.default}`,
                boxShadow: shadows.xl,
                overflow: 'hidden',
              })}
            >
              <div
                style={styles({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: `${spacing.lg} ${spacing.xl}`,
                  borderBottom: `1px solid ${colors.border.subtle}`,
                })}
              >
                <div>
                  <div style={styles({ fontSize: ts.heading3.fontSize, fontWeight: ts.heading3.fontWeight })}>Profile</div>
                  <div style={styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted })}>
                    Update your profile fields and optionally set a new password.
                  </div>
                </div>
                <button
                  onClick={closeProfileModal}
                  style={{
                    ...iconButtonStyle,
                    width: '36px',
                    height: '36px',
                    backgroundColor: colors.bg.muted,
                  }}
                  aria-label="Close profile settings"
                >
                  <X size={18} />
                </button>
              </div>

              <div style={styles({ padding: spacing.xl, display: 'flex', flexDirection: 'column', gap: spacing.md })}>
                {/* Profile Picture Section */}
                <div style={styles({ display: 'flex', flexDirection: 'column', gap: spacing.sm, paddingBottom: spacing.md, borderBottom: `1px solid ${colors.border.subtle}` })}>
                  <label style={styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.secondary })}>
                    Profile Picture
                  </label>
                  <div style={styles({ display: 'flex', alignItems: 'center', gap: spacing.md })}>
                    {profilePictureUrl ? (
                      <img
                        src={profilePictureUrl}
                        alt={userDisplayName || currentUser?.email || 'User'}
                        style={styles({
                          width: '80px',
                          height: '80px',
                          borderRadius: radius.full,
                          objectFit: 'cover',
                          border: `2px solid ${colors.border.default}`,
                        })}
                      />
                    ) : (
                      <div style={styles({
                        width: '80px',
                        height: '80px',
                        background: `linear-gradient(135deg, ${colors.primary.default}, ${colors.accent.default})`,
                        borderRadius: radius.full,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `2px solid ${colors.border.default}`,
                      })}>
                        <span style={styles({ color: colors.text.inverse, fontWeight: 800, fontSize: '22px' })}>
                          {toInitials(userDisplayName)}
                        </span>
                      </div>
                    )}
                    <div style={styles({ display: 'flex', flexDirection: 'column', gap: spacing.xs, flex: 1 })}>
                      <div style={styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted })}>
                        {userDisplayName || currentUser?.email || 'User'}
                      </div>
                      {currentUser?.email && userDisplayName && userDisplayName !== currentUser.email ? (
                        <div style={styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.secondary })}>
                          {currentUser.email}
                        </div>
                      ) : null}
                      <div style={styles({ display: 'flex', gap: spacing.sm })}>
                        <button
                          onClick={triggerFileInput}
                          disabled={uploadingPicture}
                          style={styles({
                            display: 'flex',
                            alignItems: 'center',
                            gap: spacing.xs,
                            padding: `${spacing.xs} ${spacing.sm}`,
                            borderRadius: radius.md,
                            border: `1px solid ${colors.border.default}`,
                            backgroundColor: colors.bg.page,
                            color: colors.text.primary,
                            fontSize: ts.bodySmall.fontSize,
                            cursor: uploadingPicture ? 'wait' : 'pointer',
                            opacity: uploadingPicture ? 0.6 : 1,
                          })}
                        >
                          <Camera size={14} />
                          Change
                        </button>
                        {profilePictureUrl && (
                          <button
                            onClick={handlePictureDelete}
                            disabled={uploadingPicture}
                            style={styles({
                              display: 'flex',
                              alignItems: 'center',
                              gap: spacing.xs,
                              padding: `${spacing.xs} ${spacing.sm}`,
                              borderRadius: radius.md,
                              border: `1px solid ${colors.border.default}`,
                              backgroundColor: colors.bg.page,
                              color: colors.error.default,
                              fontSize: ts.bodySmall.fontSize,
                              cursor: uploadingPicture ? 'wait' : 'pointer',
                              opacity: uploadingPicture ? 0.6 : 1,
                            })}
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePictureUpload}
                    style={{ display: 'none' }}
                  />
                </div>

                {/* HRM Employee identity (optional) */}
                {hrmEnabled && (
                  <div style={styles({ display: 'flex', flexDirection: 'column', gap: spacing.sm, paddingBottom: spacing.md, borderBottom: `1px solid ${colors.border.subtle}` })}>
                    <div style={styles({ display: 'flex', flexDirection: 'column', gap: spacing.xs })}>
                      <div style={styles({ fontWeight: ts.label.fontWeight, fontSize: ts.body.fontSize })}>Employee name</div>
                      <div style={styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted })}>
                        If HRM is installed, this becomes the canonical display name across the ERP UI.
                      </div>
                    </div>

                    <label style={styles({ display: 'flex', flexDirection: 'column', gap: spacing.xs, fontSize: ts.bodySmall.fontSize })}>
                      <span style={styles({ color: colors.text.secondary })}>Preferred name (optional)</span>
                      <input
                        type="text"
                        value={hrmForm.preferredName}
                        onChange={(e) => setHrmForm((prev) => ({ ...prev, preferredName: e.target.value }))}
                        placeholder="Optional"
                        style={styles({
                          padding: `${spacing.sm} ${spacing.md}`,
                          borderRadius: radius.md,
                          border: `1px solid ${colors.border.default}`,
                          backgroundColor: colors.bg.page,
                          color: colors.text.primary,
                          fontSize: ts.body.fontSize,
                        })}
                      />
                    </label>

                    <div style={styles({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md })}>
                      <label style={styles({ display: 'flex', flexDirection: 'column', gap: spacing.xs, fontSize: ts.bodySmall.fontSize })}>
                        <span style={styles({ color: colors.text.secondary })}>First name *</span>
                        <input
                          type="text"
                          value={hrmForm.firstName}
                          onChange={(e) => setHrmForm((prev) => ({ ...prev, firstName: e.target.value }))}
                          placeholder="Required"
                          style={styles({
                            padding: `${spacing.sm} ${spacing.md}`,
                            borderRadius: radius.md,
                            border: `1px solid ${colors.border.default}`,
                            backgroundColor: colors.bg.page,
                            color: colors.text.primary,
                            fontSize: ts.body.fontSize,
                          })}
                        />
                      </label>
                      <label style={styles({ display: 'flex', flexDirection: 'column', gap: spacing.xs, fontSize: ts.bodySmall.fontSize })}>
                        <span style={styles({ color: colors.text.secondary })}>Last name *</span>
                        <input
                          type="text"
                          value={hrmForm.lastName}
                          onChange={(e) => setHrmForm((prev) => ({ ...prev, lastName: e.target.value }))}
                          placeholder="Required"
                          style={styles({
                            padding: `${spacing.sm} ${spacing.md}`,
                            borderRadius: radius.md,
                            border: `1px solid ${colors.border.default}`,
                            backgroundColor: colors.bg.page,
                            color: colors.text.primary,
                            fontSize: ts.body.fontSize,
                          })}
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* Profile Fields - Integrated (including email) */}
                {[...profileFieldMetadata]
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((fieldMeta) => {
                    const isAdmin =
                      (currentUser?.roles || []).map((r) => String(r || '').toLowerCase()).includes('admin');
                    const canEdit = isAdmin || fieldMeta.user_can_edit;
                    // Email comes from currentUser.email, other fields from profileFields
                    const fieldValue = fieldMeta.field_key === 'email' 
                      ? (currentUser?.email || '')
                      : (profileFields[fieldMeta.field_key] || '');
                    
                    return (
                      <label
                        key={fieldMeta.field_key}
                        style={styles({ display: 'flex', flexDirection: 'column', gap: spacing.xs, fontSize: ts.bodySmall.fontSize })}
                      >
                        <span style={styles({ color: colors.text.secondary })}>
                          {fieldMeta.field_label}
                          {fieldMeta.required && <span style={styles({ color: colors.error.default })}> *</span>}
                        </span>
                        <input
                          type={fieldMeta.field_type === 'int' ? 'number' : fieldMeta.field_key === 'email' ? 'email' : 'text'}
                          value={fieldValue}
                          onChange={(e) => {
                            if (fieldMeta.field_key === 'email') {
                              // Email typically cannot be edited, but handle it if needed
                              return;
                            }
                            const newValue = fieldMeta.field_type === 'int' 
                              ? (e.target.value === '' ? '' : parseInt(e.target.value, 10))
                              : e.target.value;
                            setProfileFields((prev) => ({
                              ...prev,
                              [fieldMeta.field_key]: newValue,
                            }));
                          }}
                          placeholder={fieldMeta.required ? 'Required' : 'Optional'}
                          disabled={!canEdit || fieldMeta.field_key === 'email'}
                          required={fieldMeta.required}
                          style={styles({
                            padding: `${spacing.sm} ${spacing.md}`,
                            borderRadius: radius.md,
                            border: `1px solid ${colors.border.default}`,
                            backgroundColor: (canEdit && fieldMeta.field_key !== 'email') ? colors.bg.page : colors.bg.muted,
                            color: colors.text.primary,
                            fontSize: ts.body.fontSize,
                            opacity: (canEdit && fieldMeta.field_key !== 'email') ? 1 : 0.6,
                            cursor: (canEdit && fieldMeta.field_key !== 'email') ? 'text' : 'not-allowed',
                          })}
                        />
                        {(!canEdit || fieldMeta.field_key === 'email') && (
                          <span style={styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted })}>
                            {fieldMeta.field_key === 'email' 
                              ? 'Email cannot be changed'
                              : 'This field can only be edited by administrators'}
                          </span>
                        )}
                      </label>
                    );
                  })}

                {/* Password fields */}
                <label style={styles({ display: 'flex', flexDirection: 'column', gap: spacing.xs, fontSize: ts.bodySmall.fontSize })}>
                  <span style={styles({ color: colors.text.secondary })}>New password</span>
                  <input
                    type="password"
                    value={profileForm.password}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder="Optional"
                    style={styles({
                      padding: `${spacing.sm} ${spacing.md}`,
                      borderRadius: radius.md,
                      border: `1px solid ${colors.border.default}`,
                      backgroundColor: colors.bg.page,
                      color: colors.text.primary,
                      fontSize: ts.body.fontSize,
                    })}
                  />
                </label>

                <label style={styles({ display: 'flex', flexDirection: 'column', gap: spacing.xs, fontSize: ts.bodySmall.fontSize })}>
                  <span style={styles({ color: colors.text.secondary })}>Confirm password</span>
                  <input
                    type="password"
                    value={profileForm.confirmPassword}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Optional"
                    style={styles({
                      padding: `${spacing.sm} ${spacing.md}`,
                      borderRadius: radius.md,
                      border: `1px solid ${colors.border.default}`,
                      backgroundColor: colors.bg.page,
                      color: colors.text.primary,
                      fontSize: ts.body.fontSize,
                    })}
                  />
                </label>

                {(profileStatus.error || profileStatus.success) && (
                  <div
                    style={styles({
                      padding: `${spacing.sm} ${spacing.md}`,
                      borderRadius: radius.md,
                      backgroundColor: colors.bg.muted,
                      color: profileStatus.error ? colors.error.default : colors.success.default,
                      border: `1px solid ${profileStatus.error ? colors.error.default : colors.success.default}`,
                    })}
                  >
                    {profileStatus.error || profileStatus.success}
                  </div>
                )}

                <div style={styles({ display: 'flex', justifyContent: 'flex-end', gap: spacing.sm })}>
                  <button
                    onClick={closeProfileModal}
                    style={styles({
                      padding: `${spacing.sm} ${spacing.md}`,
                      borderRadius: radius.md,
                      border: `1px solid ${colors.border.default}`,
                      backgroundColor: colors.bg.page,
                      color: colors.text.primary,
                      cursor: 'pointer',
                    })}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleProfileSave}
                    disabled={profileStatus.saving}
                    style={styles({
                      padding: `${spacing.sm} ${spacing.lg}`,
                      borderRadius: radius.md,
                      border: 'none',
                      backgroundColor: colors.primary.default,
                      color: colors.text.inverse,
                      fontWeight: ts.label.fontWeight,
                      cursor: profileStatus.saving ? 'wait' : 'pointer',
                      opacity: profileStatus.saving ? 0.8 : 1,
                    })}
                  >
                    {profileStatus.saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          {imageToCrop && (
            <ProfilePictureCropModal
              open={cropModalOpen}
              onClose={() => {
                setCropModalOpen(false);
                setImageToCrop(null);
              }}
              imageSrc={imageToCrop}
              onCropComplete={handleCropComplete}
            />
          )}
        </>
      )}
    </ShellContext.Provider>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface DashboardShellProps {
  children: React.ReactNode;
  config?: Partial<ShellConfig>;
  navItems?: NavItem[];
  user?: ShellUser | null;
  activePath?: string;
  pageTitle?: string;
  onNavigate?: (path: string) => void;
  onLogout?: () => void;
  initialNotifications?: Notification[];
  /** WebSocket/real-time connection status for the status indicator */
  connectionStatus?: ConnectionStatus;
  /** Application version to display next to connection status */
  version?: string;
}

export function DashboardShell({
  children,
  config: configProp = {},
  navItems = [],
  user = null,
  activePath = '/',
  onNavigate,
  onLogout,
  initialNotifications = [],
  connectionStatus = 'disconnected',
  version,
}: DashboardShellProps) {
  const debugNav =
    typeof window !== 'undefined' &&
    (() => {
      try {
        return window.localStorage.getItem('hit_debug_nav') === '1' || new URLSearchParams(window.location.search).has('debugNav');
      } catch {
        return false;
      }
    })();
  const debugIdRef = React.useRef<string>(
    typeof window === 'undefined' ? 'ssr' : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  );

  React.useEffect(() => {
    if (!debugNav) return;
    const id = debugIdRef.current;
    console.log('[DashboardShell] MOUNT', { id, activePath, navItemsCount: Array.isArray(navItems) ? navItems.length : 0 });
    return () => console.log('[DashboardShell] UNMOUNT', { id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!debugNav) return;
    console.log('[DashboardShell] activePath', { id: debugIdRef.current, activePath });
  }, [activePath, debugNav]);

  const config: ShellConfig = {
    brandName: configProp.brandName || 'HIT',
    logoUrl: configProp.logoUrl,
    sidebarPosition: configProp.sidebarPosition || 'left',
    showNotifications: configProp.showNotifications ?? true,
    showThemeToggle: configProp.showThemeToggle ?? false,
    showUserMenu: configProp.showUserMenu ?? true,
    defaultTheme: configProp.defaultTheme || 'system',
  };

  const providerDefaultTheme: 'light' | 'dark' =
    config.defaultTheme === 'light' ? 'light' : config.defaultTheme === 'dark' ? 'dark' : 'dark';

  return (
    <ThemeProvider defaultTheme={providerDefaultTheme}>
      <ShellContent
        config={config}
        navItems={navItems}
        user={user}
        activePath={activePath}
        onNavigate={onNavigate}
        onLogout={onLogout}
        initialNotifications={initialNotifications}
        connectionStatus={connectionStatus}
        version={version}
      >
        {children}
      </ShellContent>
    </ThemeProvider>
  );
}

export default DashboardShell;
