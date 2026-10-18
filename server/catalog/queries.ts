import "server-only";
import { and, cosineDistance, desc, ilike, isNotNull, notInArray, sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { db } from "../db";
import { movies } from "../db/schema";
import { embed } from "../embeddings/voyage";

const card = {
  id: movies.id,
  title: movies.title,
  releaseYear: movies.releaseYear,
  posterPath: movies.posterPath,
  voteAverage: movies.voteAverage,
};
export type MovieCard = { id: number; title: string; releaseYear: number | null; posterPath: string | null; voteAverage: number | null };

const byPopularity = [sql`${movies.popularity} DESC NULLS LAST`, desc(movies.voteCount)];

export async function getPopularMovies(limit = 24): Promise<MovieCard[]> {
  return db.select(card).from(movies).orderBy(...byPopularity).limit(limit);
}

export async function getMoviesByGenre(genre: string, limit = 48): Promise<MovieCard[]> {
  return db
    .select(card)
    .from(movies)
    .where(sql`${genre} = ANY(${movies.genres})`)
    .orderBy(...byPopularity)
    .limit(limit);
}

export async function getCatalogStats() {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      embedded: sql<number>`count(${movies.embedding})::int`,
    })
    .from(movies);
  return row;
}

// Query embeddings are cached so repeated searches don't use Voyage requests.
async function embedQuery(q: string): Promise<number[]> {
  "use cache";
  cacheLife("days");
  const { vectors } = await embed([q], "query");
  return vectors[0];
}

export type SearchResults = {
  titleMatches: MovieCard[];
  semantic: MovieCard[];
  semanticError: boolean;
};

// Title matches first, then movies whose embedding is closest to the query text.
export async function searchMovies(rawQuery: string): Promise<SearchResults> {
  const q = rawQuery.trim().slice(0, 200);
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const titleMatches = await db
    .select(card)
    .from(movies)
    .where(ilike(movies.title, pattern))
    .orderBy(...byPopularity)
    .limit(12);

  let semantic: MovieCard[] = [];
  let semanticError = false;
  try {
    const vector = await embedQuery(q.toLowerCase());
    const exclude = titleMatches.map((m) => m.id);
    semantic = await db
      .select(card)
      .from(movies)
      .where(and(isNotNull(movies.embedding), exclude.length ? notInArray(movies.id, exclude) : undefined))
      .orderBy(cosineDistance(movies.embedding, vector))
      .limit(24);
  } catch (err) {
    // Usually Voyage's rate limit. Title results still work.
    console.error("Semantic search failed:", err instanceof Error ? err.message : err);
    semanticError = true;
  }

  return { titleMatches, semantic, semanticError };
}

export const posterUrl = (path: string, size: "w185" | "w342" | "w500" = "w342") =>
  `https://image.tmdb.org/t/p/${size}${path}`;
