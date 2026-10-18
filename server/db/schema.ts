import {
  date,
  halfvec,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";

export const EMBEDDING_DIMENSIONS = 1024;

// Every table has RLS enabled with no policies. Supabase exposes the public schema through its
// REST API, and RLS without policies blocks that path. Our server connects as the postgres
// role, which bypasses RLS.

// ---------- Catalog (synced from TMDB) ----------

export const movies = pgTable(
  "movies",
  {
    id: serial("id").primaryKey(),
    tmdbId: integer("tmdb_id").notNull().unique(),
    imdbId: text("imdb_id"),
    title: text("title").notNull(),
    originalTitle: text("original_title"),
    originalLanguage: text("original_language"),
    releaseDate: date("release_date"),
    releaseYear: integer("release_year"),
    runtimeMin: integer("runtime_min"),
    genres: text("genres").array().notNull().default([]),
    keywords: text("keywords").array().notNull().default([]),
    overview: text("overview"),
    tagline: text("tagline"),
    posterPath: text("poster_path"),
    backdropPath: text("backdrop_path"),
    voteCount: integer("vote_count").notNull().default(0),
    voteAverage: real("vote_average"),
    popularity: real("popularity"),
    embedding: halfvec("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    // e.g. "voyage-4@1024". Movies with a different value get re-embedded.
    embeddingModel: text("embedding_model"),
    // TMDB terms: cached data must not be older than 6 months.
    tmdbSyncedAt: timestamp("tmdb_synced_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("movies_embedding_idx").using("hnsw", t.embedding.op("halfvec_cosine_ops")),
    index("movies_vote_count_idx").on(t.voteCount),
    index("movies_synced_at_idx").on(t.tmdbSyncedAt),
  ],
).enableRLS();

// Localized title/overview for display. Embeddings use the English text only.
export const movieTranslations = pgTable(
  "movie_translations",
  {
    movieId: integer("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    lang: text("lang").notNull(), // ISO 639-1, e.g. "bg"
    title: text("title"),
    overview: text("overview"),
  },
  (t) => [primaryKey({ columns: [t.movieId, t.lang] })],
).enableRLS();

export const people = pgTable("people", {
  id: serial("id").primaryKey(),
  tmdbId: integer("tmdb_id").notNull().unique(),
  name: text("name").notNull(),
  profilePath: text("profile_path"),
}).enableRLS();

export const credits = pgTable(
  "credits",
  {
    movieId: integer("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // "cast" | "director" | "writer"
    character: text("character"),
    castOrder: smallint("cast_order"),
  },
  (t) => [
    primaryKey({ columns: [t.movieId, t.personId, t.role] }),
    index("credits_person_idx").on(t.personId),
  ],
).enableRLS();

// ---------- User data (user_id = Supabase auth.users.id) ----------

const userId = () =>
  uuid("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" });

const movieId = () =>
  integer("movie_id")
    .notNull()
    .references(() => movies.id, { onDelete: "cascade" });

// rating: 2 = love, 1 = like, -1 = dislike
export const ratings = pgTable(
  "ratings",
  {
    userId: userId(),
    movieId: movieId(),
    rating: smallint("rating").notNull(),
    source: text("source").notNull().default("manual"), // "onboarding" | "manual" | "log"
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.movieId] })],
).enableRLS();

// One row per viewing, so rewatches are separate entries.
export const watched = pgTable(
  "watched",
  {
    id: serial("id").primaryKey(),
    userId: userId(),
    movieId: movieId(),
    watchedOn: date("watched_on"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("watched_user_idx").on(t.userId, t.movieId)],
).enableRLS();

export const watchlist = pgTable(
  "watchlist",
  {
    userId: userId(),
    movieId: movieId(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.movieId] })],
).enableRLS();

export const userPrefs = pgTable("user_prefs", {
  userId: userId().primaryKey(),
  genres: text("genres").array().notNull().default([]),
  moods: text("moods").array().notNull().default([]),
  languages: text("languages").array().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

// Several taste vectors per user, one per cluster of liked movies.
export const userTaste = pgTable(
  "user_taste",
  {
    userId: userId(),
    cluster: smallint("cluster").notNull(),
    weight: real("weight").notNull(), // share of the user's likes in this cluster
    taste: halfvec("taste", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.cluster] })],
).enableRLS();
