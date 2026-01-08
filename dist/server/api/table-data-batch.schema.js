import { z } from "zod";
// Schema-only module for:
// - POST /api/table-data/batch
export const postBodySchema = z.object({
    tableId: z.string().min(1),
    ids: z.array(z.string()).max(1000),
});
