import { PrismaClient } from "@prisma/client";
import { config } from "./index";
import logger from "../utils/logger";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const createPrismaClient = (): PrismaClient => {
  return new PrismaClient({
    log: config.app.isDev ? ["query", "error", "warn"] : ["error"],
  });
};

export const prisma: PrismaClient = global.__prisma ?? createPrismaClient();

if (config.app.isDev) {
  global.__prisma = prisma;
}

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info("PostgreSQL connected via Prisma");
  } catch (error) {
    logger.error("PostgreSQL connection failed", { error });
    process.exit(1);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
  logger.info("PostgreSQL disconnected");
};
