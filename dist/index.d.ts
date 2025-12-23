/**
 * @hit/feature-pack-dashboard-shell
 *
 * Dashboard shell with sidebar, topbar, notifications, and theme support.
 * Designed to match the erp-mini-dashboard reference design.
 *
 * Includes:
 * - ERP-style UI Kit implementation for feature packs to use via useUi()
 * - Table Views system for user-customizable data table views
 */
export { DashboardShell, useShell } from './components/DashboardShell';
export { erpKit } from './kit';
export { useUi, UiKitProvider } from '@hit/ui-kit';
export declare const FILTER_OPERATORS: readonly ["eq", "neq", "gt", "gte", "lt", "lte", "contains", "starts_with", "ends_with", "in", "not_in", "is_null", "is_not_null"];
export declare const FILTER_VALUE_TYPES: readonly ["string", "number", "boolean", "date", "array"];
export type FilterOperator = typeof FILTER_OPERATORS[number];
export type FilterValueType = typeof FILTER_VALUE_TYPES[number];
export type { NavItem, ShellConfig, ShellUser, Notification, ShellState, ConnectionStatus, } from './types';
//# sourceMappingURL=index.d.ts.map