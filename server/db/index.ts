import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// Reuse one connection pool across Next.js dev hot reloads.
const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };

const client =
  globalForDb.pgClient ??
  postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    // Supabase's transaction pooler (port 6543) does not support prepared statements.
    prepare: !url.includes(":6543"),
  });

if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export const closeDb = () => client.end();
export { schema };
