import { z } from "zod";
import { accountNumberField, dateTransform } from "./fields.js";

export const createVoucherLineSchema = z.object({
  accountNumber: accountNumberField,
  debit: z.number().int().min(0),
  credit: z.number().int().min(0),
  description: z.string().optional(),
});

export const createVoucherSchema = z.object({
  fiscalYearId: z.string(),
  date: dateTransform,
  description: z.string().min(1).max(500),
  lines: z.array(createVoucherLineSchema).min(1),
  documentIds: z.array(z.string()).optional(),
  createdBy: z.string().max(100).optional(),
});
