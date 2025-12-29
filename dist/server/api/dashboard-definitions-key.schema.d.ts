import { z } from "zod";
export declare const putBodySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    visibility: z.ZodOptional<z.ZodEnum<["public", "private"]>>;
    definition: z.ZodOptional<z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    visibility?: "public" | "private" | undefined;
    description?: string | null | undefined;
    definition?: any;
}, {
    name?: string | undefined;
    visibility?: "public" | "private" | undefined;
    description?: string | null | undefined;
    definition?: any;
}>;
//# sourceMappingURL=dashboard-definitions-key.schema.d.ts.map