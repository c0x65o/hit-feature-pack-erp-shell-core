import { NextRequest } from 'next/server';
type DbTableProvider = {
    kind: 'db_table';
    table: string;
    idColumn: string;
    idType?: 'uuid' | 'text';
    columns?: string[];
};
export type TableProvider = DbTableProvider;
export type TableProviderRegistry = Record<string, TableProvider>;
export declare function getTableProviderRegistryFromRequest(request: NextRequest): TableProviderRegistry;
export declare function requireTableProvider(reg: TableProviderRegistry, tableId: string): TableProvider | null;
export declare function buildDbTableBatchQuery(provider: DbTableProvider, ids: string[]): import("drizzle-orm").SQL<unknown>;
export {};
//# sourceMappingURL=table-providers.d.ts.map