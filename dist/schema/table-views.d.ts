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
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
/**
 * Table Views Table
 * Stores user-defined views for data tables (e.g., "projects", "crm.companies")
 */
export declare const tableViews: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "table_views";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "table_views";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        userId: import("drizzle-orm/pg-core").PgColumn<{
            name: "user_id";
            tableName: "table_views";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        tableId: import("drizzle-orm/pg-core").PgColumn<{
            name: "table_id";
            tableName: "table_views";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        name: import("drizzle-orm/pg-core").PgColumn<{
            name: "name";
            tableName: "table_views";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        isDefault: import("drizzle-orm/pg-core").PgColumn<{
            name: "is_default";
            tableName: "table_views";
            dataType: "boolean";
            columnType: "PgBoolean";
            data: boolean;
            driverParam: boolean;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        isSystem: import("drizzle-orm/pg-core").PgColumn<{
            name: "is_system";
            tableName: "table_views";
            dataType: "boolean";
            columnType: "PgBoolean";
            data: boolean;
            driverParam: boolean;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        isShared: import("drizzle-orm/pg-core").PgColumn<{
            name: "is_shared";
            tableName: "table_views";
            dataType: "boolean";
            columnType: "PgBoolean";
            data: boolean;
            driverParam: boolean;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        columnVisibility: import("drizzle-orm/pg-core").PgColumn<{
            name: "column_visibility";
            tableName: "table_views";
            dataType: "json";
            columnType: "PgJsonb";
            data: unknown;
            driverParam: unknown;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        sorting: import("drizzle-orm/pg-core").PgColumn<{
            name: "sorting";
            tableName: "table_views";
            dataType: "json";
            columnType: "PgJsonb";
            data: unknown;
            driverParam: unknown;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        groupBy: import("drizzle-orm/pg-core").PgColumn<{
            name: "group_by";
            tableName: "table_views";
            dataType: "json";
            columnType: "PgJsonb";
            data: unknown;
            driverParam: unknown;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        description: import("drizzle-orm/pg-core").PgColumn<{
            name: "description";
            tableName: "table_views";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        metadata: import("drizzle-orm/pg-core").PgColumn<{
            name: "metadata";
            tableName: "table_views";
            dataType: "json";
            columnType: "PgJsonb";
            data: unknown;
            driverParam: unknown;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "table_views";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        updatedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "updated_at";
            tableName: "table_views";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        lastUsedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "last_used_at";
            tableName: "table_views";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
/**
 * Table View Filters Table
 * Stores individual filter conditions for a view
 */
export declare const tableViewFilters: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "table_view_filters";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "table_view_filters";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        viewId: import("drizzle-orm/pg-core").PgColumn<{
            name: "view_id";
            tableName: "table_view_filters";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        field: import("drizzle-orm/pg-core").PgColumn<{
            name: "field";
            tableName: "table_view_filters";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        operator: import("drizzle-orm/pg-core").PgColumn<{
            name: "operator";
            tableName: "table_view_filters";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        value: import("drizzle-orm/pg-core").PgColumn<{
            name: "value";
            tableName: "table_view_filters";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        valueType: import("drizzle-orm/pg-core").PgColumn<{
            name: "value_type";
            tableName: "table_view_filters";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        metadata: import("drizzle-orm/pg-core").PgColumn<{
            name: "metadata";
            tableName: "table_view_filters";
            dataType: "json";
            columnType: "PgJsonb";
            data: unknown;
            driverParam: unknown;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        sortOrder: import("drizzle-orm/pg-core").PgColumn<{
            name: "sort_order";
            tableName: "table_view_filters";
            dataType: "number";
            columnType: "PgInteger";
            data: number;
            driverParam: string | number;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export declare const tableViewsRelations: import("drizzle-orm").Relations<"table_views", {
    filters: import("drizzle-orm").Many<"table_view_filters">;
}>;
export declare const tableViewFiltersRelations: import("drizzle-orm").Relations<"table_view_filters", {
    view: import("drizzle-orm").One<"table_views", true>;
}>;
export type TableView = InferSelectModel<typeof tableViews>;
export type TableViewFilter = InferSelectModel<typeof tableViewFilters>;
export type InsertTableView = InferInsertModel<typeof tableViews>;
export type InsertTableViewFilter = InferInsertModel<typeof tableViewFilters>;
/**
 * Filter operators supported by the view system
 */
export declare const FILTER_OPERATORS: {
    readonly EQUALS: "equals";
    readonly NOT_EQUALS: "notEquals";
    readonly CONTAINS: "contains";
    readonly NOT_CONTAINS: "notContains";
    readonly STARTS_WITH: "startsWith";
    readonly ENDS_WITH: "endsWith";
    readonly GREATER_THAN: "greaterThan";
    readonly LESS_THAN: "lessThan";
    readonly GREATER_THAN_OR_EQUAL: "greaterThanOrEqual";
    readonly LESS_THAN_OR_EQUAL: "lessThanOrEqual";
    readonly DATE_EQUALS: "dateEquals";
    readonly DATE_BEFORE: "dateBefore";
    readonly DATE_AFTER: "dateAfter";
    readonly DATE_BETWEEN: "dateBetween";
    readonly IN: "in";
    readonly NOT_IN: "notIn";
    readonly IS_TRUE: "isTrue";
    readonly IS_FALSE: "isFalse";
    readonly IS_NULL: "isNull";
    readonly IS_NOT_NULL: "isNotNull";
};
export type FilterOperator = (typeof FILTER_OPERATORS)[keyof typeof FILTER_OPERATORS];
/**
 * Value types for filters
 */
export declare const FILTER_VALUE_TYPES: {
    readonly STRING: "string";
    readonly NUMBER: "number";
    readonly DATE: "date";
    readonly BOOLEAN: "boolean";
    readonly ARRAY: "array";
};
export type FilterValueType = (typeof FILTER_VALUE_TYPES)[keyof typeof FILTER_VALUE_TYPES];
//# sourceMappingURL=table-views.d.ts.map