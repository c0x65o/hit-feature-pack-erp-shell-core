import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    principalType: z.ZodEnum<{
        group: "group";
        role: "role";
        user: "user";
    }>;
    principalId: z.ZodString;
    permission: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        full: "full";
        view: "view";
    }>>>;
}, z.core.$strip>;
//# sourceMappingURL=dashboard-definitions-shares.schema.d.ts.map