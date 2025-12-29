import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    principalType: z.ZodEnum<["user", "group", "role"]>;
    principalId: z.ZodString;
    permission: z.ZodDefault<z.ZodOptional<z.ZodEnum<["view", "full"]>>>;
}, "strip", z.ZodTypeAny, {
    principalType: "group" | "user" | "role";
    principalId: string;
    permission: "full" | "view";
}, {
    principalType: "group" | "user" | "role";
    principalId: string;
    permission?: "full" | "view" | undefined;
}>;
//# sourceMappingURL=dashboard-definitions-shares.schema.d.ts.map