/**
 * Stub for @/lib/feature-pack-schemas
 * 
 * This is a type-only stub for feature pack compilation.
 * At runtime, the consuming application provides the actual implementation
 * via the generated lib/feature-pack-schemas.ts file.
 */

// Re-export schema tables from this feature pack
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
} from '../schema/table-views';

