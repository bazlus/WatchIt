// Embeds movies that have no embedding, or whose embedding is from another model or stale text.
//
//   npm run embed -- [--min-votes=20] [--limit=1000] [--batch-size=128] [--delay-ms=0] [--dry-run]
//
// Voyage accounts without a payment method are limited to 3 requests and 10K tokens per minute.
// For those, use --batch-size=50 --delay-ms=21000.
//
// --dry-run prints a few texts and an estimate of tokens and cost without calling Voyage.
import { parseArgs } from "node:util";
import { and, eq, gte, sql } from "drizzle-orm";
import { closeDb, db } from "../server/db";
import { movies } from "../server/db/schema";
import { movieEmbeddingText } from "../server/embeddings/movie-text";
import { embed, EMBEDDING_MODEL_TAG } from "../server/embeddings/voyage";

const PRICE_PER_MILLION_TOKENS = 0.06; // voyage-4, checked 2026-10-18

const { values } = parseArgs({
  options: {
    "min-votes": { type: "string", default: "20" },
    limit: { type: "string" },
    "batch-size": { type: "string", default: "128" },
    "delay-ms": { type: "string", default: "0" },
    "dry-run": { type: "boolean", default: false },
  },
});
const minVotes = Number(values["min-votes"]);
const limit = values.limit ? Number(values.limit) : Infinity;
const batchSize = Number(values["batch-size"]);
const delayMs = Number(values["delay-ms"]);

const needsEmbedding = and(
  gte(movies.voteCount, minVotes),
  sql`${movies.embeddingModel} IS DISTINCT FROM ${EMBEDDING_MODEL_TAG}`,
);

function fetchBatch(size: number, offset = 0) {
  return db
    .select({
      id: movies.id,
      title: movies.title,
      releaseYear: movies.releaseYear,
      genres: movies.genres,
      keywords: movies.keywords,
      overview: movies.overview,
      tagline: movies.tagline,
      // "movies.id" is written out because Drizzle renders ${movies.id} as a bare "id" in a
    // single-table select, which inside these subqueries would resolve to people.id.
    directors: sql<string[]>`coalesce((
        SELECT array_agg(p.name) FROM credits c JOIN people p ON p.id = c.person_id
        WHERE c.movie_id = movies.id AND c.role = 'director'), '{}')`,
      topCast: sql<string[]>`coalesce((
        SELECT (array_agg(p.name ORDER BY c.cast_order))[1:3] FROM credits c JOIN people p ON p.id = c.person_id
        WHERE c.movie_id = movies.id AND c.role = 'cast'), '{}')`,
    })
    .from(movies)
    .where(needsEmbedding)
    .orderBy(sql`${movies.popularity} DESC NULLS LAST`)
    .limit(size)
    .offset(offset);
}

async function dryRun() {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(movies).where(needsEmbedding);
  const sample = await fetchBatch(200);
  const texts = sample.map(movieEmbeddingText);
  texts.slice(0, 3).forEach((t) => console.log(`---\n${t}`));

  // Rough estimate: ~4 characters per token for English text.
  const avgTokens = texts.reduce((n, t) => n + t.length / 4, 0) / Math.max(1, texts.length);
  const total = Math.min(count, limit);
  const tokens = total * avgTokens;
  console.log(`---\n${total} movies to embed, ~${Math.round(avgTokens)} tokens each, ~${(tokens / 1e6).toFixed(1)}M tokens.`);
  console.log(`Estimated cost at $${PRICE_PER_MILLION_TOKENS}/1M: $${((tokens / 1e6) * PRICE_PER_MILLION_TOKENS).toFixed(2)} (before free tokens).`);
}

async function run() {
  let done = 0, tokens = 0;
  while (done < limit) {
    const batch = await fetchBatch(Math.min(batchSize, limit - done));
    if (!batch.length) break;
    if (done > 0 && delayMs) await new Promise((r) => setTimeout(r, delayMs));

    const { vectors, tokens: used } = await embed(batch.map(movieEmbeddingText), "document");
    await db.transaction(async (tx) => {
      for (let i = 0; i < batch.length; i++) {
        await tx
          .update(movies)
          .set({ embedding: vectors[i], embeddingModel: EMBEDDING_MODEL_TAG })
          .where(eq(movies.id, batch[i].id));
      }
    });
    done += batch.length;
    tokens += used;
    console.log(`Embedded ${done} movies, ${tokens} tokens so far.`);
  }
  console.log(`Done. ${done} movies, ${tokens} tokens (~$${((tokens / 1e6) * PRICE_PER_MILLION_TOKENS).toFixed(2)}).`);
}

(values["dry-run"] ? dryRun() : run())
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closeDb);
