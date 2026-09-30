import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../generated/prisma/client.js";
import { OrganizationRepository } from "./organization.repository.js";

describe("OrganizationRepository", () => {
  it("creates an organization, initial accounts, and owner in one nested write", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const create = vi.fn().mockResolvedValue({
      id: "org-1",
      orgNumber: "5561234567",
      name: "Example AB",
      fiscalYearStartMonth: 1,
      createdAt: now,
      updatedAt: now,
    });
    const prisma = {
      organization: { create },
    } as unknown as PrismaClient;

    const result = await new OrganizationRepository(prisma).createWithInitialData(
      { orgNumber: "5561234567", name: "Example AB" },
      [{ number: "1930", name: "Företagskonto", type: "ASSET" }],
      "user-1",
    );

    expect(result.ok).toBe(true);
    expect(create).toHaveBeenCalledWith({
      data: {
        orgNumber: "5561234567",
        name: "Example AB",
        fiscalYearStartMonth: 1,
        accounts: {
          create: [{ number: "1930", name: "Företagskonto", type: "ASSET" }],
        },
        members: {
          create: { userId: "user-1", role: "OWNER" },
        },
      },
    });
  });
});
