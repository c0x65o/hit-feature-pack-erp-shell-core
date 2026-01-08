import { z } from "zod";
// Schema-only module for:
// - POST /api/table-data/grouped-buckets
export const postBodySchema = z.object({
    tableId: z.string().min(1),
    columnKey: z.string().min(1),
    entityKind: z.string().min(1),
    pageSize: z.number().int().min(1).max(250).optional(),
    bucketPages: z.record(z.string(), z.number().int().min(1)).optional(),
});
