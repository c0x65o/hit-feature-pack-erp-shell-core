import { z } from "zod";

// Schema-only module for:
// - POST /api/table-views

const filterSchema = z.object({
  field: z.string().min(1),
  operator: z.string().min(1),
  value: z.any().nullable().optional(),
  valueType: z.string().nullable().optional(),
  metadata: z.any().nullable().optional(),
});

export const postBodySchema = z.object({
  tableId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  filters: z.array(filterSchema).optional(),
  columnVisibility: z.any().nullable().optional(),
  sorting: z.any().nullable().optional(),
  groupBy: z.any().nullable().optional(),
  isDefault: z.boolean().optional(),
  isSystem: z.boolean().optional(),
  metadata: z.any().nullable().optional(),
});
