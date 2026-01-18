export type ViewFilter = {
    field: string;
    operator: string;
    value: any;
};
export type GroupByInput = {
    field?: string;
    orderBy?: 'auto' | 'value' | 'count' | 'relatedSortOrder';
    orderDirection?: 'asc' | 'desc';
};
export type GroupMetaResult = {
    tableId: string;
    groupBy: {
        field: string;
        orderBy?: 'auto' | 'value' | 'count' | 'relatedSortOrder';
        orderDirection?: 'asc' | 'desc';
    };
    groupCounts: Record<string, number>;
    groupOrder: string[];
    groups?: Array<{
        key: string;
        total: number;
        rows: any[];
    }>;
};
export type GroupMetaError = {
    error: string;
    status: number;
};
export declare function getEntityByTableId(tableId: string): {
    entityKey: string;
    spec: any;
} | null;
export declare function getTableFromSpec(spec: any): any | null;
export declare function buildTableGroupMeta(args: {
    tableId: string;
    groupBy: GroupByInput;
    filters?: ViewFilter[];
    filterMode?: 'all' | 'any';
    search?: string;
    includeRows?: boolean;
    groupPageSize?: number;
    view?: {
        sorting?: Array<{
            id?: string;
            desc?: boolean;
        }>;
    } | null;
    currentUserId?: string | null;
    entity?: {
        entityKey: string;
        spec: any;
    } | null;
    table?: any | null;
}): Promise<GroupMetaResult | GroupMetaError>;
//# sourceMappingURL=tableGroupMeta.d.ts.map