/**
 * @hit/feature-pack-dashboard-shell
 *
 * Dashboard shell with sidebar, topbar, notifications, and theme support.
 * Designed to match the erp-mini-dashboard reference design.
 *
 * Includes ERP-style UI Kit implementation for feature packs to use via useUi().
 */

// Main component
export { DashboardShell, useShell } from './components/DashboardShell';

// UI Kit implementation (ERP style)
export { erpKit } from './kit';

// Re-export UI Kit context for feature packs
export { useUi, UiKitProvider } from '@hit/ui-kit';

// Types
export type {
  NavItem,
  ShellConfig,
  ShellUser,
  Notification,
  ShellState,
  ConnectionStatus,
} from './types';
