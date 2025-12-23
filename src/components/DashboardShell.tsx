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
import { Monitor, Moon, Sun, X } from 'lucide-react';
import { UiKitProvider, ThemeProvider, useThemeTokens, useTheme, styles, defaultKit } from '@hit/ui-kit';
import type { NavItem, ShellUser, Notification, ShellConfig, ConnectionStatus } from '../types';
import { LucideIcon } from '../utils/lucide-dynamic';

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

const THEME_STORAGE_KEY = 'dashboard-shell-theme';
const THEME_COOKIE_KEY = 'dashboard-shell-theme';
const TOKEN_COOKIE_KEY = 'hit_token';

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

  items.forEach((item) => {
    const group = item.group || 'main';
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(item);
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

function navHasActiveDescendant(item: NavItem, activePath: string): boolean {
  const children = item.children as unknown as NavItem[] | undefined;
  if (!children || children.length === 0) return false;
  for (const child of children) {
    if (child.path === activePath) return true;
    if (navHasActiveDescendant(child, activePath)) return true;
  }
  return false;
}

function filterNavByRoles(
  items: NavItem[], 
  userRoles?: string[]
): NavItem[] {
  // Feature flags are now filtered at generation time, so we only need to filter by roles
  return items
    .filter((item) => {
      // Check role-based access
      if (item.roles && item.roles.length > 0) {
        // If item requires specific roles, user must have at least one
        if (!userRoles || userRoles.length === 0) {
          return false;
        }
        const hasRequiredRole = item.roles.some(role => userRoles.includes(role));
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
  const isActive = activePath === item.path || (hasChildren && hasActiveDescendant);

  const iconName = item.icon ? String(item.icon) : '';

  const handleClick = () => {
    if (hasChildren) {
      toggleNode(item.id);
    } else if (item.path) {
      if (onNavigate) {
        onNavigate(item.path);
      } else if (typeof window !== 'undefined') {
        window.location.href = item.path;
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
  const isActive = activePath === item.path || (hasChildren && hasActiveDescendant);
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
      } else if (typeof window !== 'undefined') {
        window.location.href = item.path;
      }
    }
  };

  const handleChildClick = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else if (typeof window !== 'undefined') {
      window.location.href = path;
    }
  };

  const renderFlyoutItems = (nodes: Omit<NavItem, 'id'>[], depth: number = 0): React.ReactNode => {
    return nodes.map((node, idx) => {
      const child = node as NavItem;
      const childIconName = child.icon ? String(child.icon) : '';
      const childIsActive = activePath === child.path || navHasActiveDescendant(child, activePath);
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
  const [notifications] = useState<Notification[]>(initialNotifications);
  
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

  const setMenuOpen = useCallback((open: boolean) => {
    setMenuOpenState(open);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboard-shell-menu-open', String(open));
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
    const defaultPref = (hitConfig?.dashboardShell?.defaultTheme as ThemePreference | undefined) || config.defaultTheme || 'dark';
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
    setCurrentUser(user || null);
    // Note: name is no longer stored - email is used as the identifier
    setProfileLoaded(false);
    setProfileMetadata({});
    setProfileStatus((prev) => ({ ...prev, error: null, success: null }));
  }, [user]);

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
      const savedMenuOpen = localStorage.getItem('dashboard-shell-menu-open');
      if (savedMenuOpen !== null) {
        setMenuOpenState(savedMenuOpen !== 'false');
      }
      // Restore expanded nodes (but start collapsed by default - only restore if user explicitly expanded something)
      const savedNodes = localStorage.getItem('dashboard-shell-expanded-nodes');
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
      const savedScroll = sessionStorage.getItem('dashboard-shell-nav-scroll');
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
      sessionStorage.setItem('dashboard-shell-nav-scroll', String(e.currentTarget.scrollTop));
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
        localStorage.setItem('dashboard-shell-expanded-nodes', JSON.stringify([...next]));
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
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!currentUser?.email) return;
    setProfileStatus((prev) => ({ ...prev, error: null, success: null }));
    try {
      const token = getStoredToken();
      if (!token) {
        throw new Error('You must be signed in to update your profile.');
      }
      
      // Fetch user profile data using /me endpoint
      const response = await fetch(`/api/proxy/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || data?.error || 'Unable to load profile');
      }
      setProfileMetadata(data.metadata || {});
      setProfileFields(data.profile_fields || {});
      
      // Fetch profile field metadata (including email)
      try {
        const fieldsResponse = await fetch(`/api/proxy/auth/me/profile-fields`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (fieldsResponse.ok) {
          const fieldsData = await fieldsResponse.json().catch(() => []);
          setProfileFieldMetadata(fieldsData || []);
        }
      } catch (fieldsError) {
        // Silently fail if profile fields feature is not enabled
        console.debug('Profile fields not available:', fieldsError);
      }
      
      setProfileLoaded(true);
    } catch (error) {
      setProfileStatus((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load profile',
        success: null,
      }));
    }
  }, [currentUser?.email]);

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
  ]);

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

  // Get all nav items for collapsed rail
  const filteredNavItems = filterNavByRoles(navItems, currentUser?.roles);
  const groupedNavItems = groupNavItems(filteredNavItems);
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
          })}>
            {/* Sidebar Header */}
            <div style={styles({
              height: '64px',
              minWidth: EXPANDED_SIDEBAR_WIDTH,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `0 ${spacing.lg}`,
              borderBottom: `1px solid ${colors.border.subtle}`,
              flexShrink: 0,
            })}>
              <div style={styles({ display: 'flex', alignItems: 'center', gap: spacing.sm })}>
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
              <button onClick={() => setMenuOpen(false)} style={{ ...iconButtonStyle, width: '36px', height: '36px' }}>
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
                    onClick={() => { setShowNotifications(!showNotifications); setShowProfileMenu(false); }}
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
                        alt={currentUser?.email || 'User'}
                        style={styles({
                          width: '36px',
                          height: '36px',
                          borderRadius: radius.full,
                          objectFit: 'cover',
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
                      })}>
                        <User size={18} style={{ color: colors.text.inverse }} />
                      </div>
                    )}
                    <div style={styles({ textAlign: 'left' })}>
                      <div style={styles({ fontSize: ts.body.fontSize, fontWeight: ts.label.fontWeight, color: colors.text.primary })}>
                        {currentUser?.email || 'User'}
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
                              alt={currentUser?.email || 'User'}
                              style={styles({
                                width: '40px',
                                height: '40px',
                                borderRadius: radius.full,
                                objectFit: 'cover',
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
                            })}>
                              <User size={20} style={{ color: colors.text.inverse }} />
                            </div>
                          )}
                          <div style={styles({ flex: 1, minWidth: 0 })}>
                            <div style={styles({ fontSize: ts.body.fontSize, fontWeight: ts.label.fontWeight, color: colors.text.primary })}>
                              {currentUser?.email || 'User'}
                            </div>
                            <div style={styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted })}>
                              {currentUser?.roles?.[0] || 'Member'}
                            </div>
                          </div>
                        </div>
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
              <UiKitProvider kit={defaultKit}>{children as any}</UiKitProvider>
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
                {/* Profile Fields - Integrated (including email) */}
                {profileFieldMetadata
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((fieldMeta) => {
                    const isAdmin = currentUser?.roles?.includes('admin') || false;
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
