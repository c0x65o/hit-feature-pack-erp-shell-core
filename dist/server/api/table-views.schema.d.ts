import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    tableId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    filters: z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        operator: z.ZodString;
        value: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
        valueType: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        metadata: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        operator: string;
        field: string;
        metadata?: any;
        value?: any;
        valueType?: string | null | undefined;
    }, {
        operator: string;
        field: string;
        metadata?: any;
        value?: any;
        valueType?: string | null | undefined;
    }>, "many">>;
    columnVisibility: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
    sorting: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
    groupBy: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
    isDefault: z.ZodOptional<z.ZodBoolean>;
    isSystem: z.ZodOptional<z.ZodBoolean>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    tableId: string;
    metadata?: any;
    description?: string | null | undefined;
    isDefault?: boolean | undefined;
    isSystem?: boolean | undefined;
    columnVisibility?: any;
    sorting?: any;
    groupBy?: any;
    filters?: {
        operator: string;
        field: string;
        metadata?: any;
        value?: any;
        valueType?: string | null | undefined;
    }[] | undefined;
}, {
    name: string;
    tableId: string;
    metadata?: any;
    description?: string | null | undefined;
    isDefault?: boolean | undefined;
    isSystem?: boolean | undefined;
    columnVisibility?: any;
    sorting?: any;
    groupBy?: any;
    filters?: {
        operator: string;
        field: string;
        metadata?: any;
        value?: any;
        valueType?: string | null | undefined;
    }[] | undefined;
}>;
//# sourceMappingURL=table-views.schema.d.ts.map