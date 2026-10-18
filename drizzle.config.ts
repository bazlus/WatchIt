import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Fall back to variables already in the environment (CI, hosting).
}

export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./server/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  // Supabase owns the auth/storage/etc. schemas. We only manage public.
  schemaFilter: ["public"],
});
