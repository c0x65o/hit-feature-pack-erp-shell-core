import { z } from "zod";

// Schema-only module for:
// - PUT /api/table-views/[id]

const filterSchema = z.object({
  field: z.string().min(1),
  operator: z.string().min(1),
  value: z.any().nullable().optional(),
  valueType: z.string().nullable().optional(),
  metadata: z.any().nullable().optional(),
});

export const putBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  filters: z.array(filterSchema).optional(),
  columnVisibility: z.any().nullable().optional(),
  sorting: z.any().nullable().optional(),
  groupBy: z.any().nullable().optional(),
  isDefault: z.boolean().optional(),
  metadata: z.any().nullable().optional(),
});
