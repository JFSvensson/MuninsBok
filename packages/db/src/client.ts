import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

/**
 * Lazy-initialized PrismaClient singleton.
 * Only connects when first accessed, allowing test modules to import
 * without requiring DATABASE_URL.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    if (!globalThis.__prisma) {
      globalThis.__prisma = createPrismaClient();
    }
    const value = Reflect.get(globalThis.__prisma, prop, receiver);
    return typeof value === "function" ? value.bind(globalThis.__prisma) : value;
  },
});

export { PrismaClient };
export type { Prisma } from "./generated/prisma/client.js";
