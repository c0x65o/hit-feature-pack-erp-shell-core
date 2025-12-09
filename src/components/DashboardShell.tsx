'use client';

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import {
  Menu,
  Bell,
  Sun,
  Moon,
  User,
  Settings,
  LogOut,
  ChevronRight,
  ChevronDown,
  Check,
  Trash2,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { UiKitProvider } from '@hit/ui-kit';
import { erpKit } from '../kit';
import type { NavItem, ShellUser, Notification, ShellConfig } from '../types';

// =============================================================================
// DESIGN SYSTEM (matches kit.ts exactly)
// =============================================================================

const colors = {
  bg: {
    page: '#0a0a0f',
    surface: '#12121a',
    elevated: '#1a1a24',
    sidebar: '#0d0d12',
  },
  border: {
    subtle: '#1f1f2e',
    default: '#2a2a3d',
  },
  text: {
    primary: '#f4f4f5',
    secondary: '#a1a1aa',
    muted: '#71717a',
  },
  primary: {
    default: '#3b82f6',
    hover: '#2563eb',
  },
  error: {
    default: '#ef4444',
  },
};

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

/** Group configuration with display labels */
const groupConfig: Record<string, { label: string; order: number }> = {
  main: { label: 'MAIN', order: 1 },
  system: { label: 'SYSTEM', order: 2 },
};

/** Group nav items by their group property, sorted by weight within each group */
function groupNavItems(items: NavItem[]): { group: string; label: string; items: NavItem[] }[] {
  const groups: Record<string, NavItem[]> = {};

  // Group items
  items.forEach((item) => {
    const group = item.group || 'main'; // Default to 'main' if no group specified
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(item);
  });

  // Sort items within each group by weight
  Object.keys(groups).forEach((group) => {
    groups[group].sort((a, b) => (a.weight ?? 500) - (b.weight ?? 500));
  });

  // Convert to array and sort groups by their configured order
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
// FEATURE FLAG HELPERS
// =============================================================================

function isFlagEnabled(flag?: string, cfg?: any): boolean {
  if (!flag) return true;
  const auth = cfg?.auth || {};
  const admin = cfg?.admin || {};
  const lookup: Record<string, boolean | undefined> = {
    'auth.allowSignup': auth.allowSignup,
    'auth.emailVerification': auth.emailVerification,
    'auth.passwordLogin': auth.passwordLogin,
    'auth.magicLinkLogin': auth.magicLinkLogin,
    'auth.twoFactorAuth': auth.twoFactorAuth,
    'auth.show2faSetup': auth.show2faSetup,
    'auth.showSocialLogin': auth.showSocialLogin,
    'admin.showDashboard': admin.showDashboard,
    'admin.showUsers': admin.showUsers,
    'admin.showSessions': admin.showSessions,
    'admin.showAuditLog': admin.showAuditLog,
    'admin.showInvites': admin.showInvites,
    'admin.showPermissions': admin.showPermissions,
    'admin.showSettings': admin.showSettings,
  };
  const value = lookup[flag];
  return value !== undefined ? value : true;
}

function filterNavByFlags(items: NavItem[], cfg?: any): NavItem[] {
  return items
    .filter((item) => isFlagEnabled(item.featureFlag, cfg))
    .map((item) => {
      if (!item.children) {
        return item;
      }
      const children = filterNavByFlags(item.children as NavItem[], cfg);
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
  const { expandedNodes, toggleNode, setMenuOpen } = useShell();
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedNodes.has(item.id);
  const isActive = activePath === item.path || (hasChildren && item.children?.some(child => child.path === activePath));

  // Get icon component
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
      // Menu stays open - don't auto-close on navigation
    }
  };

  // Check if any child is active (for highlighting parent)
  const hasActiveChild = hasChildren && item.children?.some(child => child.path === activePath);

  return (
    <div>
      <button
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: level > 0 ? `calc(100% - ${level * 12}px)` : '100%',
          padding: level > 0 ? '8px 12px 8px 36px' : '10px 12px',
          marginLeft: level > 0 ? `${level * 12}px` : '0',
          marginBottom: '2px',
          fontSize: level === 0 ? '14px' : '13px',
          fontWeight: level === 0 ? '500' : '400',
          color: (isActive && !hasChildren) ? '#ffffff' : hasActiveChild ? colors.text.primary : colors.text.secondary,
          backgroundColor: (isActive && !hasChildren) ? colors.primary.default : 'transparent',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 150ms ease',
        }}
        onMouseEnter={(e) => {
          if (!(isActive && !hasChildren)) {
            e.currentTarget.style.backgroundColor = colors.bg.elevated;
            e.currentTarget.style.color = colors.text.primary;
          }
        }}
        onMouseLeave={(e) => {
          if (!(isActive && !hasChildren)) {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = hasActiveChild ? colors.text.primary : colors.text.secondary;
          }
        }}
      >
        {IconComponent && <IconComponent size={18} style={{ flexShrink: 0 }} />}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.label}
        </span>
        {/* Badge */}
        {item.badge !== undefined && (
          <span
            style={{
              backgroundColor: '#ef4444',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: '10px',
              minWidth: '20px',
              textAlign: 'center',
            }}
          >
            {item.badge}
          </span>
        )}
        {hasChildren && (
          <span style={{ display: 'flex', marginRight: '-4px' }}>
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        )}
      </button>
      {hasChildren && isExpanded && (
        <div style={{ marginTop: '2px' }}>
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
  return (
    <div
      style={{
        padding: '16px 12px 8px',
        fontSize: '11px',
        fontWeight: 600,
        color: colors.text.muted,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </div>
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

// Module-level cache to persist state across client-side navigations
// This is populated AFTER first hydration, so subsequent navigations are instant
let menuStateCache: { loaded: boolean; open: boolean } = { loaded: false, open: true };
let hitConfigCache: any | null = null;

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
  // Use cached value if available (for client-side navigation), otherwise default to true
  // This ensures server and initial client render match (both true)
  const [menuOpen, setMenuOpenState] = useState(() => menuStateCache.loaded ? menuStateCache.open : true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [hitConfig, setHitConfig] = useState<any | null>(hitConfigCache);

  // Wrapper to update both state and cache
  const setMenuOpen = useCallback((open: boolean) => {
    menuStateCache = { loaded: true, open };
    setMenuOpenState(open);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboard-shell-menu-open', String(open));
    }
  }, []);

  // On first mount, load from localStorage and update cache
  useEffect(() => {
    // Only load from localStorage if we haven't cached yet
    if (!menuStateCache.loaded) {
      const saved = localStorage.getItem('dashboard-shell-menu-open');
      const savedValue = saved !== 'false'; // default to true
      menuStateCache = { loaded: true, open: savedValue };
      // Only update state if different from default
      if (!savedValue) {
        setMenuOpenState(false);
      }
    }

    // Load hit-config.json once
    if (!hitConfigCache) {
      fetch('/hit-config.json')
        .then((res) => res.json())
        .then((data) => {
          hitConfigCache = data;
          setHitConfig(data);
        })
        .catch(() => setHitConfig(null));
    }
  }, []);

  const config: ShellConfig = {
    brandName: configProp.brandName || 'HIT',
    logoUrl: configProp.logoUrl,
    sidebarPosition: configProp.sidebarPosition || 'left',
    showNotifications: configProp.showNotifications ?? true,
    showThemeToggle: configProp.showThemeToggle ?? false, // Disabled for now - dark only
    showUserMenu: configProp.showUserMenu ?? true,
    defaultTheme: 'dark',
  };

  // Set data-theme on document for CSS variable theming
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
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

  // Icon button style helper
  const iconButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    background: 'none',
    border: 'none',
    borderRadius: '8px',
    color: colors.text.secondary,
    cursor: 'pointer',
    transition: 'all 150ms ease',
  };

  // Use menu state directly (cached across navigations)
  const showSidebar = menuOpen;

  return (
    <ShellContext.Provider value={contextValue}>
      <div
        style={{
          display: 'flex',
          height: '100vh',
          backgroundColor: colors.bg.page,
          color: colors.text.primary,
        }}
      >
        {/* Sidebar - pushes content over when open */}
        <aside
          style={{
            width: showSidebar ? '280px' : '0px',
            minWidth: showSidebar ? '280px' : '0px',
            height: '100%',
            backgroundColor: colors.bg.sidebar,
            borderRight: showSidebar ? `1px solid ${colors.border.subtle}` : 'none',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {/* Sidebar Header */}
          <div
            style={{
              height: '64px',
              minWidth: '280px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              borderBottom: `1px solid ${colors.border.subtle}`,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {config.logoUrl ? (
                  <img
                    src={config.logoUrl}
                    alt={config.brandName}
                    style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                  />
                ) : (
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>
                    {config.brandName.charAt(0)}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '16px', fontWeight: 600, color: colors.text.primary }}>
                {config.brandName}
              </span>
            </div>
            <button
              onClick={() => setMenuOpen(false)}
              style={{
                ...iconButtonStyle,
                width: '36px',
                height: '36px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.bg.elevated;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Menu size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px 12px',
              minWidth: '280px',
            }}
          >
            {groupNavItems(filterNavByFlags(navItems, hitConfig)).map((group) => (
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
          <div
            style={{
              padding: '16px',
              borderTop: `1px solid ${colors.border.subtle}`,
              flexShrink: 0,
              minWidth: '280px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: colors.text.muted }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#22c55e',
                  borderRadius: '50%',
                }}
              />
              <span>System Online</span>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Top Bar */}
          <header
            style={{
              height: '64px',
              backgroundColor: colors.bg.surface,
              borderBottom: `1px solid ${colors.border.subtle}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 24px',
              flexShrink: 0,
            }}
          >
            {/* Left side - only show hamburger when sidebar is closed */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {!showSidebar && (
                <button
                  onClick={() => setMenuOpen(true)}
                  style={iconButtonStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.bg.elevated;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Menu size={20} />
                </button>
              )}
            </div>

            {/* Right side */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Notifications */}
              {config.showNotifications && (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => {
                      setShowNotifications(!showNotifications);
                      setShowProfileMenu(false);
                    }}
                    style={iconButtonStyle}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colors.bg.elevated;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Bell size={20} />
                    {unreadCount > 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          width: '18px',
                          height: '18px',
                          backgroundColor: colors.error.default,
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notification dropdown would go here */}
                </div>
              )}

              {/* User Menu */}
              {config.showUserMenu && (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => {
                      setShowProfileMenu(!showProfileMenu);
                      setShowNotifications(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '6px 12px 6px 6px',
                      background: 'none',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colors.bg.elevated;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <User size={18} style={{ color: '#fff' }} />
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: colors.text.primary }}>
                        {user?.name || user?.email || 'User'}
                      </div>
                      <div style={{ fontSize: '12px', color: colors.text.muted }}>
                        {user?.roles?.[0] || 'Member'}
                      </div>
                    </div>
                  </button>

                  {/* Profile Dropdown */}
                  {showProfileMenu && (
                    <>
                      <div
                        onClick={() => setShowProfileMenu(false)}
                        style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: '100%',
                          marginTop: '8px',
                          width: '220px',
                          backgroundColor: colors.bg.surface,
                          border: `1px solid ${colors.border.default}`,
                          borderRadius: '8px',
                          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
                          zIndex: 50,
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${colors.border.subtle}` }}>
                          <div style={{ fontSize: '14px', fontWeight: 500, color: colors.text.primary }}>
                            {user?.name || 'User'}
                          </div>
                          <div style={{ fontSize: '13px', color: colors.text.muted }}>
                            {user?.email || ''}
                          </div>
                        </div>
                        <div style={{ padding: '8px' }}>
                          {[
                            { icon: User, label: 'Profile' },
                            { icon: Settings, label: 'Settings' },
                          ].map((item) => (
                            <button
                              key={item.label}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                width: '100%',
                                padding: '10px 12px',
                                background: 'none',
                                border: 'none',
                                borderRadius: '6px',
                                color: colors.text.primary,
                                fontSize: '14px',
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = colors.bg.elevated;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <item.icon size={16} style={{ color: colors.text.muted }} />
                              {item.label}
                            </button>
                          ))}
                        </div>
                        <div style={{ padding: '8px', borderTop: `1px solid ${colors.border.subtle}` }}>
                          <button
                            onClick={() => {
                              setShowProfileMenu(false);
                              onLogout?.();
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              width: '100%',
                              padding: '10px 12px',
                              background: 'none',
                              border: 'none',
                              borderRadius: '6px',
                              color: colors.error.default,
                              fontSize: '14px',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
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
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '24px',
              backgroundColor: colors.bg.page,
            }}
            onClick={() => {
              setShowNotifications(false);
              setShowProfileMenu(false);
            }}
          >
            <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
              <UiKitProvider kit={erpKit}>{children}</UiKitProvider>
            </div>
          </main>
        </div>
      </div>
    </ShellContext.Provider>
  );
}

export default DashboardShell;
