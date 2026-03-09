import { z } from "zod";
import { accountNumberField } from "./fields.js";

export const createBudgetEntrySchema = z.object({
  accountNumber: accountNumberField,
  month: z.number().int().min(1).max(12),
  amount: z
    .number()
    .int()
    .refine((v) => v !== 0, { message: "Belopp får inte vara 0" }),
});

export const createBudgetSchema = z.object({
  fiscalYearId: z.string().uuid(),
  name: z.string().min(1).max(255),
  entries: z.array(createBudgetEntrySchema).min(1),
});

export const updateBudgetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  entries: z.array(createBudgetEntrySchema).min(1).optional(),
});
