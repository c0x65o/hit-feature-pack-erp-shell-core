import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    visibility: z.ZodOptional<z.ZodEnum<["public", "private"]>>;
    scope: z.ZodOptional<z.ZodUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"global">;
    }, "strip", z.ZodTypeAny, {
        kind: "global";
    }, {
        kind: "global";
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"pack">;
        pack: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        pack: string;
        kind: "pack";
    }, {
        pack: string;
        kind: "pack";
    }>]>>;
    pack: z.ZodOptional<z.ZodString>;
    key: z.ZodOptional<z.ZodString>;
    definition: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    sourceKey: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    visibility?: "public" | "private" | undefined;
    key?: string | undefined;
    pack?: string | undefined;
    description?: string | undefined;
    definition?: Record<string, any> | undefined;
    scope?: {
        kind: "global";
    } | {
        pack: string;
        kind: "pack";
    } | undefined;
    sourceKey?: string | undefined;
}, {
    name: string;
    visibility?: "public" | "private" | undefined;
    key?: string | undefined;
    pack?: string | undefined;
    description?: string | undefined;
    definition?: Record<string, any> | undefined;
    scope?: {
        kind: "global";
    } | {
        pack: string;
        kind: "pack";
    } | undefined;
    sourceKey?: string | undefined;
}>;
export declare const getQuerySchema: z.ZodObject<{
    pack: z.ZodOptional<z.ZodString>;
    includeGlobal: z.ZodOptional<z.ZodEnum<["true", "false"]>>;
}, "strip", z.ZodTypeAny, {
    pack?: string | undefined;
    includeGlobal?: "false" | "true" | undefined;
}, {
    pack?: string | undefined;
    includeGlobal?: "false" | "true" | undefined;
}>;
//# sourceMappingURL=dashboard-definitions.schema.d.ts.map