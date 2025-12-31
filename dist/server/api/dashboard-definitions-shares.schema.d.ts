import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    principalType: z.ZodEnum<{
        group: "group";
        user: "user";
        role: "role";
    }>;
    principalId: z.ZodString;
    permission: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        full: "full";
        view: "view";
    }>>>;
}, z.core.$strip>;
//# sourceMappingURL=dashboard-definitions-shares.schema.d.ts.map