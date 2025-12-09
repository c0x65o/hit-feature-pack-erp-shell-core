'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { Menu, Bell, User, Settings, LogOut, ChevronRight, ChevronDown, } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { UiKitProvider, ThemeProvider, useThemeTokens, styles } from '@hit/ui-kit';
import { erpKit } from '../kit';
const ShellContext = createContext(null);
export function useShell() {
    const context = useContext(ShellContext);
    if (!context)
        throw new Error('useShell must be used within DashboardShell');
    return context;
}
// =============================================================================
// NAV GROUP HELPERS
// =============================================================================
const groupConfig = {
    main: { label: 'MAIN', order: 1 },
    system: { label: 'SYSTEM', order: 2 },
};
function groupNavItems(items) {
    const groups = {};
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
// FEATURE FLAG HELPERS
// =============================================================================
function isFlagEnabled(flag, cfg, authFeatures) {
    if (!flag)
        return true;
    if (authFeatures) {
        const authLookup = {
            'auth.allowSignup': 'allow_signup',
            'auth.allow_signup': 'allow_signup',
            'auth.emailVerification': 'email_verification',
            'auth.email_verification': 'email_verification',
            'auth.passwordLogin': 'password_login',
            'auth.password_login': 'password_login',
            'auth.passwordReset': 'password_reset',
            'auth.password_reset': 'password_reset',
            'auth.magicLinkLogin': 'magic_link_login',
            'auth.magic_link_login': 'magic_link_login',
            'auth.twoFactorAuth': 'two_factor_auth',
            'auth.two_factor_auth': 'two_factor_auth',
            'auth.auditLog': 'audit_log',
            'auth.audit_log': 'audit_log',
        };
        const authKey = authLookup[flag];
        if (authKey && authFeatures[authKey] !== undefined) {
            return authFeatures[authKey] !== false;
        }
    }
    const auth = cfg?.auth || {};
    const admin = cfg?.admin || {};
    const lookup = {
        'auth.allowSignup': auth.allowSignup,
        'auth.emailVerification': auth.emailVerification,
        'auth.passwordLogin': auth.passwordLogin,
        'auth.passwordReset': auth.passwordReset,
        'auth.magicLinkLogin': auth.magicLinkLogin,
        'auth.twoFactorAuth': auth.twoFactorAuth,
        'auth.auditLog': auth.auditLog,
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
function filterNavByFlags(items, cfg, authFeatures) {
    return items
        .filter((item) => isFlagEnabled(item.featureFlag, cfg, authFeatures))
        .map((item) => {
        if (!item.children) {
            return item;
        }
        const children = filterNavByFlags(item.children, cfg, authFeatures);
        return {
            ...item,
            children: children.length > 0 ? children : undefined,
        };
    });
}
function NavItemComponent({ item, level = 0, activePath, onNavigate }) {
    const { expandedNodes, toggleNode } = useShell();
    const { colors, radius, textStyles: ts, spacing } = useThemeTokens();
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedNodes.has(item.id);
    const isActive = activePath === item.path || (hasChildren && item.children?.some(child => child.path === activePath));
    const iconName = item.icon
        ? item.icon.charAt(0).toUpperCase() + item.icon.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase())
        : '';
    const IconComponent = item.icon
        ? LucideIcons[iconName]
        : null;
    const handleClick = () => {
        if (hasChildren) {
            toggleNode(item.id);
        }
        else if (item.path) {
            if (onNavigate) {
                onNavigate(item.path);
            }
            else if (typeof window !== 'undefined') {
                window.location.href = item.path;
            }
        }
    };
    const hasActiveChild = hasChildren && item.children?.some(child => child.path === activePath);
    return (_jsxs("div", { children: [_jsxs("button", { onClick: handleClick, style: styles({
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
                }), children: [IconComponent && _jsx(IconComponent, { size: 18, style: { flexShrink: 0 } }), _jsx("span", { style: styles({ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }), children: item.label }), item.badge !== undefined && (_jsx("span", { style: styles({
                            backgroundColor: colors.error.default,
                            color: colors.text.inverse,
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: radius.full,
                            minWidth: '20px',
                            textAlign: 'center',
                        }), children: item.badge })), hasChildren && (_jsx("span", { style: styles({ display: 'flex', marginRight: '-4px' }), children: isExpanded ? _jsx(ChevronDown, { size: 16 }) : _jsx(ChevronRight, { size: 16 }) }))] }), hasChildren && isExpanded && (_jsx("div", { style: styles({ marginTop: spacing.px }), children: item.children.map((child, idx) => (_jsx(NavItemComponent, { item: { ...child, id: `${item.id}-${idx}` }, level: level + 1, activePath: activePath, onNavigate: onNavigate }, `${item.id}-${idx}`))) }))] }));
}
// =============================================================================
// NAV GROUP HEADER COMPONENT
// =============================================================================
function NavGroupHeader({ label }) {
    const { colors, textStyles: ts, spacing } = useThemeTokens();
    return (_jsx("div", { style: styles({
            padding: `${spacing.lg} ${spacing.md} ${spacing.sm}`,
            fontSize: '11px',
            fontWeight: 600,
            color: colors.text.muted,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
        }), children: label }));
}
function ShellContent({ children, config, navItems, user, activePath, onNavigate, onLogout, initialNotifications, }) {
    const { colors, radius, textStyles: ts, spacing, shadows } = useThemeTokens();
    const [mounted, setMounted] = useState(false);
    const [menuOpen, setMenuOpenState] = useState(true);
    const [expandedNodes, setExpandedNodes] = useState(new Set());
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications] = useState(initialNotifications);
    const [hitConfig, setHitConfig] = useState(null);
    const [authConfig, setAuthConfig] = useState(null);
    const setMenuOpen = useCallback((open) => {
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
            // Restore expanded nodes
            const savedNodes = localStorage.getItem('dashboard-shell-expanded-nodes');
            if (savedNodes) {
                try {
                    setExpandedNodes(new Set(JSON.parse(savedNodes)));
                }
                catch {
                    // Invalid JSON, ignore
                }
            }
        }
    }, []);
    const toggleNode = useCallback((nodeId) => {
        setExpandedNodes((prev) => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            }
            else {
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
    const contextValue = {
        menuOpen,
        setMenuOpen,
        expandedNodes,
        toggleNode,
    };
    const iconButtonStyle = {
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
        return (_jsx("div", { style: {
                display: 'flex',
                height: '100vh',
                backgroundColor: '#0f0f0f',
                color: '#fff',
            } }));
    }
    return (_jsx(ShellContext.Provider, { value: contextValue, children: _jsxs("div", { style: styles({
                display: 'flex',
                height: '100vh',
                backgroundColor: colors.bg.page,
                color: colors.text.primary,
            }), children: [_jsxs("aside", { style: styles({
                        width: showSidebar ? '280px' : '0px',
                        minWidth: showSidebar ? '280px' : '0px',
                        height: '100%',
                        backgroundColor: colors.bg.muted,
                        borderRight: showSidebar ? `1px solid ${colors.border.subtle}` : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        flexShrink: 0,
                    }), children: [_jsxs("div", { style: styles({
                                height: '64px',
                                minWidth: '280px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: `0 ${spacing.lg}`,
                                borderBottom: `1px solid ${colors.border.subtle}`,
                                flexShrink: 0,
                            }), children: [_jsxs("div", { style: styles({ display: 'flex', alignItems: 'center', gap: spacing.sm }), children: [_jsx("div", { style: styles({
                                                width: '32px',
                                                height: '32px',
                                                background: `linear-gradient(135deg, ${colors.primary.default}, ${colors.accent.default})`,
                                                borderRadius: radius.lg,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                overflow: 'hidden',
                                            }), children: config.logoUrl ? (_jsx("img", { src: config.logoUrl, alt: config.brandName, style: { width: '20px', height: '20px', objectFit: 'contain' } })) : (_jsx("span", { style: styles({ color: colors.text.inverse, fontWeight: 700, fontSize: ts.body.fontSize }), children: config.brandName.charAt(0) })) }), _jsx("span", { style: styles({ fontSize: ts.heading3.fontSize, fontWeight: ts.heading3.fontWeight, color: colors.text.primary }), children: config.brandName })] }), _jsx("button", { onClick: () => setMenuOpen(false), style: { ...iconButtonStyle, width: '36px', height: '36px' }, children: _jsx(Menu, { size: 20 }) })] }), _jsx("nav", { style: styles({
                                flex: 1,
                                overflowY: 'auto',
                                padding: `${spacing.sm} ${spacing.md}`,
                                minWidth: '280px',
                            }), children: groupNavItems(filterNavByFlags(navItems, hitConfig, authConfig)).map((group) => (_jsxs("div", { children: [_jsx(NavGroupHeader, { label: group.label }), group.items.map((item) => (_jsx(NavItemComponent, { item: item, activePath: activePath, onNavigate: onNavigate }, item.id)))] }, group.group))) }), _jsx("div", { style: styles({
                                padding: spacing.lg,
                                borderTop: `1px solid ${colors.border.subtle}`,
                                flexShrink: 0,
                                minWidth: '280px',
                            }), children: _jsxs("div", { style: styles({ display: 'flex', alignItems: 'center', gap: spacing.sm, fontSize: ts.bodySmall.fontSize, color: colors.text.muted }), children: [_jsx("div", { style: styles({
                                            width: '8px',
                                            height: '8px',
                                            backgroundColor: colors.success.default,
                                            borderRadius: radius.full,
                                        }) }), _jsx("span", { children: "System Online" })] }) })] }), _jsxs("div", { style: styles({ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }), children: [_jsxs("header", { style: styles({
                                height: '64px',
                                backgroundColor: colors.bg.surface,
                                borderBottom: `1px solid ${colors.border.subtle}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: `0 ${spacing['2xl']}`,
                                flexShrink: 0,
                            }), children: [_jsx("div", { style: styles({ display: 'flex', alignItems: 'center', gap: spacing.lg }), children: !showSidebar && (_jsx("button", { onClick: () => setMenuOpen(true), style: iconButtonStyle, children: _jsx(Menu, { size: 20 }) })) }), _jsxs("div", { style: styles({ display: 'flex', alignItems: 'center', gap: spacing.sm }), children: [config.showNotifications && (_jsx("div", { style: { position: 'relative' }, children: _jsxs("button", { onClick: () => { setShowNotifications(!showNotifications); setShowProfileMenu(false); }, style: iconButtonStyle, children: [_jsx(Bell, { size: 20 }), unreadCount > 0 && (_jsx("span", { style: styles({
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
                                                        }), children: unreadCount > 9 ? '9+' : unreadCount }))] }) })), config.showUserMenu && (_jsxs("div", { style: { position: 'relative' }, children: [_jsxs("button", { onClick: () => { setShowProfileMenu(!showProfileMenu); setShowNotifications(false); }, style: styles({
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: spacing.md,
                                                        padding: `${spacing.xs} ${spacing.md} ${spacing.xs} ${spacing.xs}`,
                                                        background: 'none',
                                                        border: 'none',
                                                        borderRadius: radius.lg,
                                                        cursor: 'pointer',
                                                    }), children: [_jsx("div", { style: styles({
                                                                width: '36px',
                                                                height: '36px',
                                                                background: `linear-gradient(135deg, ${colors.primary.default}, ${colors.accent.default})`,
                                                                borderRadius: radius.full,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                            }), children: _jsx(User, { size: 18, style: { color: colors.text.inverse } }) }), _jsxs("div", { style: styles({ textAlign: 'left' }), children: [_jsx("div", { style: styles({ fontSize: ts.body.fontSize, fontWeight: ts.label.fontWeight, color: colors.text.primary }), children: user?.name || user?.email || 'User' }), _jsx("div", { style: styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted }), children: user?.roles?.[0] || 'Member' })] })] }), showProfileMenu && (_jsxs(_Fragment, { children: [_jsx("div", { onClick: () => setShowProfileMenu(false), style: styles({ position: 'fixed', inset: 0, zIndex: 40 }) }), _jsxs("div", { style: styles({
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
                                                            }), children: [_jsxs("div", { style: styles({ padding: `${spacing.md} ${spacing.lg}`, borderBottom: `1px solid ${colors.border.subtle}` }), children: [_jsx("div", { style: styles({ fontSize: ts.body.fontSize, fontWeight: ts.label.fontWeight, color: colors.text.primary }), children: user?.name || 'User' }), _jsx("div", { style: styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted }), children: user?.email || '' })] }), _jsx("div", { style: styles({ padding: spacing.sm }), children: [{ icon: User, label: 'Profile' }, { icon: Settings, label: 'Settings' }].map((item) => (_jsxs("button", { style: styles({
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
                                                                        }), children: [_jsx(item.icon, { size: 16, style: { color: colors.text.muted } }), item.label] }, item.label))) }), _jsx("div", { style: styles({ padding: spacing.sm, borderTop: `1px solid ${colors.border.subtle}` }), children: _jsxs("button", { onClick: () => { setShowProfileMenu(false); onLogout?.(); }, style: styles({
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
                                                                        }), children: [_jsx(LogOut, { size: 16 }), "Sign Out"] }) })] })] }))] }))] })] }), _jsx("main", { style: styles({
                                flex: 1,
                                overflow: 'auto',
                                padding: spacing['2xl'],
                                backgroundColor: colors.bg.page,
                            }), onClick: () => { setShowNotifications(false); setShowProfileMenu(false); }, children: _jsx("div", { style: styles({ maxWidth: '1280px', margin: '0 auto' }), children: _jsx(UiKitProvider, { kit: erpKit, children: children }) }) })] })] }) }));
}
export function DashboardShell({ children, config: configProp = {}, navItems = [], user = null, activePath = '/', onNavigate, onLogout, initialNotifications = [], }) {
    const config = {
        brandName: configProp.brandName || 'HIT',
        logoUrl: configProp.logoUrl,
        sidebarPosition: configProp.sidebarPosition || 'left',
        showNotifications: configProp.showNotifications ?? true,
        showThemeToggle: configProp.showThemeToggle ?? false,
        showUserMenu: configProp.showUserMenu ?? true,
        defaultTheme: 'dark',
    };
    return (_jsx(ThemeProvider, { defaultTheme: "dark", children: _jsx(ShellContent, { config: config, navItems: navItems, user: user, activePath: activePath, onNavigate: onNavigate, onLogout: onLogout, initialNotifications: initialNotifications, children: children }) }));
}
export default DashboardShell;
