export type StaticTableViewFilterSpec = {
    field: string;
    operator: string;
    value?: any;
    valueType?: string;
    metadata?: any;
};
export type StaticTableViewSpec = {
    id: string;
    name: string;
    description?: string | null;
    isDefault?: boolean;
    columnVisibility?: any;
    sorting?: any;
    groupBy?: any;
    columnOrder?: string[] | null;
    /**
     * Web columns for this view - ordered list of column keys to show.
     * If specified, only these columns are visible (in this order).
     * Takes precedence over columnOrder and columnVisibility.
     */
    columns?: string[] | null;
    mobileColumns?: string[] | null;
    metadata?: any;
    filters?: StaticTableViewFilterSpec[];
};
export declare function getStaticViewsForTable(tableId: string): Array<{
    id: string;
    userId: string;
    tableId: string;
    name: string;
    isDefault: boolean;
    isSystem: boolean;
    isShared: boolean;
    columnVisibility: any;
    sorting: any;
    groupBy: any;
    /**
     * Web columns for this view - ordered list of column keys to show.
     * If specified, only these columns are visible (in this order).
     */
    columns: string[] | null;
    columnOrder: string[] | null;
    mobileColumns: string[] | null;
    description: string | null;
    metadata: any;
    createdAt: Date;
    updatedAt: Date;
    lastUsedAt: Date | null;
    filters: Array<{
        id: string;
        viewId: string;
        field: string;
        operator: string;
        value: any;
        valueType: string | null;
        metadata: any;
        sortOrder: number;
    }>;
}>;
export declare function getStaticViewById(viewId: string): {
    id: string;
    userId: string;
    tableId: string;
    name: string;
    isDefault: boolean;
    isSystem: boolean;
    isShared: boolean;
    columnVisibility: any;
    sorting: any;
    groupBy: any;
    /**
     * Web columns for this view - ordered list of column keys to show.
     * If specified, only these columns are visible (in this order).
     */
    columns: string[] | null;
    columnOrder: string[] | null;
    mobileColumns: string[] | null;
    description: string | null;
    metadata: any;
    createdAt: Date;
    updatedAt: Date;
    lastUsedAt: Date | null;
    filters: Array<{
        id: string;
        viewId: string;
        field: string;
        operator: string;
        value: any;
        valueType: string | null;
        metadata: any;
        sortOrder: number;
    }>;
} | null;
export declare function isStaticViewId(viewId: string): boolean;
//# sourceMappingURL=static-table-views.d.ts.map