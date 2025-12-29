import { z } from "zod";

// Schema-only module for:
// - POST /api/table-views/[id]/shares

export const postBodySchema = z.object({
  principalType: z.enum(["user", "group", "role"]),
  principalId: z.string().min(1),
});
