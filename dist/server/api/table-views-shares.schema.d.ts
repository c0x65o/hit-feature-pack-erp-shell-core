import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    principalType: z.ZodEnum<{
        group: "group";
        user: "user";
        role: "role";
        location: "location";
        division: "division";
        department: "department";
    }>;
    principalId: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=table-views-shares.schema.d.ts.map