import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    principalType: z.ZodEnum<{
        group: "group";
        user: "user";
        role: "role";
    }>;
    principalId: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=table-views-shares.schema.d.ts.map