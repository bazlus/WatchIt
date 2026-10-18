import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { credits, movies, movieTranslations, people } from "../db/schema";
import type { TmdbMovie } from "./client";

const CAST_LIMIT = 10;
const WRITER_JOBS = new Set(["Screenplay", "Writer"]);

function translationLangs(): Set<string> {
  return new Set(
    (process.env.TRANSLATION_LANGS ?? "")
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean),
  );
}

// Writes one TMDB movie with its credits and translations. Returns our movie id.
export async function upsertMovie(m: TmdbMovie): Promise<number> {
  const releaseDate = m.release_date || null;
  const row = {
    tmdbId: m.id,
    imdbId: m.imdb_id || null,
    title: m.title,
    originalTitle: m.original_title,
    originalLanguage: m.original_language,
    releaseDate,
    releaseYear: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
    runtimeMin: m.runtime || null,
    genres: m.genres.map((g) => g.name),
    keywords: m.keywords?.keywords.map((k) => k.name) ?? [],
    overview: m.overview || null,
    tagline: m.tagline || null,
    posterPath: m.poster_path,
    backdropPath: m.backdrop_path,
    voteCount: m.vote_count ?? 0,
    voteAverage: m.vote_average,
    popularity: m.popularity,
    tmdbSyncedAt: new Date(),
  };

  const castRows = (m.credits?.cast ?? [])
    .filter((c) => c.order < CAST_LIMIT)
    .map((c) => ({ tmdbId: c.id, name: c.name, profilePath: c.profile_path, role: "cast", character: c.character, castOrder: c.order }));
  const crewRows = (m.credits?.crew ?? []).flatMap((c) => {
    const role = c.job === "Director" ? "director" : WRITER_JOBS.has(c.job) ? "writer" : null;
    return role ? [{ tmdbId: c.id, name: c.name, profilePath: c.profile_path, role, character: null, castOrder: null }] : [];
  });
  // A person can appear twice with the same role (e.g. both "Screenplay" and "Writer").
  const creditRows = [...new Map([...castRows, ...crewRows].map((c) => [`${c.tmdbId}:${c.role}`, c])).values()];

  const langs = translationLangs();
  const translationRows = new Map<string, { title: string | null; overview: string | null }>();
  for (const t of m.translations?.translations ?? []) {
    if (!langs.has(t.iso_639_1) || translationRows.has(t.iso_639_1)) continue;
    const title = t.data.title || null;
    const overview = t.data.overview || null;
    if (title || overview) translationRows.set(t.iso_639_1, { title, overview });
  }

  return db.transaction(async (tx) => {
    const [{ id: movieId }] = await tx
      .insert(movies)
      .values(row)
      .onConflictDoUpdate({
        target: movies.tmdbId,
        set: {
          ...Object.fromEntries(
            (Object.keys(row) as (keyof typeof row)[])
              .filter((k) => k !== "tmdbId")
              .map((k) => [k, sql.raw(`excluded."${movies[k].name}"`)]),
          ),
          // Mark for re-embedding when the text we embed has changed.
          embeddingModel: sql`CASE WHEN
              ${movies.title} IS DISTINCT FROM excluded.title
              OR ${movies.overview} IS DISTINCT FROM excluded.overview
              OR ${movies.genres} IS DISTINCT FROM excluded.genres
              OR ${movies.keywords} IS DISTINCT FROM excluded.keywords
              OR ${movies.releaseYear} IS DISTINCT FROM excluded.release_year
            THEN NULL ELSE ${movies.embeddingModel} END`,
        },
      })
      .returning({ id: movies.id });

    await tx.delete(credits).where(eq(credits.movieId, movieId));
    if (creditRows.length) {
      // Sorted so concurrent transactions lock people rows in the same order (avoids deadlocks).
      const uniquePeople = [...new Map(creditRows.map((c) => [c.tmdbId, c])).values()].sort(
        (a, b) => a.tmdbId - b.tmdbId,
      );
      const personIds = await tx
        .insert(people)
        .values(uniquePeople.map((p) => ({ tmdbId: p.tmdbId, name: p.name, profilePath: p.profilePath })))
        .onConflictDoUpdate({
          target: people.tmdbId,
          set: { name: sql`excluded.name`, profilePath: sql`excluded.profile_path` },
        })
        .returning({ id: people.id, tmdbId: people.tmdbId });
      const idByTmdb = new Map(personIds.map((p) => [p.tmdbId, p.id]));

      await tx.insert(credits).values(
        creditRows.map((c) => ({
          movieId,
          personId: idByTmdb.get(c.tmdbId)!,
          role: c.role,
          character: c.character,
          castOrder: c.castOrder,
        })),
      );
    }

    await tx.delete(movieTranslations).where(eq(movieTranslations.movieId, movieId));
    if (translationRows.size) {
      await tx
        .insert(movieTranslations)
        .values([...translationRows].map(([lang, t]) => ({ movieId, lang, ...t })));
    }

    return movieId;
  });
}

export async function deleteMovieByTmdbId(tmdbId: number) {
  await db.delete(movies).where(eq(movies.tmdbId, tmdbId));
}
