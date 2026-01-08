import { z } from "zod";
export declare const putBodySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    filters: z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        operator: z.ZodString;
        value: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
        valueType: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        metadata: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
    }, z.core.$strip>>>;
    columnVisibility: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
    sorting: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
    groupBy: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
    isDefault: z.ZodOptional<z.ZodBoolean>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
}, z.core.$strip>;
//# sourceMappingURL=table-views-id.schema.d.ts.map