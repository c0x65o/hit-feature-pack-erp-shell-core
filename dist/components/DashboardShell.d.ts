import React from 'react';
import type { NavItem, ShellUser, Notification, ShellConfig, ConnectionStatus } from '../types';
interface ShellContextType {
    menuOpen: boolean;
    setMenuOpen: (open: boolean) => void;
    expandedNodes: Set<string>;
    toggleNode: (id: string) => void;
}
export declare function useShell(): ShellContextType;
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
export declare function DashboardShell({ children, config: configProp, navItems, user, activePath, onNavigate, onLogout, initialNotifications, connectionStatus, version, }: DashboardShellProps): import("react/jsx-runtime").JSX.Element;
export default DashboardShell;
//# sourceMappingURL=DashboardShell.d.ts.map