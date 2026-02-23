import { z } from "zod";
import { nameField } from "./fields.js";

export const createOrganizationSchema = z.object({
  orgNumber: z.string().min(10).max(12),
  name: nameField,
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
});

export const updateOrganizationSchema = z.object({
  name: nameField.optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
});
