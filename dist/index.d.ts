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
export { tableViews, tableViewFilters, tableViewsRelations, tableViewFiltersRelations, FILTER_OPERATORS, FILTER_VALUE_TYPES, type TableView, type TableViewFilter, type InsertTableView, type InsertTableViewFilter, type FilterOperator, type FilterValueType, } from './schema/table-views';
export { dashboardDefinitions, dashboardDefinitionShares, dashboardDefinitionsRelations, dashboardDefinitionSharesRelations, type DashboardDefinition, type DashboardDefinitionShare, type InsertDashboardDefinition, type InsertDashboardDefinitionShare, } from './schema/table-views';
export type { NavItem, ShellConfig, ShellUser, Notification, ShellState, ConnectionStatus, } from './types';
//# sourceMappingURL=index.d.ts.map