/**
 * Table Views Schema
 *
 * Drizzle table definitions for user-customizable table views.
 * This schema enables users to save custom filters, column visibility, and sorting preferences.
 *
 * Core entities:
 * - table_views: User-defined views for data tables
 * - table_view_filters: Individual filter conditions within a view
 */

import {
  pgTable,
  varchar,
  text,
  timestamp,
  uuid,
  jsonb,
  index,
  boolean,
  integer,
} from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';

/**
 * Table Views Table
 * Stores user-defined views for data tables (e.g., "projects", "crm.companies")
 */
export const tableViews = pgTable(
  'table_views',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(), // User who owns this view
    tableId: varchar('table_id', { length: 255 }).notNull(), // e.g., "projects", "crm.companies"
    name: varchar('name', { length: 255 }).notNull(), // User-friendly name
    isDefault: boolean('is_default').default(false).notNull(), // System-provided default view
    isSystem: boolean('is_system').default(false).notNull(), // System view (cannot be deleted by user)
    isShared: boolean('is_shared').default(false).notNull(), // Whether this view can be shared with other users
    // View configuration
    columnVisibility: jsonb('column_visibility'), // Record<string, boolean> - which columns are visible
    sorting: jsonb('sorting'), // Array<{ id: string; desc: boolean }> - sort configuration
    groupBy: jsonb('group_by'), // { field: string; sortOrder?: string[] } - grouping configuration
    // Metadata
    description: text('description'), // Optional description
    metadata: jsonb('metadata'), // Additional metadata (e.g., view category, tags)
    // Audit fields
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at'), // Track when view was last used
  },
  (table) => ({
    userTableIdx: index('table_views_user_table_idx').on(table.userId, table.tableId),
    userIdIdx: index('table_views_user_id_idx').on(table.userId),
    tableIdIdx: index('table_views_table_id_idx').on(table.tableId),
    isDefaultIdx: index('table_views_is_default_idx').on(table.isDefault),
    isSystemIdx: index('table_views_is_system_idx').on(table.isSystem),
  })
);

/**
 * Table View Filters Table
 * Stores individual filter conditions for a view
 */
export const tableViewFilters = pgTable(
  'table_view_filters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    viewId: uuid('view_id')
      .references(() => tableViews.id, { onDelete: 'cascade' })
      .notNull(),
    field: varchar('field', { length: 255 }).notNull(), // Column/field name
    operator: varchar('operator', { length: 50 }).notNull(), // equals, contains, greaterThan, etc.
    value: text('value'), // Filter value (can be JSON string for complex values)
    valueType: varchar('value_type', { length: 50 }), // string, number, date, array, etc.
    // For complex filters (e.g., date ranges, multi-select)
    metadata: jsonb('metadata'), // Additional filter metadata
    sortOrder: integer('sort_order').default(0).notNull(), // Order of filters in the view
  },
  (table) => ({
    viewIdIdx: index('table_view_filters_view_id_idx').on(table.viewId),
    fieldIdx: index('table_view_filters_field_idx').on(table.field),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONS
// ─────────────────────────────────────────────────────────────────────────────

export const tableViewsRelations = relations(tableViews, ({ many }) => ({
  filters: many(tableViewFilters),
}));

export const tableViewFiltersRelations = relations(tableViewFilters, ({ one }) => ({
  view: one(tableViews, {
    fields: [tableViewFilters.viewId],
    references: [tableViews.id],
  }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// TYPES - Export for use in handlers and components
// ─────────────────────────────────────────────────────────────────────────────

export type TableView = InferSelectModel<typeof tableViews>;
export type TableViewFilter = InferSelectModel<typeof tableViewFilters>;

export type InsertTableView = InferInsertModel<typeof tableViews>;
export type InsertTableViewFilter = InferInsertModel<typeof tableViewFilters>;

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filter operators supported by the view system
 */
export const FILTER_OPERATORS = {
  // String operators
  EQUALS: 'equals',
  NOT_EQUALS: 'notEquals',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'notContains',
  STARTS_WITH: 'startsWith',
  ENDS_WITH: 'endsWith',
  // Number operators
  GREATER_THAN: 'greaterThan',
  LESS_THAN: 'lessThan',
  GREATER_THAN_OR_EQUAL: 'greaterThanOrEqual',
  LESS_THAN_OR_EQUAL: 'lessThanOrEqual',
  // Date operators
  DATE_EQUALS: 'dateEquals',
  DATE_BEFORE: 'dateBefore',
  DATE_AFTER: 'dateAfter',
  DATE_BETWEEN: 'dateBetween',
  // Array operators
  IN: 'in',
  NOT_IN: 'notIn',
  // Boolean operators
  IS_TRUE: 'isTrue',
  IS_FALSE: 'isFalse',
  // Null operators
  IS_NULL: 'isNull',
  IS_NOT_NULL: 'isNotNull',
} as const;

export type FilterOperator = (typeof FILTER_OPERATORS)[keyof typeof FILTER_OPERATORS];

/**
 * Value types for filters
 */
export const FILTER_VALUE_TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  DATE: 'date',
  BOOLEAN: 'boolean',
  ARRAY: 'array',
} as const;

export type FilterValueType = (typeof FILTER_VALUE_TYPES)[keyof typeof FILTER_VALUE_TYPES];

