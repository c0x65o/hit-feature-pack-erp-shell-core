// This file exists for local dev / CI contexts where feature-pack schema generation
// is stubbed. Keep it minimal and aligned with `src/schema/table-views.ts`.

export {
  tableViews,
  tableViewFilters,
  tableViewShares,
  tableViewsRelations,
  tableViewFiltersRelations,
  tableViewSharesRelations,
  principalTypeEnum,
  type TableView,
  type TableViewFilter,
  type TableViewShare,
  type InsertTableView,
  type InsertTableViewFilter,
  type InsertTableViewShare,
  FILTER_OPERATORS,
  FILTER_VALUE_TYPES,
  type FilterOperator,
  type FilterValueType,
  // Notification reads
  notificationReads,
  type NotificationRead,
  type InsertNotificationRead,
} from '../schema/table-views';


