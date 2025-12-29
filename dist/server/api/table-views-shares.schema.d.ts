import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    principalType: z.ZodEnum<["user", "group", "role"]>;
    principalId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    principalType: "group" | "user" | "role";
    principalId: string;
}, {
    principalType: "group" | "user" | "role";
    principalId: string;
}>;
//# sourceMappingURL=table-views-shares.schema.d.ts.map