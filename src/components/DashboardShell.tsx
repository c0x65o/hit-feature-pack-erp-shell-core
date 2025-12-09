'use client';

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import {
  Menu,
  X,
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
  const isActive = activePath === item.path;

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
      setMenuOpen(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
          padding: '10px 12px',
          marginLeft: level > 0 ? `${level * 12}px` : '0',
          marginBottom: '2px',
          fontSize: level === 0 ? '14px' : '13px',
          fontWeight: level === 0 ? '500' : '400',
          color: isActive ? '#ffffff' : colors.text.secondary,
          backgroundColor: isActive ? colors.primary.default : 'transparent',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 150ms ease',
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = colors.bg.elevated;
            e.currentTarget.style.color = colors.text.primary;
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = colors.text.secondary;
          }
        }}
      >
        {hasChildren && (
          <span style={{ display: 'flex', marginLeft: '-2px' }}>
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        )}
        {IconComponent && <IconComponent size={18} style={{ flexShrink: 0 }} />}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.label}
        </span>
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);

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
        {/* Sidebar Overlay */}
        {menuOpen && (
          <div
            onClick={() => setMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              zIndex: 40,
            }}
          />
        )}

        {/* Sidebar */}
        <aside
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            height: '100%',
            width: '280px',
            backgroundColor: colors.bg.sidebar,
            borderRight: `1px solid ${colors.border.subtle}`,
            transform: menuOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 300ms ease',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Sidebar Header */}
          <div
            style={{
              height: '64px',
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
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 12px',
            }}
          >
            {navItems.map((item) => (
              <NavItemComponent
                key={item.id}
                item={item}
                activePath={activePath}
                onNavigate={onNavigate}
              />
            ))}
          </nav>

          {/* Sidebar Footer */}
          <div
            style={{
              padding: '16px',
              borderTop: `1px solid ${colors.border.subtle}`,
              flexShrink: 0,
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
            {/* Left side */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
