'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { Menu, Bell, User, Settings, LogOut, ChevronRight, ChevronDown, } from 'lucide-react';
import { Monitor, Moon, Sun, X, RotateCw, Camera, Trash2 } from 'lucide-react';
import { ThemeProvider, useThemeTokens, useTheme } from '@hit/ui-kit/theme';
import { styles } from '@hit/ui-kit/components/utils';
import { clearUserAvatarCache } from '@hit/ui-kit/components/UserAvatar';
import { LucideIcon } from '../utils/lucide-dynamic';
import { ProfilePictureCropModal } from '@hit/feature-pack-auth-core';
const ShellContext = createContext(null);
export function useShell() {
    const context = useContext(ShellContext);
    if (!context)
        throw new Error('useShell must be used within DashboardShell');
    return context;
}
// Storage keys for persisting user preferences and UI state
const THEME_STORAGE_KEY = 'erp-shell-core-theme';
const THEME_COOKIE_KEY = 'erp-shell-core-theme';
const TOKEN_COOKIE_KEY = 'hit_token';
const ORIGINAL_TOKEN_STORAGE_KEY = 'hit_token_original';
const LAST_IMPERSONATED_EMAIL_KEY = 'hit_last_impersonated_email';
const MENU_OPEN_KEY = 'erp-shell-core-menu-open';
const EXPANDED_NODES_KEY = 'erp-shell-core-expanded-nodes';
const NAV_SCROLL_KEY = 'erp-shell-core-nav-scroll';
function getCookieValue(name) {
    if (typeof document === 'undefined')
        return null;
    const match = document.cookie.split(';').map((c) => c.trim()).find((cookie) => cookie.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
}
function getStoredToken() {
    const cookieToken = getCookieValue(TOKEN_COOKIE_KEY);
    if (cookieToken)
        return cookieToken;
    if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(TOKEN_COOKIE_KEY);
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
function setAuthToken(token) {
    if (typeof window === 'undefined')
        return;
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
function getSavedThemePreference() {
    if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
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
function resolveTheme(preference) {
    if (preference === 'system') {
        if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }
    return preference;
}
function toInitials(input) {
    const s = String(input || '').trim();
    if (!s)
        return '?';
    // Split on spaces and common separators, keep first 2 initials.
    const parts = s
        .replace(/[._-]/g, ' ')
        .split(' ')
        .map((x) => x.trim())
        .filter(Boolean);
    const initials = parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase();
    return initials || '?';
}
function employeeDisplayName(employee) {
    const preferred = String(employee?.preferredName || employee?.preferred_name || '').trim();
    if (preferred)
        return preferred;
    const first = String(employee?.firstName || employee?.first_name || '').trim();
    const last = String(employee?.lastName || employee?.last_name || '').trim();
    return [first, last].filter(Boolean).join(' ').trim();
}
function applyThemeToDocument(theme) {
    if (typeof document === 'undefined')
        return;
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (theme === 'dark') {
        root.classList.add('dark');
    }
    else {
        root.classList.remove('dark');
    }
}
function persistThemePreference(preference) {
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
const groupConfig = {
    main: { label: 'MAIN', order: 1 },
    system: { label: 'SYSTEM', order: 2 },
};
function groupNavItems(items) {
    const groups = {};
    const seenIds = {}; // Track seen IDs per group
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
function navPathMatches(activePath, itemPath) {
    const a = String(activePath || '').trim();
    const b = String(itemPath || '').trim();
    if (!a || !b)
        return false;
    // Fast path
    if (a === b)
        return true;
    const split = (p) => {
        const [pathname, qs = ''] = p.split('?', 2);
        return { pathname: pathname || '', sp: new URLSearchParams(qs) };
    };
    const ap = split(a);
    const bp = split(b);
    if (ap.pathname !== bp.pathname)
        return false;
    // If the nav item has no query params, ignore active query params.
    const bpHasParams = Array.from(bp.sp.keys()).length > 0;
    if (!bpHasParams)
        return true;
    // If nav item has query params, treat them as a required subset.
    for (const [k, v] of bp.sp.entries()) {
        if (ap.sp.get(k) !== v)
            return false;
    }
    return true;
}
function navHasActiveDescendant(item, activePath) {
    const children = item.children;
    if (!children || children.length === 0)
        return false;
    for (const child of children) {
        if (child.path && navPathMatches(activePath, child.path))
            return true;
        if (navHasActiveDescendant(child, activePath))
            return true;
    }
    return false;
}
function filterNavByRoles(items, userRoles) {
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
        const children = filterNavByRoles(item.children, userRoles);
        return {
            ...item,
            children: children.length > 0 ? children : undefined,
        };
    });
}
function flattenNavPaths(items) {
    const out = [];
    const walk = (xs) => {
        for (const x of xs) {
            if (x?.path)
                out.push(String(x.path));
            const kids = x.children;
            if (kids && kids.length > 0)
                walk(kids);
        }
    };
    walk(items || []);
    return Array.from(new Set(out.filter(Boolean)));
}
function filterNavByPagePermissions(items, allowedByPath) {
    const allowed = (p) => (p ? Boolean(allowedByPath[String(p)]) : false);
    const walk = (xs) => {
        return (xs || [])
            .map((item) => {
            const kids = item.children;
            const nextKids = kids ? walk(kids) : [];
            // Keep item if:
            // - its own path is allowed, OR
            // - it has any allowed children (so parent container stays visible)
            const keep = allowed(item.path) || nextKids.length > 0;
            if (!keep)
                return null;
            return {
                ...item,
                children: nextKids.length > 0 ? nextKids : undefined,
            };
        })
            .filter(Boolean);
    };
    return walk(items);
}
async function checkPagePermissionsBatch(pagePaths) {
    const token = getStoredToken();
    if (!token)
        return Object.fromEntries((pagePaths || []).map((p) => [p, false]));
    if (!pagePaths || pagePaths.length === 0)
        return {};
    try {
        const res = await fetch(`/api/auth/permissions/pages/check-batch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            credentials: 'include',
            body: JSON.stringify(pagePaths),
        });
        if (!res.ok)
            return Object.fromEntries((pagePaths || []).map((p) => [p, false]));
        const json = await res.json().catch(() => ({}));
        // Expect { [path]: boolean }
        if (!json || typeof json !== 'object') {
            return Object.fromEntries((pagePaths || []).map((p) => [p, false]));
        }
        const out = {};
        for (const p of pagePaths)
            out[p] = Boolean(json[p]);
        return out;
    }
    catch {
        return Object.fromEntries((pagePaths || []).map((p) => [p, false]));
    }
}
function NavItemComponent({ item, level = 0, activePath, onNavigate }) {
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
        }
        else if (item.path) {
            if (onNavigate) {
                onNavigate(item.path);
            }
        }
    };
    const hasActiveChild = hasChildren && hasActiveDescendant;
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
                }), children: [iconName ? _jsx(LucideIcon, { name: iconName, size: 18, style: { flexShrink: 0 } }) : null, _jsx("span", { style: styles({ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }), children: item.label }), item.badge !== undefined && (_jsx("span", { style: styles({
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
function CollapsedNavItem({ item, activePath, onNavigate, isOpen, onOpen, onStartClose, onCancelClose }) {
    const { colors, radius, textStyles: ts, spacing, shadows } = useThemeTokens();
    const [isHovered, setIsHovered] = useState(false);
    const [hoveredChildIdx, setHoveredChildIdx] = useState(null);
    const buttonRef = React.useRef(null);
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
    const handleChildClick = (path) => {
        if (onNavigate) {
            onNavigate(path);
        }
    };
    const renderFlyoutItems = (nodes, depth = 0) => {
        return nodes.map((node, idx) => {
            const child = node;
            const childIconName = child.icon ? String(child.icon) : '';
            const childIsActive = (child.path ? navPathMatches(activePath, child.path) : false) || navHasActiveDescendant(child, activePath);
            const childIsHovered = hoveredChildIdx === idx && depth === 0;
            const paddingLeft = depth > 0 ? spacing.lg : spacing.md;
            const paddingRight = spacing.md;
            return (_jsxs(React.Fragment, { children: [_jsxs("button", { onClick: () => child.path && handleChildClick(child.path), onMouseEnter: () => (depth === 0 ? setHoveredChildIdx(idx) : undefined), onMouseLeave: () => (depth === 0 ? setHoveredChildIdx(null) : undefined), disabled: !child.path, style: styles({
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
                        }), children: [childIconName ? _jsx(LucideIcon, { name: childIconName, size: 16, style: { flexShrink: 0 } }) : null, _jsx("span", { style: styles({ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }), children: child.label })] }), child.children && child.children.length > 0 && (_jsx("div", { style: styles({ paddingLeft: spacing.md }), children: renderFlyoutItems(child.children, depth + 1) }))] }, `flyout-${item.id}-${depth}-${idx}`));
        });
    };
    // Determine icon button styles - more prominent hover
    const getIconBgColor = () => {
        if ((isActive && !hasChildren) || hasActiveChild)
            return colors.primary.default;
        if (isHovered || isOpen)
            return `${colors.primary.default}20`;
        return 'transparent';
    };
    const getIconColor = () => {
        if ((isActive && !hasChildren) || hasActiveChild)
            return colors.text.inverse;
        if (isHovered || isOpen)
            return colors.primary.default;
        return colors.text.secondary;
    };
    const getIconBorder = () => {
        if ((isActive && !hasChildren) || hasActiveChild)
            return 'none';
        if (isHovered || isOpen)
            return `2px solid ${colors.primary.default}`;
        return '2px solid transparent';
    };
    return (_jsxs("div", { style: { position: 'relative' }, onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave, children: [_jsx("button", { ref: buttonRef, onClick: handleClick, style: styles({
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
                }), children: iconName ? _jsx(LucideIcon, { name: iconName, size: 22 }) : _jsx("span", { style: { fontSize: '14px', fontWeight: 600 }, children: item.label.charAt(0) }) }), isOpen && buttonRef.current && (_jsxs("div", { style: styles({
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
                }), onMouseEnter: handleFlyoutMouseEnter, onMouseLeave: handleFlyoutMouseLeave, children: [_jsx("div", { style: styles({
                            padding: `${spacing.md} ${spacing.lg}`,
                            borderBottom: `1px solid ${colors.border.subtle}`,
                            backgroundColor: colors.bg.muted,
                        }), children: _jsx("div", { style: styles({
                                fontSize: ts.body.fontSize,
                                fontWeight: 600,
                                color: colors.text.primary,
                            }), children: item.label }) }), _jsx("div", { style: styles({ padding: spacing.sm }), children: hasChildren ? (_jsx("div", { children: renderFlyoutItems(item.children) })) : (_jsxs("button", { onClick: () => handleChildClick(item.path), onMouseEnter: () => setHoveredChildIdx(0), onMouseLeave: () => setHoveredChildIdx(null), style: styles({
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
                            }), children: [iconName ? _jsx(LucideIcon, { name: iconName, size: 16, style: { flexShrink: 0 } }) : null, _jsxs("span", { children: ["Go to ", item.label] })] })) })] }))] }));
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
function ShellContent({ children, config, navItems, user, activePath, onNavigate, onLogout, initialNotifications, connectionStatus = 'connected', version, }) {
    const { colors, radius, textStyles: ts, spacing, shadows } = useThemeTokens();
    const { setTheme: setUiKitTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [menuOpen, setMenuOpenState] = useState(true);
    const [expandedNodes, setExpandedNodes] = useState(new Set());
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showAppearanceModal, setShowAppearanceModal] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [notifications, setNotifications] = useState(initialNotifications);
    const [notificationsLoading, setNotificationsLoading] = useState(false);
    const [notificationsError, setNotificationsError] = useState(null);
    const [readNotificationIds, setReadNotificationIds] = useState(() => new Set());
    // Collapsed rail flyout state - shared across all nav items
    const [openFlyoutId, setOpenFlyoutId] = useState(null);
    const flyoutCloseTimeoutRef = React.useRef(null);
    // Refs for nav scroll position preservation
    const expandedNavRef = React.useRef(null);
    const collapsedNavRef = React.useRef(null);
    const handleFlyoutOpen = useCallback((itemId) => {
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
    const [hitConfig] = useState(() => {
        if (typeof window === 'undefined')
            return null;
        const win = window;
        return win.__HIT_CONFIG || null;
    });
    const [currentUser, setCurrentUser] = useState(user);
    const [authToken, setAuthTokenState] = useState(null);
    const [endingImpersonation, setEndingImpersonation] = useState(false);
    const [impersonationError, setImpersonationError] = useState(null);
    const [startingImpersonation, setStartingImpersonation] = useState(false);
    const [lastImpersonatedEmail, setLastImpersonatedEmail] = useState(null);
    // Initialize theme from DOM (set by blocking script) to prevent flash
    const [themePreference, setThemePreference] = useState(() => {
        // Read from localStorage/cookie on client
        if (typeof window !== 'undefined') {
            const saved = getSavedThemePreference();
            if (saved)
                return saved;
        }
        return 'system';
    });
    const [resolvedTheme, setResolvedTheme] = useState(() => {
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
    const [profileMetadata, setProfileMetadata] = useState({});
    const [profileFields, setProfileFields] = useState({});
    const [profileFieldMetadata, setProfileFieldMetadata] = useState([]);
    const [profileStatus, setProfileStatus] = useState({
        saving: false,
        error: null,
        success: null,
    });
    const [profileLoaded, setProfileLoaded] = useState(false);
    const [profilePictureUrl, setProfilePictureUrl] = useState(null);
    const [hrmEnabled, setHrmEnabled] = useState(() => Boolean(hitConfig?.featurePacks?.hrm));
    const [hrmEmployee, setHrmEmployee] = useState(null);
    const [hrmForm, setHrmForm] = useState({
        firstName: '',
        lastName: '',
        preferredName: '',
    });
    const [imageToCrop, setImageToCrop] = useState(null);
    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [uploadingPicture, setUploadingPicture] = useState(false);
    const fileInputRef = React.useRef(null);
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
    const endImpersonation = useCallback(async ({ clearLast }) => {
        if (endingImpersonation)
            return;
        const token = getStoredToken();
        if (!token)
            return;
        setImpersonationError(null);
        setEndingImpersonation(true);
        try {
            const res = await fetch('/api/auth/impersonate/end', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                credentials: 'include',
            });
            if (!res.ok) {
                const txt = await res.text().catch(() => '');
                throw new Error(txt || 'Failed to end impersonation');
            }
            const json = await res.json();
            const nextToken = json?.token;
            if (!nextToken) {
                throw new Error('Impersonation end did not return a token');
            }
            if (typeof window !== 'undefined') {
                localStorage.removeItem(ORIGINAL_TOKEN_STORAGE_KEY);
                if (clearLast)
                    localStorage.removeItem(LAST_IMPERSONATED_EMAIL_KEY);
            }
            setAuthToken(nextToken);
            window.location.reload();
        }
        catch (err) {
            setImpersonationError(err instanceof Error ? err.message : 'Failed to end impersonation');
        }
        finally {
            setEndingImpersonation(false);
        }
    }, [endingImpersonation]);
    const resumeLastImpersonation = useCallback(async () => {
        if (startingImpersonation)
            return;
        const token = getStoredToken();
        if (!token)
            return;
        if (typeof window === 'undefined')
            return;
        const lastEmail = localStorage.getItem(LAST_IMPERSONATED_EMAIL_KEY) || '';
        if (!lastEmail.trim())
            return;
        setImpersonationError(null);
        setStartingImpersonation(true);
        try {
            // Stash admin token so we can toggle back.
            localStorage.setItem(ORIGINAL_TOKEN_STORAGE_KEY, token);
            const res = await fetch('/api/auth/impersonate/start', {
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
            const nextToken = json?.token;
            if (!nextToken)
                throw new Error('Impersonation did not return a token');
            setAuthToken(nextToken);
            window.location.reload();
        }
        catch (err) {
            setImpersonationError(err instanceof Error ? err.message : 'Failed to start impersonation');
        }
        finally {
            setStartingImpersonation(false);
        }
    }, [startingImpersonation]);
    const setMenuOpen = useCallback((open) => {
        setMenuOpenState(open);
        if (typeof window !== 'undefined') {
            localStorage.setItem(MENU_OPEN_KEY, String(open));
        }
    }, []);
    const applyThemePreference = useCallback((preference) => {
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
        const shellTopLevel = hitConfig?.erpShellCore ?? {};
        const shellPackOptions = hitConfig?.featurePacks?.['erp-shell-core'] ??
            hitConfig?.featurePacks?.erpShellCore ??
            {};
        const defaultPref = shellTopLevel?.defaultTheme ||
            shellPackOptions?.default_theme ||
            shellPackOptions?.defaultTheme ||
            config.defaultTheme ||
            'dark';
        const preference = (saved || defaultPref || 'dark');
        applyThemePreference(preference);
        setThemeLoaded(true);
    }, [applyThemePreference, hitConfig, config.defaultTheme]);
    useEffect(() => {
        if (!themeLoaded) {
            loadInitialTheme();
        }
    }, [themeLoaded, loadInitialTheme]);
    useEffect(() => {
        if (themePreference !== 'system')
            return;
        if (typeof window === 'undefined')
            return;
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => applyThemePreference('system');
        media.addEventListener('change', handler);
        return () => media.removeEventListener('change', handler);
    }, [themePreference, applyThemePreference]);
    useEffect(() => {
        // Map profile_picture_url to avatar if present (user prop might have either field)
        const mappedUser = user ? {
            ...user,
            avatar: user.profile_picture_url || user.avatar || undefined,
        } : null;
        setCurrentUser(mappedUser);
        // Identity: email is the stable identifier; display name may be enriched via HRM (employees) when installed.
        setProfileLoaded(false);
        setProfileMetadata({});
        setProfileStatus((prev) => ({ ...prev, error: null, success: null }));
    }, [user]);
    // HRM pack can enrich identity (employee display name). Keep it optional and fail-soft.
    useEffect(() => {
        const enabled = Boolean(hitConfig?.featurePacks?.hrm);
        setHrmEnabled(enabled);
    }, [hitConfig]);
    useEffect(() => {
        if (!hrmEnabled)
            return;
        if (!currentUser?.email)
            return;
        let cancelled = false;
        const fetchEmployee = async () => {
            try {
                const token = getStoredToken();
                if (!token)
                    return;
                const res = await fetch('/api/hrm/employees/me', {
                    headers: { Authorization: `Bearer ${token}` },
                    credentials: 'include',
                });
                if (cancelled)
                    return;
                if (res.status === 404) {
                    setHrmEnabled(false);
                    return;
                }
                if (!res.ok)
                    return;
                const json = await res.json().catch(() => ({}));
                const employee = json?.employee || null;
                setHrmEmployee(employee);
                setHrmForm({
                    firstName: String(employee?.firstName || employee?.first_name || '').trim(),
                    lastName: String(employee?.lastName || employee?.last_name || '').trim(),
                    preferredName: String(employee?.preferredName || employee?.preferred_name || '').trim(),
                });
                const hrmPhoto = String(employee?.profilePictureUrl || employee?.profile_picture_url || '').trim() || null;
                if (hrmPhoto) {
                    setProfilePictureUrl(hrmPhoto);
                    setCurrentUser((prev) => prev
                        ? {
                            ...prev,
                            avatar: hrmPhoto || undefined,
                        }
                        : null);
                }
            }
            catch {
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
        if (fromHrm)
            return fromHrm;
        const pfFirst = String(profileFields?.first_name || '').trim();
        const pfLast = String(profileFields?.last_name || '').trim();
        const fromProfileFields = [pfFirst, pfLast].filter(Boolean).join(' ').trim();
        if (fromProfileFields)
            return fromProfileFields;
        const fromJwt = String(currentUser?.name || '').trim();
        if (fromJwt)
            return fromJwt;
        return String(currentUser?.email || 'User');
    }, [hrmEmployee, profileFields, currentUser?.name, currentUser?.email]);
    // Fetch profile picture on initial load if missing
    useEffect(() => {
        if (!currentUser?.email || currentUser?.avatar) {
            return; // Skip if no user or avatar already exists
        }
        // If HRM is installed, employee owns the photo; don't fetch from auth.
        if (hrmEnabled) {
            const hrmPhoto = String(hrmEmployee?.profilePictureUrl || hrmEmployee?.profile_picture_url || '').trim() ||
                null;
            if (hrmPhoto) {
                setCurrentUser((prev) => {
                    if (!prev || prev.email !== currentUser.email || prev.avatar)
                        return prev;
                    return { ...prev, avatar: hrmPhoto };
                });
            }
            return;
        }
        const email = currentUser.email;
        let cancelled = false;
        const fetchProfilePicture = async () => {
            try {
                const token = getStoredToken();
                if (!token || cancelled)
                    return;
                const response = await fetch(`/api/auth/users/${encodeURIComponent(email)}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                });
                if (cancelled)
                    return;
                if (response.ok) {
                    const userData = await response.json();
                    const profilePictureUrl = userData.profile_picture_url;
                    if (profilePictureUrl && !cancelled) {
                        setCurrentUser((prev) => {
                            if (!prev || prev.email !== email || prev.avatar)
                                return prev;
                            return {
                                ...prev,
                                avatar: profilePictureUrl,
                            };
                        });
                    }
                }
            }
            catch (err) {
                // Silently fail - avatar is optional
            }
        };
        fetchProfilePicture();
        return () => {
            cancelled = true;
        };
    }, [currentUser?.email, currentUser?.avatar, hrmEnabled, hrmEmployee]); // Only run when email changes (and HRM status)
    // Listen for user profile updates (e.g., after picture upload)
    useEffect(() => {
        const handleUserProfileUpdate = async (event) => {
            const detail = event.detail;
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
                if (!token)
                    return;
                const response = await fetch(`/api/auth/users/${encodeURIComponent(currentUser.email || '')}`, {
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
            }
            catch (err) {
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
        const eventListener = (event) => {
            handleUserProfileUpdate(event);
        };
        window.addEventListener('user-profile-updated', eventListener);
        return () => {
            window.removeEventListener('user-profile-updated', eventListener);
        };
    }, [currentUser]);
    const enrichNotificationsWithReadState = useCallback((items) => {
        return items.map((n) => ({
            ...n,
            read: readNotificationIds.has(String(n.id)),
        }));
    }, [readNotificationIds]);
    const fetchReadIds = useCallback(async (ids) => {
        const token = getStoredToken();
        if (!token)
            return [];
        if (ids.length === 0)
            return [];
        const qp = ids.map((x) => encodeURIComponent(x)).join(',');
        const res = await fetch(`/api/notification-reads?ids=${qp}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok)
            return [];
        const json = await res.json().catch(() => ({}));
        const readIds = Array.isArray(json?.readIds) ? json.readIds : [];
        return readIds.map((x) => String(x));
    }, []);
    const upsertReadIds = useCallback(async (ids) => {
        const token = getStoredToken();
        if (!token)
            return;
        if (ids.length === 0)
            return;
        await fetch(`/api/notification-reads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ids }),
        }).catch(() => { });
    }, []);
    const mapWorkflowTaskToNotification = useCallback((t) => {
        const taskId = String(t?.id ?? '');
        const runId = String(t?.runId ?? t?.run_id ?? '');
        const statusRaw = String(t?.status ?? 'open');
        const status = statusRaw === 'open' ? 'open' : 'resolved';
        const prompt = t?.prompt && typeof t.prompt === 'object' ? t.prompt : {};
        const title = typeof prompt?.title === 'string'
            ? prompt.title
            : t?.type === 'approval'
                ? 'Approval required'
                : 'Workflow task';
        const message = typeof prompt?.message === 'string'
            ? prompt.message
            : typeof prompt?.text === 'string'
                ? prompt.text
                : `A workflow is waiting for human action.`;
        const decidedBy = t?.decidedByUserId || t?.decided_by_user_id || null;
        const decision = t?.decision && typeof t.decision === 'object' ? t.decision : {};
        const decisionSummary = typeof decision?.action === 'string' ? decision.action : null;
        const base = {
            id: `workflows:task:${taskId}`,
            type: 'system',
            title,
            message,
            timestamp: t?.createdAt || t?.created_at || new Date().toISOString(),
            read: false,
            priority: 'high',
            status,
            resolved: status === 'resolved'
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
    const fetchWorkflowTaskNotifications = useCallback(async () => {
        // Only attempt if the workflows feature pack is installed (or if the endpoint exists).
        const hasWorkflows = Boolean(hitConfig?.featurePacks?.workflows);
        if (!hasWorkflows)
            return [];
        const token = getStoredToken();
        if (!token)
            return [];
        const res = await fetch(`/api/workflows/tasks?limit=50&includeResolved=true&resolvedWithinHours=24`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            // If workflows is installed but endpoint isn't available yet, don't spam errors.
            return [];
        }
        const json = await res.json().catch(() => ({}));
        const items = Array.isArray(json?.items) ? json.items : [];
        const mapped = items.map((t) => mapWorkflowTaskToNotification(t));
        return mapped;
    }, [hitConfig?.featurePacks?.workflows, mapWorkflowTaskToNotification]);
    const fetchConfiguredProviderNotifications = useCallback(async () => {
        const token = getStoredToken();
        if (!token)
            return [];
        // Allow apps to plug additional providers into the shell feed without modifying shell code.
        // Expected shape:
        //   hitConfig.erpShellCore.notificationProviders = [{ id: 'crm', path: '/api/crm/notifications' }, ...]
        const rawProviders = hitConfig?.erpShellCore?.notificationProviders ||
            hitConfig?.erpShellCore?.notification_providers ||
            hitConfig?.featurePacks?.['erp-shell-core']?.notificationProviders ||
            hitConfig?.featurePacks?.['erp-shell-core']?.notification_providers ||
            hitConfig?.featurePacks?.erpShellCore?.notificationProviders ||
            [];
        const providers = Array.isArray(rawProviders)
            ? rawProviders
                .map((p) => ({
                id: typeof p?.id === 'string' ? p.id.trim() : '',
                path: typeof p?.path === 'string' ? p.path.trim() : '',
            }))
                .filter((p) => p.id && p.path)
            : [];
        if (providers.length === 0)
            return [];
        const results = await Promise.all(providers.map(async (p) => {
            try {
                const res = await fetch(p.path, { headers: { Authorization: `Bearer ${token}` } });
                if (!res.ok)
                    return [];
                const json = await res.json().catch(() => null);
                const items = Array.isArray(json?.items)
                    ? json.items
                    : Array.isArray(json)
                        ? json
                        : [];
                return items
                    .filter(Boolean)
                    .map((n) => {
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
            }
            catch {
                return [];
            }
        }));
        return results.flat();
    }, [hitConfig]);
    const refreshNotifications = useCallback(async (opts) => {
        if (!config.showNotifications)
            return [];
        setNotificationsLoading(true);
        setNotificationsError(null);
        try {
            const workflowsItems = await fetchWorkflowTaskNotifications();
            const providerItems = await fetchConfiguredProviderNotifications();
            const merged = [...workflowsItems, ...providerItems, ...initialNotifications];
            const ids = merged.map((n) => String(n.id));
            const readIds = await fetchReadIds(ids);
            const readSet = new Set(readIds);
            setReadNotificationIds(readSet);
            const enriched = merged.map((n) => ({ ...n, read: readSet.has(String(n.id)) }));
            if (opts?.markRead) {
                const markIds = enriched.map((n) => String(n.id));
                await upsertReadIds(markIds);
                const nextSet = new Set(readSet);
                for (const id of markIds)
                    nextSet.add(id);
                setReadNotificationIds(nextSet);
                setNotifications(enriched.map((n) => ({ ...n, read: true })));
            }
            else {
                setNotifications(enriched);
            }
            return enriched;
        }
        catch (e) {
            setNotificationsError(e instanceof Error ? e.message : 'Failed to load notifications');
            return [];
        }
        finally {
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
    function safeKey(id) {
        return encodeURIComponent(String(id || '').trim()).replace(/%/g, '_');
    }
    // Real-time: subscribe to events gateway and update workflow notifications instantly.
    useEffect(() => {
        if (!mounted)
            return;
        let unsubscribers = [];
        let cancelled = false;
        const hasWorkflows = Boolean(hitConfig?.featurePacks?.workflows);
        const patternsFromConfig = hitConfig?.erpShellCore?.notificationRealtimePatterns ||
            hitConfig?.erpShellCore?.notification_realtime_patterns ||
            hitConfig?.featurePacks?.['erp-shell-core']?.notificationRealtimePatterns ||
            hitConfig?.featurePacks?.['erp-shell-core']?.notification_realtime_patterns ||
            hitConfig?.featurePacks?.erpShellCore?.notificationRealtimePatterns ||
            [];
        const rolePatterns = hasWorkflows && Array.isArray(currentUser?.roles)
            ? currentUser.roles.map((r) => `workflows.inbox.role.${safeKey(String(r || '').toLowerCase())}.*`)
            : [];
        const userPatterns = hasWorkflows && (currentUser?.id || currentUser?.email)
            ? [
                ...(currentUser?.id ? [`workflows.inbox.user.${safeKey(String(currentUser.id))}.*`] : []),
                ...(currentUser?.email ? [`workflows.inbox.user.${safeKey(String(currentUser.email))}.*`] : []),
            ]
            : [];
        const patterns = [
            ...(hasWorkflows ? [...rolePatterns, ...userPatterns] : []),
            ...(Array.isArray(patternsFromConfig) ? patternsFromConfig.map((p) => String(p || '').trim()).filter(Boolean) : []),
        ];
        // Dedup
        const uniqPatterns = Array.from(new Set(patterns));
        if (uniqPatterns.length === 0)
            return;
        (async () => {
            try {
                const sdk = await import('@hit/sdk');
                const eventsClient = sdk?.events;
                if (!eventsClient?.subscribe)
                    return;
                unsubscribers = uniqPatterns.map((pattern) => {
                    const sub = eventsClient.subscribe(pattern, (evt) => {
                        if (cancelled)
                            return;
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
                                }
                                catch {
                                    refreshNotifications().catch(() => { });
                                }
                                return;
                            }
                        }
                        // Non-workflow realtime patterns continue to use refresh fallback.
                        refreshNotifications().catch(() => { });
                    });
                    return () => sub?.unsubscribe?.();
                });
            }
            catch {
                // SDK not available or realtime not configured; ignore.
            }
        })();
        return () => {
            cancelled = true;
            for (const u of unsubscribers) {
                try {
                    u();
                }
                catch { }
            }
            unsubscribers = [];
        };
    }, [hitConfig, mounted, refreshNotifications, currentUser?.roles, currentUser?.id, currentUser?.email, readNotificationIds, mapWorkflowTaskToNotification]);
    // Fetch whenever the dropdown opens (and once on mount).
    useEffect(() => {
        if (!mounted)
            return;
        refreshNotifications();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mounted]);
    const runNotificationAction = useCallback(async (action) => {
        if (!action || action.kind !== 'api')
            return;
        const token = getStoredToken();
        if (!token) {
            setNotificationsError('You must be signed in to take this action.');
            return;
        }
        const needsConfirm = action.confirm && typeof action.confirm === 'object';
        if (needsConfirm) {
            const ok = window.confirm(`${action.confirm.title}\n\n${action.confirm.message}`);
            if (!ok)
                return;
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
                const msg = json?.error || json?.detail || `Action failed (${res.status})`;
                setNotificationsError(String(msg));
            }
            else {
                setNotificationsError(null);
            }
        }
        catch (e) {
            setNotificationsError(e instanceof Error ? e.message : 'Action failed');
        }
        finally {
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
                }
                catch {
                    // Invalid JSON, ignore - start collapsed
                }
            }
            // Note: Nav starts collapsed by default (empty Set) - nodes only expand when user clicks
        }
    }, [themeLoaded, loadInitialTheme]);
    // Restore nav scroll position on mount and save on scroll
    useEffect(() => {
        const restoreScroll = () => {
            if (typeof window === 'undefined')
                return;
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
    const handleNavScroll = useCallback((e) => {
        if (typeof window !== 'undefined') {
            sessionStorage.setItem(NAV_SCROLL_KEY, String(e.currentTarget.scrollTop));
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
        if (!currentUser?.email)
            return;
        setProfileStatus((prev) => ({ ...prev, error: null, success: null }));
        try {
            const token = getStoredToken();
            const headers = {};
            if (token)
                headers.Authorization = `Bearer ${token}`;
            // Fetch user profile data using /me endpoint
            const response = await fetch(`/api/auth/me`, {
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
                const fieldsResponse = await fetch(`/api/auth/me/profile-fields`, {
                    headers,
                    credentials: 'include',
                });
                if (fieldsResponse.ok) {
                    const fieldsData = await fieldsResponse.json().catch(() => []);
                    // Defensive: endpoint may return an error object (or null), but UI expects an array.
                    setProfileFieldMetadata(Array.isArray(fieldsData) ? fieldsData : []);
                }
            }
            catch (fieldsError) {
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
                    }
                    else if (eRes.ok) {
                        const eJson = await eRes.json().catch(() => ({}));
                        const employee = eJson?.employee || null;
                        setHrmEmployee(employee);
                        setHrmForm({
                            firstName: String(employee?.firstName || employee?.first_name || '').trim(),
                            lastName: String(employee?.lastName || employee?.last_name || '').trim(),
                            preferredName: String(employee?.preferredName || employee?.preferred_name || '').trim(),
                        });
                        const hrmPhoto = String(employee?.profilePictureUrl || employee?.profile_picture_url || '').trim() || null;
                        if (hrmPhoto) {
                            setProfilePictureUrl(hrmPhoto);
                            setCurrentUser((prev) => prev
                                ? {
                                    ...prev,
                                    avatar: hrmPhoto || undefined,
                                }
                                : null);
                        }
                    }
                }
                catch {
                    // optional
                }
            }
        }
        catch (error) {
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
                    }
                    else if (!hrmRes.ok) {
                        const hrmJson = await hrmRes.json().catch(() => ({}));
                        throw new Error(hrmJson?.error || hrmJson?.detail || 'Failed to update employee profile');
                    }
                    else {
                        const hrmJson = await hrmRes.json().catch(() => ({}));
                        const employee = hrmJson?.employee || null;
                        setHrmEmployee(employee);
                    }
                }
            }
            const payload = {};
            // Note: metadata.name is no longer used - email is used as the identifier
            if (Object.keys(profileMetadata).length > 0) {
                payload.metadata = profileMetadata;
            }
            if (profileForm.password) {
                payload.password = profileForm.password;
            }
            // Build profile_fields payload - include all required fields and any modified fields
            const nextProfileFields = { ...profileFields };
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
            const response = await fetch(`/api/auth/me`, {
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
        }
        catch (error) {
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
    const handlePictureUpload = useCallback(async (event) => {
        const file = event.target.files?.[0];
        if (!file)
            return;
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
            setImageToCrop(reader.result);
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
    const handleCropComplete = useCallback(async (croppedImageBase64) => {
        if (!currentUser?.email)
            return;
        try {
            setUploadingPicture(true);
            const token = getStoredToken();
            if (!token) {
                throw new Error('You must be signed in to update your profile.');
            }
            const employeeId = String(hrmEmployee?.id || '').trim();
            const useHrm = hrmEnabled && employeeId;
            if (hrmEnabled && !employeeId) {
                throw new Error('Employee record not loaded yet. Please try again in a moment.');
            }
            // HRM owns the employee photo; fall back to auth only when HRM is not installed.
            const response = await fetch(useHrm ? `/api/hrm/employees/${encodeURIComponent(employeeId)}/photo` : `/api/auth/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                credentials: 'include',
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
        }
        catch (err) {
            setProfileStatus({
                saving: false,
                error: err instanceof Error ? err.message : 'Failed to upload profile picture',
                success: null,
            });
        }
        finally {
            setUploadingPicture(false);
            setImageToCrop(null);
        }
    }, [currentUser?.email, hrmEnabled, hrmEmployee]);
    const handlePictureDelete = useCallback(async () => {
        if (!currentUser?.email)
            return;
        if (!confirm('Are you sure you want to delete your profile picture?')) {
            return;
        }
        try {
            setUploadingPicture(true);
            const token = getStoredToken();
            if (!token) {
                throw new Error('You must be signed in to update your profile.');
            }
            const employeeId = String(hrmEmployee?.id || '').trim();
            const useHrm = hrmEnabled && employeeId;
            if (hrmEnabled && !employeeId) {
                throw new Error('Employee record not loaded yet. Please try again in a moment.');
            }
            // HRM owns the employee photo; fall back to auth only when HRM is not installed.
            const response = await fetch(useHrm ? `/api/hrm/employees/${encodeURIComponent(employeeId)}/photo` : `/api/auth/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                credentials: 'include',
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
        }
        catch (err) {
            setProfileStatus({
                saving: false,
                error: err instanceof Error ? err.message : 'Failed to delete profile picture',
                success: null,
            });
        }
        finally {
            setUploadingPicture(false);
        }
    }, [currentUser?.email, hrmEnabled, hrmEmployee]);
    const triggerFileInput = useCallback(() => {
        fileInputRef.current?.click();
    }, []);
    useEffect(() => {
        if (showProfileModal && !profileLoaded && !profileStatus.saving) {
            fetchProfile();
        }
    }, [fetchProfile, profileLoaded, profileStatus.saving, showProfileModal]);
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
    const COLLAPSED_RAIL_WIDTH = '64px';
    const EXPANDED_SIDEBAR_WIDTH = '280px';
    const [pagePermsLoading, setPagePermsLoading] = useState(false);
    const [allowedByPath, setAllowedByPath] = useState({});
    // Compute role-filtered nav, then permission-filter (batched).
    // Memoize so callers that reconstruct arrays each render don't retrigger permission checks.
    const roleFilteredNav = React.useMemo(() => filterNavByRoles(navItems, currentUser?.roles), [navItems, currentUser?.roles]);
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
            if (cancelled)
                return;
            setAllowedByPath(m || {});
        })
            .finally(() => {
            if (cancelled)
                return;
            setPagePermsLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [currentUser?.email, currentUser?.roles, navPathsKey]);
    const permissionFilteredNav = pagePermsLoading
        ? []
        : filterNavByPagePermissions(roleFilteredNav, allowedByPath);
    const groupedNavItems = groupNavItems(permissionFilteredNav);
    // Flatten all items for the collapsed rail
    const allFlatNavItems = groupedNavItems.flatMap(group => group.items);
    // Prevent flash of unstyled content during hydration
    // Use CSS variables that respect the theme already set by blocking script in layout.tsx
    if (!mounted) {
        return (_jsx("div", { style: {
                display: 'flex',
                height: '100vh',
                // Use theme-aware colors: light theme = white bg, dark theme = dark bg
                // The blocking script already set data-theme and .dark class on <html>
                backgroundColor: resolvedTheme === 'light' ? '#ffffff' : '#0f0f0f',
                color: resolvedTheme === 'light' ? '#0f0f0f' : '#ffffff',
            } }));
    }
    return (_jsxs(ShellContext.Provider, { value: contextValue, children: [_jsxs("div", { style: styles({
                    display: 'flex',
                    height: '100vh',
                    backgroundColor: colors.bg.page,
                    color: colors.text.primary,
                    margin: 0,
                    padding: 0,
                }), children: [!showSidebar && (_jsxs("aside", { style: styles({
                            width: COLLAPSED_RAIL_WIDTH,
                            minWidth: COLLAPSED_RAIL_WIDTH,
                            height: '100%',
                            backgroundColor: colors.bg.muted,
                            borderRight: `1px solid ${colors.border.subtle}`,
                            display: 'flex',
                            flexDirection: 'column',
                            flexShrink: 0,
                            zIndex: 100,
                        }), children: [_jsx("div", { style: styles({
                                    height: '64px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderBottom: `1px solid ${colors.border.subtle}`,
                                    flexShrink: 0,
                                }), children: _jsx("button", { onClick: () => setMenuOpen(true), style: styles({
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
                                    }), title: `Expand ${config.brandName} navigation`, children: config.logoUrl ? (_jsx("img", { src: config.logoUrl, alt: config.brandName, style: { width: '24px', height: '24px', objectFit: 'contain' } })) : (_jsx("span", { style: styles({ color: '#FFFFFF', fontWeight: 700, fontSize: ts.heading3.fontSize }), children: config.brandName.charAt(0) })) }) }), _jsx("nav", { ref: collapsedNavRef, onScroll: handleNavScroll, style: styles({
                                    flex: 1,
                                    overflowY: 'auto',
                                    padding: `${spacing.sm} 0`,
                                }), children: allFlatNavItems.map((item) => (_jsx(CollapsedNavItem, { item: item, activePath: activePath, onNavigate: onNavigate, isOpen: openFlyoutId === item.id, onOpen: (itemId) => handleFlyoutOpen(itemId), onStartClose: handleFlyoutStartClose, onCancelClose: handleFlyoutCancelClose }, item.id))) }), _jsx("div", { style: styles({
                                    padding: spacing.md,
                                    borderTop: `1px solid ${colors.border.subtle}`,
                                    flexShrink: 0,
                                    display: 'flex',
                                    justifyContent: 'center',
                                }), children: _jsx("div", { style: styles({
                                        width: '10px',
                                        height: '10px',
                                        backgroundColor: connectionStatus === 'connected' ? colors.success.default
                                            : connectionStatus === 'connecting' ? colors.warning.default
                                                : colors.error.default,
                                        borderRadius: radius.full,
                                        ...(connectionStatus === 'connecting' ? { animation: 'pulse 1.5s ease-in-out infinite' } : {}),
                                    }), title: connectionStatus === 'connected' ? 'WebSocket Connected'
                                        : connectionStatus === 'connecting' ? 'Connecting...'
                                            : 'Disconnected' }) })] })), showSidebar && (_jsxs("aside", { style: styles({
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
                        }), children: [_jsxs("div", { style: styles({
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
                                }), children: [_jsxs("div", { style: styles({ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0, flex: 1 }), children: [_jsx("div", { style: styles({
                                                    width: '32px',
                                                    height: '32px',
                                                    background: 'linear-gradient(135deg, #F26522, #FF8C42)',
                                                    borderRadius: radius.md,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    overflow: 'hidden',
                                                }), children: config.logoUrl ? (_jsx("img", { src: config.logoUrl, alt: config.brandName, style: { width: '20px', height: '20px', objectFit: 'contain' } })) : (_jsx("span", { style: styles({ color: '#FFFFFF', fontWeight: 700, fontSize: ts.body.fontSize }), children: config.brandName.charAt(0) })) }), _jsx("span", { style: styles({ fontSize: ts.heading3.fontSize, fontWeight: ts.heading3.fontWeight, color: colors.text.primary }), children: config.brandName })] }), _jsx("button", { onClick: () => setMenuOpen(false), style: {
                                            ...iconButtonStyle,
                                            width: '36px',
                                            height: '36px',
                                            flexShrink: 0,
                                        }, children: _jsx(Menu, { size: 20 }) })] }), _jsx("nav", { ref: expandedNavRef, onScroll: handleNavScroll, style: styles({
                                    flex: 1,
                                    overflowY: 'auto',
                                    padding: `${spacing.sm} ${spacing.md}`,
                                    minWidth: EXPANDED_SIDEBAR_WIDTH,
                                }), children: groupedNavItems.map((group) => (_jsxs("div", { children: [_jsx(NavGroupHeader, { label: group.label }), group.items.map((item) => (_jsx(NavItemComponent, { item: item, activePath: activePath, onNavigate: onNavigate }, `${group.group}-${item.id}`)))] }, group.group))) }), _jsx("div", { style: styles({
                                    padding: spacing.lg,
                                    borderTop: `1px solid ${colors.border.subtle}`,
                                    flexShrink: 0,
                                    minWidth: EXPANDED_SIDEBAR_WIDTH,
                                }), children: _jsxs("div", { style: styles({ display: 'flex', alignItems: 'center', gap: spacing.sm, fontSize: ts.bodySmall.fontSize, color: colors.text.muted }), children: [_jsx("div", { style: styles({
                                                width: '8px',
                                                height: '8px',
                                                backgroundColor: connectionStatus === 'connected' ? colors.success.default
                                                    : connectionStatus === 'connecting' ? colors.warning.default
                                                        : colors.error.default,
                                                borderRadius: radius.full,
                                                ...(connectionStatus === 'connecting' ? { animation: 'pulse 1.5s ease-in-out infinite' } : {}),
                                            }) }), _jsx("span", { children: connectionStatus === 'connected' ? `Connected${version ? ` v${version}` : ''}`
                                                : connectionStatus === 'connecting' ? 'Connecting...'
                                                    : 'Disconnected' })] }) })] })), _jsxs("div", { style: styles({ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }), children: [_jsxs("header", { style: styles({
                                    height: '64px',
                                    backgroundColor: colors.bg.surface,
                                    borderBottom: `1px solid ${colors.border.subtle}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: `0 ${spacing['2xl']}`,
                                    flexShrink: 0,
                                }), children: [_jsx("div", { style: styles({ display: 'flex', alignItems: 'center', gap: spacing.lg }) }), _jsxs("div", { style: styles({ display: 'flex', alignItems: 'center', gap: spacing.sm }), children: [config.showThemeToggle && (_jsx("button", { onClick: openAppearance, style: iconButtonStyle, "aria-label": "Theme settings", children: resolvedTheme === 'dark' ? _jsx(Moon, { size: 20 }) : _jsx(Sun, { size: 20 }) })), config.showNotifications && (_jsxs("div", { style: { position: 'relative' }, children: [_jsxs("button", { onClick: () => {
                                                            const next = !showNotifications;
                                                            setShowNotifications(next);
                                                            setShowProfileMenu(false);
                                                            if (next) {
                                                                refreshNotifications({ markRead: true });
                                                            }
                                                        }, style: iconButtonStyle, children: [_jsx(Bell, { size: 20 }), unreadCount > 0 && (_jsx("span", { style: styles({
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
                                                                }), children: unreadCount > 9 ? '9+' : unreadCount }))] }), showNotifications && (_jsxs(_Fragment, { children: [_jsx("div", { onClick: () => setShowNotifications(false), style: styles({ position: 'fixed', inset: 0, zIndex: 40 }) }), _jsxs("div", { style: styles({
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
                                                                }), children: [_jsxs("div", { style: styles({
                                                                            padding: `${spacing.md} ${spacing.lg}`,
                                                                            borderBottom: `1px solid ${colors.border.subtle}`,
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'space-between',
                                                                            gap: spacing.md,
                                                                        }), children: [_jsxs("div", { style: styles({ display: 'flex', flexDirection: 'column', gap: spacing.px }), children: [_jsx("div", { style: styles({ fontSize: ts.body.fontSize, fontWeight: 700, color: colors.text.primary }), children: "Inbox" }), _jsx("div", { style: styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted }), children: notificationsLoading ? 'Loading…' : `${notifications.length} item(s)` })] }), _jsxs("div", { style: styles({ display: 'flex', alignItems: 'center', gap: spacing.xs }), children: [_jsx("button", { onClick: () => refreshNotifications(), style: styles({
                                                                                            ...iconButtonStyle,
                                                                                            width: '36px',
                                                                                            height: '36px',
                                                                                            backgroundColor: colors.bg.muted,
                                                                                        }), "aria-label": "Refresh notifications", title: "Refresh", children: _jsx(RotateCw, { size: 16 }) }), _jsx("button", { onClick: () => setShowNotifications(false), style: styles({
                                                                                            ...iconButtonStyle,
                                                                                            width: '36px',
                                                                                            height: '36px',
                                                                                            backgroundColor: colors.bg.muted,
                                                                                        }), "aria-label": "Close notifications", title: "Close", children: _jsx(X, { size: 16 }) })] })] }), notificationsError && (_jsx("div", { style: styles({
                                                                            padding: `${spacing.sm} ${spacing.lg}`,
                                                                            backgroundColor: colors.bg.muted,
                                                                            borderBottom: `1px solid ${colors.border.subtle}`,
                                                                            color: colors.error.default,
                                                                            fontSize: ts.bodySmall.fontSize,
                                                                        }), children: notificationsError })), _jsx("div", { style: styles({ maxHeight: '420px', overflowY: 'auto' }), children: notifications.length === 0 && !notificationsLoading ? (_jsx("div", { style: styles({
                                                                                padding: `${spacing.lg} ${spacing.lg}`,
                                                                                color: colors.text.muted,
                                                                                fontSize: ts.body.fontSize,
                                                                            }), children: "No notifications yet." })) : (_jsx("div", { style: styles({ padding: spacing.sm, display: 'flex', flexDirection: 'column', gap: spacing.sm }), children: notifications.map((n) => {
                                                                                const isUnread = !n.read;
                                                                                const status = n.status || (n.read ? 'resolved' : 'open');
                                                                                const tsRaw = n.timestamp;
                                                                                const tsStr = (() => {
                                                                                    try {
                                                                                        const d = tsRaw instanceof Date ? tsRaw : new Date(tsRaw);
                                                                                        return d.toLocaleString();
                                                                                    }
                                                                                    catch {
                                                                                        return String(tsRaw);
                                                                                    }
                                                                                })();
                                                                                return (_jsxs("div", { style: styles({
                                                                                        padding: `${spacing.md} ${spacing.lg}`,
                                                                                        borderRadius: radius.lg,
                                                                                        border: `1px solid ${isUnread ? colors.primary.default : colors.border.subtle}`,
                                                                                        backgroundColor: isUnread ? `${colors.primary.default}10` : colors.bg.page,
                                                                                        display: 'flex',
                                                                                        flexDirection: 'column',
                                                                                        gap: spacing.sm,
                                                                                    }), children: [_jsxs("div", { style: styles({ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md }), children: [_jsxs("div", { style: styles({ display: 'flex', flexDirection: 'column', gap: spacing.xs, minWidth: 0, flex: 1 }), children: [_jsx("div", { style: styles({
                                                                                                                fontSize: ts.body.fontSize,
                                                                                                                fontWeight: 700,
                                                                                                                color: colors.text.primary,
                                                                                                                overflow: 'hidden',
                                                                                                                textOverflow: 'ellipsis',
                                                                                                                whiteSpace: 'nowrap',
                                                                                                            }), children: n.title }), _jsx("div", { style: styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted }), children: tsStr })] }), _jsx("div", { style: styles({
                                                                                                        padding: '2px 8px',
                                                                                                        borderRadius: radius.full,
                                                                                                        fontSize: '11px',
                                                                                                        fontWeight: 700,
                                                                                                        backgroundColor: status === 'open' ? `${colors.warning.default}20` : `${colors.success.default}20`,
                                                                                                        color: status === 'open' ? colors.warning.default : colors.success.default,
                                                                                                        flexShrink: 0,
                                                                                                    }), children: status === 'open' ? 'OPEN' : 'RESOLVED' })] }), _jsx("div", { style: styles({ fontSize: ts.body.fontSize, color: colors.text.secondary }), children: n.message }), n.resolved?.summary || n.resolved?.by ? (_jsxs("div", { style: styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted }), children: [n.resolved?.summary ? `${n.resolved.summary}` : 'Resolved', n.resolved?.by ? ` by ${n.resolved.by}` : ''] })) : null, Array.isArray(n.actions) && n.actions.length > 0 ? (_jsx("div", { style: styles({ display: 'flex', gap: spacing.sm, justifyContent: 'flex-end', flexWrap: 'wrap' }), children: n.actions.map((a) => (_jsx("button", { onClick: () => runNotificationAction(a), style: styles({
                                                                                                    padding: `${spacing.xs} ${spacing.md}`,
                                                                                                    borderRadius: radius.md,
                                                                                                    border: 'none',
                                                                                                    cursor: 'pointer',
                                                                                                    fontSize: ts.bodySmall.fontSize,
                                                                                                    fontWeight: 700,
                                                                                                    backgroundColor: a.variant === 'danger' ? colors.error.default : a.variant === 'secondary' ? colors.bg.muted : colors.primary.default,
                                                                                                    color: a.variant === 'secondary' ? colors.text.primary : colors.text.inverse,
                                                                                                }), children: a.label }, a.id))) })) : null] }, String(n.id)));
                                                                            }) })) })] })] }))] })), config.showUserMenu && (_jsxs("div", { style: { position: 'relative' }, children: [_jsxs("button", { onClick: () => { setShowProfileMenu(!showProfileMenu); setShowNotifications(false); }, style: styles({
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: spacing.md,
                                                            padding: `${spacing.xs} ${spacing.md} ${spacing.xs} ${spacing.xs}`,
                                                            background: 'none',
                                                            border: 'none',
                                                            borderRadius: radius.lg,
                                                            cursor: 'pointer',
                                                        }), children: [currentUser?.avatar ? (_jsx("img", { src: currentUser.avatar, alt: userDisplayName || currentUser?.email || 'User', style: styles({
                                                                    width: '36px',
                                                                    height: '36px',
                                                                    borderRadius: radius.full,
                                                                    objectFit: 'cover',
                                                                    ...(impersonation.active ? { boxShadow: `0 0 0 2px ${colors.warning.default}` } : {}),
                                                                }) })) : (_jsx("div", { style: styles({
                                                                    width: '36px',
                                                                    height: '36px',
                                                                    background: `linear-gradient(135deg, ${colors.primary.default}, ${colors.accent.default})`,
                                                                    borderRadius: radius.full,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    ...(impersonation.active ? { boxShadow: `0 0 0 2px ${colors.warning.default}` } : {}),
                                                                }), children: _jsx("span", { style: styles({ color: colors.text.inverse, fontWeight: 700, fontSize: '12px' }), children: toInitials(userDisplayName) }) })), _jsxs("div", { style: styles({ textAlign: 'left' }), children: [_jsx("div", { style: styles({ fontSize: ts.body.fontSize, fontWeight: ts.label.fontWeight, color: colors.text.primary }), children: userDisplayName || currentUser?.email || 'User' }), _jsx("div", { style: styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted }), children: currentUser?.roles?.[0] || 'Member' })] })] }), showProfileMenu && (_jsxs(_Fragment, { children: [_jsx("div", { onClick: () => setShowProfileMenu(false), style: styles({ position: 'fixed', inset: 0, zIndex: 40 }) }), _jsxs("div", { style: styles({
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
                                                                }), children: [_jsxs("div", { style: styles({
                                                                            padding: `${spacing.md} ${spacing.lg}`,
                                                                            borderBottom: `1px solid ${colors.border.subtle}`,
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: spacing.sm,
                                                                        }), children: [currentUser?.avatar ? (_jsx("img", { src: currentUser.avatar, alt: userDisplayName || currentUser?.email || 'User', style: styles({
                                                                                    width: '40px',
                                                                                    height: '40px',
                                                                                    borderRadius: radius.full,
                                                                                    objectFit: 'cover',
                                                                                    ...(impersonation.active ? { boxShadow: `0 0 0 2px ${colors.warning.default}` } : {}),
                                                                                }) })) : (_jsx("div", { style: styles({
                                                                                    width: '40px',
                                                                                    height: '40px',
                                                                                    background: `linear-gradient(135deg, ${colors.primary.default}, ${colors.accent.default})`,
                                                                                    borderRadius: radius.full,
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    justifyContent: 'center',
                                                                                    ...(impersonation.active ? { boxShadow: `0 0 0 2px ${colors.warning.default}` } : {}),
                                                                                }), children: _jsx("span", { style: styles({ color: colors.text.inverse, fontWeight: 800, fontSize: '13px' }), children: toInitials(userDisplayName) }) })), _jsxs("div", { style: styles({ flex: 1, minWidth: 0 }), children: [_jsx("div", { style: styles({ fontSize: ts.body.fontSize, fontWeight: ts.label.fontWeight, color: colors.text.primary }), children: userDisplayName || currentUser?.email || 'User' }), _jsx("div", { style: styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted }), children: currentUser?.roles?.[0] || 'Member' })] })] }), impersonation.active && (_jsxs("div", { style: styles({
                                                                            padding: `${spacing.sm} ${spacing.lg}`,
                                                                            borderBottom: `1px solid ${colors.border.subtle}`,
                                                                            backgroundColor: `${colors.warning.default}12`,
                                                                            display: 'flex',
                                                                            flexDirection: 'column',
                                                                            gap: spacing.xs,
                                                                        }), children: [_jsx("div", { style: styles({ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', color: colors.warning.default }), children: "ASSUMING USER" }), _jsx("div", { style: styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.primary, wordBreak: 'break-word' }), children: currentUser?.email || 'Unknown user' }), impersonation.by ? (_jsxs("div", { style: styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted }), children: ["Admin: ", impersonation.by] })) : null, impersonationError ? (_jsx("div", { style: styles({ fontSize: ts.bodySmall.fontSize, color: colors.error.default }), children: impersonationError })) : null, _jsxs("div", { style: styles({ marginTop: spacing.xs, display: 'flex', justifyContent: 'flex-end', gap: spacing.sm }), children: [_jsx("button", { onClick: () => { setShowProfileMenu(false); endImpersonation({ clearLast: false }); }, disabled: endingImpersonation, title: "Switch back (keeps this user ready to re-assume)", style: styles({
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
                                                                                        }), children: _jsx(RotateCw, { size: 16 }) }), _jsx("button", { onClick: () => { setShowProfileMenu(false); endImpersonation({ clearLast: true }); }, disabled: endingImpersonation, style: styles({
                                                                                            padding: `${spacing.xs} ${spacing.md}`,
                                                                                            borderRadius: radius.md,
                                                                                            border: `1px solid ${colors.warning.default}`,
                                                                                            backgroundColor: colors.bg.surface,
                                                                                            color: colors.text.primary,
                                                                                            cursor: endingImpersonation ? 'not-allowed' : 'pointer',
                                                                                            fontSize: ts.bodySmall.fontSize,
                                                                                            fontWeight: 700,
                                                                                        }), children: endingImpersonation ? 'Exiting…' : 'Exit assume' })] })] })), !impersonation.active && lastImpersonatedEmail && (currentUser?.roles?.includes('admin') || currentUser?.roles?.includes('owner')) && (_jsxs("div", { style: styles({
                                                                            padding: `${spacing.sm} ${spacing.lg}`,
                                                                            borderBottom: `1px solid ${colors.border.subtle}`,
                                                                            backgroundColor: `${colors.warning.default}08`,
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'space-between',
                                                                            gap: spacing.sm,
                                                                        }), children: [_jsxs("div", { style: styles({ minWidth: 0 }), children: [_jsx("div", { style: styles({ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', color: colors.warning.default }), children: "READY TO TOGGLE" }), _jsx("div", { style: styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.primary, wordBreak: 'break-word' }), children: lastImpersonatedEmail }), impersonationError ? (_jsx("div", { style: styles({ fontSize: ts.bodySmall.fontSize, color: colors.error.default }), children: impersonationError })) : null] }), _jsx("button", { onClick: () => { setShowProfileMenu(false); resumeLastImpersonation(); }, disabled: startingImpersonation, title: "Assume last user", style: styles({
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
                                                                                }), children: _jsx(RotateCw, { size: 16 }) })] })), _jsxs("div", { style: styles({ padding: spacing.sm }), children: [_jsxs("button", { onClick: openProfileModal, style: styles({
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
                                                                                }), children: [_jsx(User, { size: 16, style: { color: colors.text.muted } }), "Profile"] }), _jsxs("button", { onClick: openAppearance, style: styles({
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
                                                                                }), children: [_jsx(Settings, { size: 16, style: { color: colors.text.muted } }), "Settings"] })] }), _jsx("div", { style: styles({ padding: spacing.sm, borderTop: `1px solid ${colors.border.subtle}` }), children: _jsxs("button", { onClick: () => { setShowProfileMenu(false); onLogout?.(); }, style: styles({
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
                                }), onClick: () => { setShowNotifications(false); setShowProfileMenu(false); }, children: _jsx("div", { style: styles({ maxWidth: '1280px', margin: '0 auto' }), children: children }) })] })] }), showAppearanceModal && (_jsxs(_Fragment, { children: [_jsx("div", { onClick: closeAppearance, style: styles({
                            position: 'fixed',
                            inset: 0,
                            backgroundColor: 'rgba(0,0,0,0.55)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 90,
                        }) }), _jsx("div", { style: styles({
                            position: 'fixed',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: spacing['2xl'],
                            zIndex: 100,
                        }), children: _jsxs("div", { style: styles({
                                width: 'min(640px, 100%)',
                                backgroundColor: colors.bg.surface,
                                borderRadius: radius.xl,
                                border: `1px solid ${colors.border.default}`,
                                boxShadow: shadows.xl,
                                overflow: 'hidden',
                            }), children: [_jsxs("div", { style: styles({
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: `${spacing.lg} ${spacing.xl}`,
                                        borderBottom: `1px solid ${colors.border.subtle}`,
                                    }), children: [_jsxs("div", { children: [_jsx("div", { style: styles({ fontSize: ts.heading3.fontSize, fontWeight: ts.heading3.fontWeight }), children: "Appearance" }), _jsx("div", { style: styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted }), children: "Switch between light, dark, or system. We save your choice in a cookie and localStorage." })] }), _jsx("button", { onClick: closeAppearance, style: {
                                                ...iconButtonStyle,
                                                width: '36px',
                                                height: '36px',
                                                backgroundColor: colors.bg.muted,
                                            }, "aria-label": "Close appearance settings", children: _jsx(X, { size: 18 }) })] }), _jsx("div", { style: styles({ padding: spacing.xl, display: 'flex', flexDirection: 'column', gap: spacing.xl }), children: _jsxs("div", { style: styles({ display: 'flex', flexDirection: 'column', gap: spacing.md }), children: [_jsx("div", { style: styles({ fontWeight: ts.label.fontWeight, fontSize: ts.body.fontSize }), children: "Theme" }), _jsx("div", { style: styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted }), children: "Switch between light and dark. We store your choice in a cookie and localStorage so it sticks across visits." }), _jsx("div", { style: styles({ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: spacing.md }), children: [
                                                    { value: 'light', label: 'Light', icon: _jsx(Sun, { size: 16 }) },
                                                    { value: 'dark', label: 'Dark', icon: _jsx(Moon, { size: 16 }) },
                                                    { value: 'system', label: 'System', icon: _jsx(Monitor, { size: 16 }) },
                                                ].map((option) => {
                                                    const active = themePreference === option.value;
                                                    return (_jsxs("button", { onClick: () => applyThemePreference(option.value), style: styles({
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
                                                        }), children: [_jsx("span", { style: styles({
                                                                    width: '32px',
                                                                    height: '32px',
                                                                    borderRadius: radius.full,
                                                                    backgroundColor: active ? colors.bg.muted : colors.bg.surface,
                                                                    display: 'grid',
                                                                    placeItems: 'center',
                                                                    color: active ? colors.primary.default : colors.text.secondary,
                                                                }), children: option.icon }), _jsxs("div", { style: styles({ display: 'flex', flexDirection: 'column', gap: spacing.px }), children: [_jsx("span", { style: styles({ fontWeight: ts.label.fontWeight }), children: option.label }), _jsx("span", { style: styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted }), children: option.value === 'system' ? 'Match your device preference' : `Force ${option.label.toLowerCase()} mode` })] })] }, option.value));
                                                }) }), _jsxs("div", { style: styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.secondary }), children: ["Using ", _jsx("strong", { children: resolvedTheme }), " theme (preference: ", themePreference, ")."] })] }) })] }) })] })), showProfileModal && (_jsxs(_Fragment, { children: [_jsx("div", { onClick: closeProfileModal, style: styles({
                            position: 'fixed',
                            inset: 0,
                            backgroundColor: 'rgba(0,0,0,0.55)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 90,
                        }) }), _jsx("div", { style: styles({
                            position: 'fixed',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: spacing['2xl'],
                            zIndex: 100,
                        }), children: _jsxs("div", { style: styles({
                                width: 'min(640px, 100%)',
                                backgroundColor: colors.bg.surface,
                                borderRadius: radius.xl,
                                border: `1px solid ${colors.border.default}`,
                                boxShadow: shadows.xl,
                                overflow: 'hidden',
                            }), children: [_jsxs("div", { style: styles({
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: `${spacing.lg} ${spacing.xl}`,
                                        borderBottom: `1px solid ${colors.border.subtle}`,
                                    }), children: [_jsxs("div", { children: [_jsx("div", { style: styles({ fontSize: ts.heading3.fontSize, fontWeight: ts.heading3.fontWeight }), children: "Profile" }), _jsx("div", { style: styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted }), children: "Update your profile fields and optionally set a new password." })] }), _jsx("button", { onClick: closeProfileModal, style: {
                                                ...iconButtonStyle,
                                                width: '36px',
                                                height: '36px',
                                                backgroundColor: colors.bg.muted,
                                            }, "aria-label": "Close profile settings", children: _jsx(X, { size: 18 }) })] }), _jsxs("div", { style: styles({ padding: spacing.xl, display: 'flex', flexDirection: 'column', gap: spacing.md }), children: [_jsxs("div", { style: styles({ display: 'flex', flexDirection: 'column', gap: spacing.sm, paddingBottom: spacing.md, borderBottom: `1px solid ${colors.border.subtle}` }), children: [_jsx("label", { style: styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.secondary }), children: "Profile Picture" }), _jsxs("div", { style: styles({ display: 'flex', alignItems: 'center', gap: spacing.md }), children: [profilePictureUrl ? (_jsx("img", { src: profilePictureUrl, alt: userDisplayName || currentUser?.email || 'User', style: styles({
                                                                width: '80px',
                                                                height: '80px',
                                                                borderRadius: radius.full,
                                                                objectFit: 'cover',
                                                                border: `2px solid ${colors.border.default}`,
                                                            }) })) : (_jsx("div", { style: styles({
                                                                width: '80px',
                                                                height: '80px',
                                                                background: `linear-gradient(135deg, ${colors.primary.default}, ${colors.accent.default})`,
                                                                borderRadius: radius.full,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                border: `2px solid ${colors.border.default}`,
                                                            }), children: _jsx("span", { style: styles({ color: colors.text.inverse, fontWeight: 800, fontSize: '22px' }), children: toInitials(userDisplayName) }) })), _jsxs("div", { style: styles({ display: 'flex', flexDirection: 'column', gap: spacing.xs, flex: 1 }), children: [_jsx("div", { style: styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted }), children: userDisplayName || currentUser?.email || 'User' }), currentUser?.email && userDisplayName && userDisplayName !== currentUser.email ? (_jsx("div", { style: styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.secondary }), children: currentUser.email })) : null, _jsxs("div", { style: styles({ display: 'flex', gap: spacing.sm }), children: [_jsxs("button", { onClick: triggerFileInput, disabled: uploadingPicture, style: styles({
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
                                                                            }), children: [_jsx(Camera, { size: 14 }), "Change"] }), profilePictureUrl && (_jsxs("button", { onClick: handlePictureDelete, disabled: uploadingPicture, style: styles({
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
                                                                            }), children: [_jsx(Trash2, { size: 14 }), "Delete"] }))] })] })] }), _jsx("input", { ref: fileInputRef, type: "file", accept: "image/*", onChange: handlePictureUpload, style: { display: 'none' } })] }), hrmEnabled && (_jsxs("div", { style: styles({ display: 'flex', flexDirection: 'column', gap: spacing.sm, paddingBottom: spacing.md, borderBottom: `1px solid ${colors.border.subtle}` }), children: [_jsxs("div", { style: styles({ display: 'flex', flexDirection: 'column', gap: spacing.xs }), children: [_jsx("div", { style: styles({ fontWeight: ts.label.fontWeight, fontSize: ts.body.fontSize }), children: "Employee name" }), _jsx("div", { style: styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted }), children: "If HRM is installed, this becomes the canonical display name across the ERP UI." })] }), _jsxs("label", { style: styles({ display: 'flex', flexDirection: 'column', gap: spacing.xs, fontSize: ts.bodySmall.fontSize }), children: [_jsx("span", { style: styles({ color: colors.text.secondary }), children: "Preferred name (optional)" }), _jsx("input", { type: "text", value: hrmForm.preferredName, onChange: (e) => setHrmForm((prev) => ({ ...prev, preferredName: e.target.value })), placeholder: "Optional", style: styles({
                                                                padding: `${spacing.sm} ${spacing.md}`,
                                                                borderRadius: radius.md,
                                                                border: `1px solid ${colors.border.default}`,
                                                                backgroundColor: colors.bg.page,
                                                                color: colors.text.primary,
                                                                fontSize: ts.body.fontSize,
                                                            }) })] }), _jsxs("div", { style: styles({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }), children: [_jsxs("label", { style: styles({ display: 'flex', flexDirection: 'column', gap: spacing.xs, fontSize: ts.bodySmall.fontSize }), children: [_jsx("span", { style: styles({ color: colors.text.secondary }), children: "First name *" }), _jsx("input", { type: "text", value: hrmForm.firstName, onChange: (e) => setHrmForm((prev) => ({ ...prev, firstName: e.target.value })), placeholder: "Required", style: styles({
                                                                        padding: `${spacing.sm} ${spacing.md}`,
                                                                        borderRadius: radius.md,
                                                                        border: `1px solid ${colors.border.default}`,
                                                                        backgroundColor: colors.bg.page,
                                                                        color: colors.text.primary,
                                                                        fontSize: ts.body.fontSize,
                                                                    }) })] }), _jsxs("label", { style: styles({ display: 'flex', flexDirection: 'column', gap: spacing.xs, fontSize: ts.bodySmall.fontSize }), children: [_jsx("span", { style: styles({ color: colors.text.secondary }), children: "Last name *" }), _jsx("input", { type: "text", value: hrmForm.lastName, onChange: (e) => setHrmForm((prev) => ({ ...prev, lastName: e.target.value })), placeholder: "Required", style: styles({
                                                                        padding: `${spacing.sm} ${spacing.md}`,
                                                                        borderRadius: radius.md,
                                                                        border: `1px solid ${colors.border.default}`,
                                                                        backgroundColor: colors.bg.page,
                                                                        color: colors.text.primary,
                                                                        fontSize: ts.body.fontSize,
                                                                    }) })] })] })] })), [...profileFieldMetadata]
                                            .sort((a, b) => a.display_order - b.display_order)
                                            .map((fieldMeta) => {
                                            const isAdmin = (currentUser?.roles || []).map((r) => String(r || '').toLowerCase()).includes('admin');
                                            const canEdit = isAdmin || fieldMeta.user_can_edit;
                                            // Email comes from currentUser.email, other fields from profileFields
                                            const fieldValue = fieldMeta.field_key === 'email'
                                                ? (currentUser?.email || '')
                                                : (profileFields[fieldMeta.field_key] || '');
                                            return (_jsxs("label", { style: styles({ display: 'flex', flexDirection: 'column', gap: spacing.xs, fontSize: ts.bodySmall.fontSize }), children: [_jsxs("span", { style: styles({ color: colors.text.secondary }), children: [fieldMeta.field_label, fieldMeta.required && _jsx("span", { style: styles({ color: colors.error.default }), children: " *" })] }), _jsx("input", { type: fieldMeta.field_type === 'int' ? 'number' : fieldMeta.field_key === 'email' ? 'email' : 'text', value: fieldValue, onChange: (e) => {
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
                                                        }, placeholder: fieldMeta.required ? 'Required' : 'Optional', disabled: !canEdit || fieldMeta.field_key === 'email', required: fieldMeta.required, style: styles({
                                                            padding: `${spacing.sm} ${spacing.md}`,
                                                            borderRadius: radius.md,
                                                            border: `1px solid ${colors.border.default}`,
                                                            backgroundColor: (canEdit && fieldMeta.field_key !== 'email') ? colors.bg.page : colors.bg.muted,
                                                            color: colors.text.primary,
                                                            fontSize: ts.body.fontSize,
                                                            opacity: (canEdit && fieldMeta.field_key !== 'email') ? 1 : 0.6,
                                                            cursor: (canEdit && fieldMeta.field_key !== 'email') ? 'text' : 'not-allowed',
                                                        }) }), (!canEdit || fieldMeta.field_key === 'email') && (_jsx("span", { style: styles({ fontSize: ts.bodySmall.fontSize, color: colors.text.muted }), children: fieldMeta.field_key === 'email'
                                                            ? 'Email cannot be changed'
                                                            : 'This field can only be edited by administrators' }))] }, fieldMeta.field_key));
                                        }), _jsxs("label", { style: styles({ display: 'flex', flexDirection: 'column', gap: spacing.xs, fontSize: ts.bodySmall.fontSize }), children: [_jsx("span", { style: styles({ color: colors.text.secondary }), children: "New password" }), _jsx("input", { type: "password", value: profileForm.password, onChange: (e) => setProfileForm((prev) => ({ ...prev, password: e.target.value })), placeholder: "Optional", style: styles({
                                                        padding: `${spacing.sm} ${spacing.md}`,
                                                        borderRadius: radius.md,
                                                        border: `1px solid ${colors.border.default}`,
                                                        backgroundColor: colors.bg.page,
                                                        color: colors.text.primary,
                                                        fontSize: ts.body.fontSize,
                                                    }) })] }), _jsxs("label", { style: styles({ display: 'flex', flexDirection: 'column', gap: spacing.xs, fontSize: ts.bodySmall.fontSize }), children: [_jsx("span", { style: styles({ color: colors.text.secondary }), children: "Confirm password" }), _jsx("input", { type: "password", value: profileForm.confirmPassword, onChange: (e) => setProfileForm((prev) => ({ ...prev, confirmPassword: e.target.value })), placeholder: "Optional", style: styles({
                                                        padding: `${spacing.sm} ${spacing.md}`,
                                                        borderRadius: radius.md,
                                                        border: `1px solid ${colors.border.default}`,
                                                        backgroundColor: colors.bg.page,
                                                        color: colors.text.primary,
                                                        fontSize: ts.body.fontSize,
                                                    }) })] }), (profileStatus.error || profileStatus.success) && (_jsx("div", { style: styles({
                                                padding: `${spacing.sm} ${spacing.md}`,
                                                borderRadius: radius.md,
                                                backgroundColor: colors.bg.muted,
                                                color: profileStatus.error ? colors.error.default : colors.success.default,
                                                border: `1px solid ${profileStatus.error ? colors.error.default : colors.success.default}`,
                                            }), children: profileStatus.error || profileStatus.success })), _jsxs("div", { style: styles({ display: 'flex', justifyContent: 'flex-end', gap: spacing.sm }), children: [_jsx("button", { onClick: closeProfileModal, style: styles({
                                                        padding: `${spacing.sm} ${spacing.md}`,
                                                        borderRadius: radius.md,
                                                        border: `1px solid ${colors.border.default}`,
                                                        backgroundColor: colors.bg.page,
                                                        color: colors.text.primary,
                                                        cursor: 'pointer',
                                                    }), children: "Cancel" }), _jsx("button", { onClick: handleProfileSave, disabled: profileStatus.saving, style: styles({
                                                        padding: `${spacing.sm} ${spacing.lg}`,
                                                        borderRadius: radius.md,
                                                        border: 'none',
                                                        backgroundColor: colors.primary.default,
                                                        color: colors.text.inverse,
                                                        fontWeight: ts.label.fontWeight,
                                                        cursor: profileStatus.saving ? 'wait' : 'pointer',
                                                        opacity: profileStatus.saving ? 0.8 : 1,
                                                    }), children: profileStatus.saving ? 'Saving…' : 'Save changes' })] })] })] }) })] })), imageToCrop && (_jsx("div", { style: { position: 'fixed', inset: 0, zIndex: 200 }, children: _jsx(ProfilePictureCropModal, { open: cropModalOpen, onClose: () => {
                        setCropModalOpen(false);
                        setImageToCrop(null);
                    }, imageSrc: imageToCrop, onCropComplete: handleCropComplete }) }))] }));
}
export function DashboardShell({ children, config: configProp = {}, navItems = [], user = null, activePath = '/', onNavigate, onLogout, initialNotifications = [], connectionStatus = 'disconnected', version, }) {
    const debugNav = typeof window !== 'undefined' &&
        (() => {
            try {
                return window.localStorage.getItem('hit_debug_nav') === '1' || new URLSearchParams(window.location.search).has('debugNav');
            }
            catch {
                return false;
            }
        })();
    const debugIdRef = React.useRef(typeof window === 'undefined' ? 'ssr' : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
    React.useEffect(() => {
        if (!debugNav)
            return;
        const id = debugIdRef.current;
        console.log('[DashboardShell] MOUNT', { id, activePath, navItemsCount: Array.isArray(navItems) ? navItems.length : 0 });
        return () => console.log('[DashboardShell] UNMOUNT', { id });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    React.useEffect(() => {
        if (!debugNav)
            return;
        console.log('[DashboardShell] activePath', { id: debugIdRef.current, activePath });
    }, [activePath, debugNav]);
    const config = {
        brandName: configProp.brandName || 'HIT',
        logoUrl: configProp.logoUrl,
        sidebarPosition: configProp.sidebarPosition || 'left',
        showNotifications: configProp.showNotifications ?? true,
        showThemeToggle: configProp.showThemeToggle ?? false,
        showUserMenu: configProp.showUserMenu ?? true,
        defaultTheme: configProp.defaultTheme || 'system',
    };
    const providerDefaultTheme = config.defaultTheme === 'light' ? 'light' : config.defaultTheme === 'dark' ? 'dark' : 'dark';
    return (_jsx(ThemeProvider, { defaultTheme: providerDefaultTheme, children: _jsx(ShellContent, { config: config, navItems: navItems, user: user, activePath: activePath, onNavigate: onNavigate, onLogout: onLogout, initialNotifications: initialNotifications, connectionStatus: connectionStatus, version: version, children: children }) }));
}
export default DashboardShell;
