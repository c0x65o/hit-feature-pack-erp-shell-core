import React from 'react';
import type { NavItem, ShellUser, Notification, ShellConfig } from '../types';
interface ShellContextType {
    menuOpen: boolean;
    setMenuOpen: (open: boolean) => void;
    expandedNodes: Set<string>;
    toggleNode: (id: string) => void;
}
export declare function useShell(): ShellContextType;
type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'polling';
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
}
export declare function DashboardShell({ children, config: configProp, navItems, user, activePath, onNavigate, onLogout, initialNotifications, connectionStatus, }: DashboardShellProps): import("react/jsx-runtime").JSX.Element;
export default DashboardShell;
//# sourceMappingURL=DashboardShell.d.ts.map