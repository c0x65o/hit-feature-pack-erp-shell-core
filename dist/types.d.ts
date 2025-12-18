/**
 * WebSocket/real-time connection status
 */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'polling';
/**
 * Navigation group names
 */
export type NavGroup = 'main' | 'system' | string;
/**
 * Navigation item structure for sidebar tree
 */
export interface NavItem {
    id: string;
    label: string;
    path?: string;
    icon?: string;
    /** Optional feature flag name to gate visibility */
    featureFlag?: string;
    roles?: string[];
    showWhen?: 'authenticated' | 'unauthenticated' | 'always';
    /**
     * Child items (recursive).
     *
     * Note: children do not require stable ids at generation time; the shell assigns
     * deterministic ids at render-time for expansion state.
     */
    children?: Omit<NavItem, 'id'>[];
    /** Group this item belongs to (e.g., 'main', 'system') */
    group?: NavGroup;
    /** Sort weight within group (lower = higher in list) */
    weight?: number;
    /** Badge text or count to show */
    badge?: string | number;
}
/**
 * Shell configuration options
 */
/**
 * Primary color theme configuration
 */
export interface PrimaryColorConfig {
    default: string;
    hover: string;
    light: string;
    dark: string;
}
export interface ShellConfig {
    brandName: string;
    logoUrl?: string;
    sidebarPosition: 'left' | 'right';
    showNotifications: boolean;
    showThemeToggle: boolean;
    showUserMenu: boolean;
    defaultTheme: 'light' | 'dark' | 'system';
    /** Custom primary color (overrides default blue) */
    primaryColor?: PrimaryColorConfig;
}
/**
 * User information for profile menu
 */
export interface ShellUser {
    id?: string;
    email?: string;
    avatar?: string;
    roles?: string[];
}
/**
 * Notification item
 */
export interface Notification {
    id: string | number;
    type?: 'order' | 'inventory' | 'payment' | 'hr' | 'error' | 'system' | string;
    title: string;
    message: string;
    timestamp: Date | string;
    read: boolean;
    priority?: 'high' | 'medium' | 'low';
}
/**
 * Shell state (internal)
 */
export interface ShellState {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    toggleSidebar: () => void;
    theme: 'light' | 'dark';
    setTheme: (theme: 'light' | 'dark') => void;
    toggleTheme: () => void;
    expandedNavItems: Set<string>;
    toggleNavItem: (id: string) => void;
    config: ShellConfig;
    user: ShellUser | null;
    navItems: NavItem[];
}
//# sourceMappingURL=types.d.ts.map