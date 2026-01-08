/**
 * @hit/feature-pack-erp-shell-core
 *
 * Dashboard shell with sidebar, topbar, notifications, and theme support.
 * Designed to match the erp-mini-dashboard reference design.
 *
 * Includes:
 * - ERP-style UI Kit implementation for feature packs to use via useUi()
 * - Table Views system for user-customizable data table views
 */
// Main component
export { DashboardShell, useShell } from './components/DashboardShell';
// UI Kit implementation (ERP style)
export { erpKit } from './kit';
// Re-export UI Kit context for feature packs
export { useUi, UiKitProvider } from '@hit/ui-kit';
// Schema exports - REMOVED from main index to avoid bundling drizzle-orm in client!
// Use: import { tableViews, ... } from '@hit/feature-pack-erp-shell-core/schema'
// Don't import from schema file at all - it pulls in drizzle-orm
// Filter operators and value types - defined inline to avoid pulling in schema file
export const FILTER_OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'starts_with', 'ends_with', 'in', 'not_in', 'is_null', 'is_not_null'];
export const FILTER_VALUE_TYPES = ['string', 'number', 'boolean', 'date', 'array'];
