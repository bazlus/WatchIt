// Syncs movies from TMDB into Postgres.
//
//   npm run tmdb:sync -- initial [--min-popularity=3] [--limit=1000] [--refetch]
//       Reads TMDB's daily ID export and fetches every movie above the popularity threshold.
//       Skips movies already in the DB unless --refetch. Safe to re-run to resume or to pick up
//       new movies.
//   npm run tmdb:sync -- changes [--days=2]
//       Re-fetches movies in our DB that TMDB reports as changed in the last N days (max 14).
//   npm run tmdb:sync -- stale [--older-than-days=150] [--limit=5000]
//       Re-fetches movies not synced recently. TMDB's terms cap cached data at 6 months.
import { parseArgs } from "node:util";
import { inArray, lt, sql } from "drizzle-orm";
import pLimit from "p-limit";
import { closeDb, db } from "../server/db";
import { movies } from "../server/db/schema";
import { getChangedMovieIds, getMovieDetails, readMovieIdExport, TmdbNotFoundError } from "../server/tmdb/client";
import { deleteMovieByTmdbId, upsertMovie } from "../server/tmdb/upsert";

const CONCURRENCY = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    "min-popularity": { type: "string", default: "3" },
    limit: { type: "string" },
    refetch: { type: "boolean", default: false },
    days: { type: "string", default: "2" },
    "older-than-days": { type: "string", default: "150" },
  },
});

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

async function existingTmdbIds(ids: number[]): Promise<Set<number>> {
  const found = new Set<number>();
  for (let i = 0; i < ids.length; i += 10_000) {
    const rows = await db
      .select({ tmdbId: movies.tmdbId })
      .from(movies)
      .where(inArray(movies.tmdbId, ids.slice(i, i + 10_000)));
    rows.forEach((r) => found.add(r.tmdbId));
  }
  return found;
}

// Fetches and stores each movie. With deleteMissing, movies TMDB no longer has are removed.
async function syncIds(ids: number[], { deleteMissing }: { deleteMissing: boolean }) {
  const limit = pLimit(CONCURRENCY);
  let done = 0, failed = 0, removed = 0, skipped = 0;
  const started = Date.now();

  await Promise.all(
    ids.map((id) =>
      limit(async () => {
        try {
          const details = await getMovieDetails(id);
          if (details.adult) skipped++;
          else await withDeadlockRetry(() => upsertMovie(details));
        } catch (err) {
          if (err instanceof TmdbNotFoundError) {
            if (deleteMissing) {
              await deleteMovieByTmdbId(id);
              removed++;
            } else skipped++;
          } else {
            failed++;
            console.error(`tmdb_id=${id}:`, err instanceof Error ? err.message : err);
          }
        }
        if (++done % 500 === 0 || done === ids.length) {
          const rate = done / ((Date.now() - started) / 1000);
          console.log(`${done}/${ids.length} (${rate.toFixed(1)}/s) failed=${failed} removed=${removed} skipped=${skipped}`);
        }
      }),
    ),
  );
  return { failed };
}

async function withDeadlockRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "40P01" || i >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 100 * i));
    }
  }
}

async function initial() {
  const minPopularity = Number(values["min-popularity"]);
  // Today's export may not exist before ~08:00 UTC, so use yesterday's.
  const exportDate = new Date(Date.now() - DAY_MS);
  console.log(`Reading TMDB export for ${isoDate(exportDate)} (popularity >= ${minPopularity})...`);

  const candidates: { id: number; popularity: number }[] = [];
  for await (const line of readMovieIdExport(exportDate)) {
    if (!line.adult && !line.video && line.popularity >= minPopularity) {
      candidates.push({ id: line.id, popularity: line.popularity });
    }
  }
  candidates.sort((a, b) => b.popularity - a.popularity);

  let ids = candidates.map((c) => c.id);
  if (!values.refetch) {
    const existing = await existingTmdbIds(ids);
    ids = ids.filter((id) => !existing.has(id));
    console.log(`${candidates.length} movies above threshold, ${existing.size} already in DB.`);
  }
  if (values.limit) ids = ids.slice(0, Number(values.limit));

  console.log(`Fetching ${ids.length} movies...`);
  return syncIds(ids, { deleteMissing: false });
}

async function changes() {
  const days = Math.min(14, Number(values.days));
  const end = new Date();
  const start = new Date(end.getTime() - days * DAY_MS);
  const changed = await getChangedMovieIds(isoDate(start), isoDate(end));
  const ours = [...(await existingTmdbIds([...new Set(changed)]))];
  console.log(`${changed.length} changed on TMDB in the last ${days} days, ${ours.length} are in our DB.`);
  return syncIds(ours, { deleteMissing: true });
}

async function stale() {
  const cutoff = new Date(Date.now() - Number(values["older-than-days"]) * DAY_MS);
  const rows = await db
    .select({ tmdbId: movies.tmdbId })
    .from(movies)
    .where(lt(movies.tmdbSyncedAt, cutoff))
    .orderBy(movies.tmdbSyncedAt)
    .limit(Number(values.limit ?? 5000));
  console.log(`${rows.length} movies last synced before ${isoDate(cutoff)}.`);
  return syncIds(rows.map((r) => r.tmdbId), { deleteMissing: true });
}

async function main() {
  const mode = positionals[0];
  const run = { initial, changes, stale }[mode as "initial"];
  if (!run) {
    console.error("Usage: tmdb-sync <initial|changes|stale> [options]. See the header of scripts/tmdb-sync.ts.");
    process.exitCode = 1;
    return;
  }
  if (!process.env.TMDB_API_READ_TOKEN && !process.env.TMDB_API_KEY) {
    throw new Error("Set TMDB_API_READ_TOKEN or TMDB_API_KEY in .env.local (see .env.example)");
  }
  const { failed } = await run();
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(movies);
  console.log(`Done. Movies in DB: ${count}.`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closeDb);
