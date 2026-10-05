import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

// Load the same .env files as Next.js when running Prisma from the CLI.
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

export default defineConfig({
  schema: "prisma/schema.prisma",
});
