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
import * as LucideIcons from 'lucide-react';
import { UiKitProvider, ThemeProvider, useThemeTokens, styles } from '@hit/ui-kit';
import { erpKit } from '../kit';
import type { NavItem, ShellUser, Notification, ShellConfig } from '../types';

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
  const isActive = activePath === item.path || (hasChildren && item.children?.some(child => child.path === activePath));

  const iconName = item.icon
    ? item.icon.charAt(0).toUpperCase() + item.icon.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase())
    : '';
  const IconComponent = item.icon
    ? (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>>)[iconName]
    : null;

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

  const hasActiveChild = hasChildren && item.children?.some(child => child.path === activePath);

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
        {IconComponent && <IconComponent size={18} style={{ flexShrink: 0 }} />}
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
}: ShellContentProps) {
  const { colors, radius, textStyles: ts, spacing, shadows } = useThemeTokens();
  const [mounted, setMounted] = useState(false);

  const [menuOpen, setMenuOpenState] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications] = useState<Notification[]>(initialNotifications);
  const [hitConfig, setHitConfig] = useState<any | null>(null);
  const [authConfig, setAuthConfig] = useState<any | null>(null);

  const setMenuOpen = useCallback((open: boolean) => {
    setMenuOpenState(open);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboard-shell-menu-open', String(open));
    }
  }, []);

  useEffect(() => {
    fetch('/hit-config.json')
      .then((res) => res.json())
      .then((data) => setHitConfig(data))
      .catch(() => setHitConfig(null));

    fetch('/api/proxy/auth/config')
      .then((res) => res.json())
      .then((data) => setAuthConfig(data.features || {}))
      .catch(() => setAuthConfig(null));
  }, []);

  // Load persisted state from localStorage on mount
  useEffect(() => {
    setMounted(true);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    }
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

  // Prevent flash of unstyled content during hydration
  if (!mounted) {
    return (
      <div style={{ 
        display: 'flex', 
        height: '100vh', 
        backgroundColor: '#0f0f0f',
        color: '#fff',
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
        {/* Sidebar */}
        <aside style={styles({
          width: showSidebar ? '280px' : '0px',
          minWidth: showSidebar ? '280px' : '0px',
          height: '100%',
          backgroundColor: colors.bg.muted,
          borderRight: showSidebar ? `1px solid ${colors.border.subtle}` : 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          flexShrink: 0,
        })}>
          {/* Sidebar Header */}
          <div style={styles({
            height: '64px',
            minWidth: '280px',
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
                background: `linear-gradient(135deg, ${colors.primary.default}, ${colors.accent.default})`,
                borderRadius: radius.lg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              })}>
                {config.logoUrl ? (
                  <img src={config.logoUrl} alt={config.brandName} style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                ) : (
                  <span style={styles({ color: colors.text.inverse, fontWeight: 700, fontSize: ts.body.fontSize })}>
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
          <nav style={styles({
            flex: 1,
            overflowY: 'auto',
            padding: `${spacing.sm} ${spacing.md}`,
            minWidth: '280px',
          })}>
            {groupNavItems(filterNavByRoles(navItems, user?.roles)).map((group) => (
              <div key={group.group}>
                <NavGroupHeader label={group.label} />
                {group.items.map((item) => (
                  <NavItemComponent
                    key={item.id}
                    item={item}
                    activePath={activePath}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            ))}
          </nav>

          {/* Sidebar Footer */}
          <div style={styles({
            padding: spacing.lg,
            borderTop: `1px solid ${colors.border.subtle}`,
            flexShrink: 0,
            minWidth: '280px',
          })}>
            <div style={styles({ display: 'flex', alignItems: 'center', gap: spacing.sm, fontSize: ts.bodySmall.fontSize, color: colors.text.muted })}>
              <div style={styles({
                width: '8px',
                height: '8px',
                backgroundColor: colors.success.default,
                borderRadius: radius.full,
              })} />
              <span>System Online</span>
            </div>
          </div>
        </aside>

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
              {!showSidebar && (
                <button onClick={() => setMenuOpen(true)} style={iconButtonStyle}>
                  <Menu size={20} />
                </button>
              )}
            </div>

            <div style={styles({ display: 'flex', alignItems: 'center', gap: spacing.sm })}>
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
                    <div style={styles({ textAlign: 'left' })}>
                      <div style={styles({ fontSize: ts.body.fontSize, fontWeight: ts.label.fontWeight, color: colors.text.primary })}>
                        {user?.name || user?.email || 'User'}
                      </div>
                      <div style={styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted })}>
                        {user?.roles?.[0] || 'Member'}
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
                        <div style={styles({ padding: `${spacing.md} ${spacing.lg}`, borderBottom: `1px solid ${colors.border.subtle}` })}>
                          <div style={styles({ fontSize: ts.body.fontSize, fontWeight: ts.label.fontWeight, color: colors.text.primary })}>
                            {user?.name || 'User'}
                          </div>
                          <div style={styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted })}>
                            {user?.email || ''}
                          </div>
                        </div>
                        <div style={styles({ padding: spacing.sm })}>
                          {[{ icon: User, label: 'Profile' }, { icon: Settings, label: 'Settings' }].map((item) => (
                            <button
                              key={item.label}
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
                              <item.icon size={16} style={{ color: colors.text.muted }} />
                              {item.label}
                            </button>
                          ))}
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
              <UiKitProvider kit={erpKit}>{children}</UiKitProvider>
            </div>
          </main>
        </div>
      </div>
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
}: DashboardShellProps) {
  const config: ShellConfig = {
    brandName: configProp.brandName || 'HIT',
    logoUrl: configProp.logoUrl,
    sidebarPosition: configProp.sidebarPosition || 'left',
    showNotifications: configProp.showNotifications ?? true,
    showThemeToggle: configProp.showThemeToggle ?? false,
    showUserMenu: configProp.showUserMenu ?? true,
    defaultTheme: 'dark',
  };

  return (
    <ThemeProvider defaultTheme="dark">
      <ShellContent
        config={config}
        navItems={navItems}
        user={user}
        activePath={activePath}
        onNavigate={onNavigate}
        onLogout={onLogout}
        initialNotifications={initialNotifications}
      >
        {children}
      </ShellContent>
    </ThemeProvider>
  );
}

export default DashboardShell;
