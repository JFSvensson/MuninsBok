import { z } from "zod";
import { nameField, dateTransform } from "./fields.js";

// ── Customer ────────────────────────────────────────────────

export const createCustomerSchema = z.object({
  name: nameField,
  email: z.string().email().max(255).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  postalCode: z.string().max(20).optional(),
  city: z.string().max(100).optional(),
  country: z.string().length(2).optional(),
  orgNumber: z.string().max(50).optional(),
  vatNumber: z.string().max(50).optional(),
  reference: z.string().max(255).optional(),
  paymentTermDays: z.number().int().min(0).max(365).optional(),
});

export const updateCustomerSchema = z.object({
  name: nameField.optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  postalCode: z.string().max(20).optional(),
  city: z.string().max(100).optional(),
  country: z.string().length(2).optional(),
  orgNumber: z.string().max(50).optional(),
  vatNumber: z.string().max(50).optional(),
  reference: z.string().max(255).optional(),
  paymentTermDays: z.number().int().min(0).max(365).optional(),
});

// ── Invoice ─────────────────────────────────────────────────

const invoiceLineSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().min(1),
  unitPrice: z.number().int().min(0),
  vatRate: z.number().int().min(0).max(10000),
  accountNumber: z.string().max(10).optional(),
});

export const createInvoiceSchema = z.object({
  customerId: z.string(),
  issueDate: dateTransform,
  dueDate: dateTransform,
  ourReference: z.string().max(255).optional(),
  yourReference: z.string().max(255).optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(invoiceLineSchema).min(1),
});

export const updateInvoiceSchema = z.object({
  customerId: z.string().optional(),
  issueDate: dateTransform.optional(),
  dueDate: dateTransform.optional(),
  ourReference: z.string().max(255).optional(),
  yourReference: z.string().max(255).optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(invoiceLineSchema).min(1).optional(),
});

export const invoiceStatusSchema = z.object({
  status: z.enum(["SENT", "PAID", "OVERDUE", "CANCELLED", "CREDITED"]),
  paidDate: dateTransform.optional(),
});
