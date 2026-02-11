import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Prevent multiple instances during development with hot reload
export const prisma = globalThis.prisma ?? new PrismaClient();

if (process.env["NODE_ENV"] !== "production") {
  globalThis.prisma = prisma;
}

export { PrismaClient };
export * from "@prisma/client";
