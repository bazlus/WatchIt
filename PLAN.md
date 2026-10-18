# Movie recommendation app: plan

Last updated: 2026-10-18 (phase 1 skeleton done, first 200 movies imported)

## Goal

A web app similar to IMDb, focused on recommendations. Users take an onboarding test (interests and
movies they like), and we build a taste profile from it. Users can then ask for a genre, a "movie like X",
or describe what they want in natural language, and we recommend movies. Users can also log watched
movies and keep a watchlist.

Hobby project for now. It may become paid later, which affects data licensing (see Risks).

## Decisions so far

| Topic | Decision |
|---|---|
| Platform | Web only, responsive so it works on mobile browsers. No native apps for now. |
| Scope | Movies only. TV series may be added later as a separate type. |
| Languages | English plus other languages for search and UI. |
| Language | TypeScript across the app. Python only later, as an offline worker for model training. |
| App structure | One Next.js app. DB and recommendation logic live in a `server/` folder so they can be split out later. |
| Database | Postgres with pgvector, hosted on Supabase. |
| Auth | Supabase Auth. |
| DB access | Only from Next.js server code. The browser never queries the DB directly (no Supabase client-side table access, no RLS-based logic). |
| Movie data | TMDB API. |
| Embeddings | Voyage AI `voyage-4` (multilingual), 1024 dimensions, stored as `halfvec`. |
| LLM | Claude (small model, e.g. Haiku) to parse natural-language requests into structured filters and optionally re-rank and explain results. The LLM never invents movies. |

## Similar products to borrow ideas from

- **Letterboxd**: diary, ratings, watchlist, lists, reviews. Best reference for logging and watchlist UX.
- **Criticker**: taste compatibility between users and predicted ratings per movie.
- **MovieLens** (University of Minnesota): research recommender with a rate-movies onboarding. Its public dataset is useful for testing (non-commercial licence).
- **Trakt**: tracking and syncing.
- **JustWatch / Reelgood**: where a movie is streaming. Show this next to each recommendation.
- **Gnod / Movie-map**: "movies near this one" map.
- **Netflix onboarding**: "pick 3 you like" quick start.

## Features (v1)

1. Sign up / sign in.
2. Onboarding test: favourite genres and moods, then 20 to 30 well-known movies chosen to cover different tastes. Each is marked like, dislike, or haven't seen.
3. Movie pages: metadata, poster, cast, where to stream, "more like this".
4. Watched log with date and rating (love / like / dislike), like a Letterboxd diary.
5. Watchlist.
6. Personal recommendations feed, filterable by genre, year, and runtime.
7. Natural-language search ("slow atmospheric sci-fi with a sad ending", "like Interstellar but funnier").

## Stack

- **Next.js** (App Router, TypeScript). UI plus server code: route handlers, server actions, server components.
- **Drizzle ORM** (or Prisma) for typed DB access and migrations.
- **Supabase**: Postgres + pgvector + Auth. Used as hosted Postgres with auth.
- **Vercel** for hosting the Next.js app (Fly.io is the alternative).
- **Scheduled jobs**: TMDB sync and embedding of new or changed movies. Vercel Cron or Supabase `pg_cron` triggering a server route, or a GitHub Actions schedule.
- **Local dev**: Postgres with pgvector in Docker, or the Supabase CLI local stack.
- **Later**: a Python worker (nightly) for collaborative filtering. It reads ratings from Postgres and writes scores or vectors back. The web app only reads Postgres and never calls Python directly.

Request flow: browser → Next.js server code → Postgres. External APIs (TMDB, Voyage, Claude) are called only from server code.

## Data model (draft)

```sql
CREATE EXTENSION vector;

CREATE TABLE movies (
  id              serial PRIMARY KEY,
  tmdb_id         int UNIQUE NOT NULL,
  title           text NOT NULL,
  original_title  text,
  release_year    int,
  runtime_min     int,
  genres          text[],
  keywords        text[],
  overview        text,
  poster_path     text,
  vote_count      int,
  vote_average    real,
  popularity      real,
  embedding       halfvec(1024),
  embedding_model text,          -- e.g. 'voyage-4@1024'; re-embed when this changes
  tmdb_synced_at  timestamptz    -- TMDB terms: cached data must be refreshed within 6 months
);
CREATE INDEX ON movies USING hnsw (embedding halfvec_cosine_ops);

-- Localized titles/overviews for display (from TMDB translations)
CREATE TABLE movie_translations (
  movie_id  int REFERENCES movies(id),
  lang      text,                -- 'bg', 'de', ...
  title     text,
  overview  text,
  PRIMARY KEY (movie_id, lang)
);

-- People and credits (actor, director, writer) as join tables. No graph DB.
CREATE TABLE people  (id serial PRIMARY KEY, tmdb_id int UNIQUE, name text);
CREATE TABLE credits (movie_id int, person_id int, role text, PRIMARY KEY (movie_id, person_id, role));

-- User activity (user_id = Supabase auth user id)
CREATE TABLE ratings   (user_id uuid, movie_id int, rating smallint, source text, created_at timestamptz, PRIMARY KEY (user_id, movie_id));
CREATE TABLE watched   (id serial PRIMARY KEY, user_id uuid, movie_id int, watched_on date, note text);
CREATE TABLE watchlist (user_id uuid, movie_id int, added_at timestamptz, PRIMARY KEY (user_id, movie_id));
CREATE TABLE user_prefs (user_id uuid PRIMARY KEY, genres text[], moods text[], languages text[]);

-- Taste vectors, several per user (one per taste cluster)
CREATE TABLE user_taste (
  user_id  uuid,
  cluster  int,
  weight   real,                 -- share of the user's likes in this cluster
  taste    halfvec(1024),
  PRIMARY KEY (user_id, cluster)
);
```

## How recommendations work

### Embeddings in short

An embedding is a list of numbers produced by an embedding model, describing what a text means.
Similar texts get vectors that are close together. pgvector stores them in a column and sorts rows
by distance (`<=>` is cosine distance, smaller means more similar).

### What we embed per movie

One text per movie, in English:

```
Arrival (2016). Sci-fi, Drama. Director: Denis Villeneuve.
Keywords: alien contact, linguistics, time, grief.
A linguist is recruited to communicate with aliens who have landed...
```

Embed with `input_type: "document"`. Search queries use `input_type: "query"`. Because `voyage-4` is
multilingual, a query in another language can match the English movie text, so we embed only the
English version. Translations are stored for display only.

### Taste profile

- Weights: love = +2, like = +1, dislike = -0.5. Older ratings count somewhat less.
- One average vector blurs mixed tastes (horror + rom-coms ends up matching neither). So we cluster each user's liked movies with k-means into 3 to 5 groups and store one vector per cluster in `user_taste`.
- Recompute in TypeScript whenever the user rates or logs a movie.

### Recommendation query

1. For each taste cluster, take the nearest ~100 movies, with SQL filters: not watched, not disliked, `vote_count` above a threshold, plus any genre/year/runtime filters.
2. Merge the clusters in proportion to `weight`.
3. Re-rank in TypeScript: similarity + TMDB rating + popularity + a diversity penalty so results aren't all near-duplicates.
4. Later: blend in collaborative filtering scores from the Python worker.

Set `hnsw.iterative_scan` (pgvector 0.8+) so strict filters still return enough rows.

### "More like this"

Nearest neighbours of the movie's own vector, minus the movie itself and anything the user has watched.

### Natural-language search

1. Claude parses the request into JSON via tool use / structured output:
   `{ genres, exclude_genres, moods, year_min, year_max, max_runtime, reference_movies, free_text }`.
2. `reference_movies` are looked up by title and their stored vectors are used directly.
3. `free_text` is embedded with Voyage (`input_type: "query"`).
4. Vector results are combined with Postgres full-text search (`tsvector`) for exact terms like actor names or "heist", merged with reciprocal rank fusion.
5. Optional second Claude call: re-rank the top ~20 against the original request and write a one-line "why you'd like this" for each.
6. Cache parsed queries and results for common requests.

The non-LLM path (embedding + full-text only) is the fallback if the LLM call fails or for simple queries.
It handles descriptive queries well, but negation ("no horror") and comparisons ("but funnier") poorly.

### Onboarding test

- Step 1: pick genres and moods.
- Step 2: rate 20 to 30 well-known movies. Choose them so they cover different regions of the embedding space (e.g. one popular movie from each of ~25 clusters of the catalog), so each answer tells us something new.
- The profile is weak until a user has about 15 to 20 ratings. Onboarding has to cover that.

## Embedding model choice

Checked 2026-10-18:

| Model | Price per 1M tokens | Notes |
|---|---|---|
| Voyage `voyage-4` (chosen) | $0.06 | Multilingual. Dimensions 256/512/1024/2048. 200M free tokens. |
| Voyage `voyage-4-lite` | $0.02 | Same dims. Docs describe it as tuned for cost and latency and don't call it multilingual. |
| OpenAI `text-embedding-3-small` | $0.02 | Configurable dimensions. English-focused. |
| Google `gemini-embedding-001` | ~$0.15 (third-party listings) | Strong multilingual scores. |
| Open models: Qwen3-Embedding, BGE-M3 | self-hosted | Strong multilingual. Needs hosting. Option if API costs ever matter. |

Measured 2026-10-18: TMDB's export has 28,563 movies with popularity >= 3 (the sync default).
Our movie texts average ~150 tokens, so that catalog is ~4.3M tokens, far inside Voyage's 200M
free tokens. Query embeddings are negligible.

Voyage without a payment method is limited to 3 requests and 10K tokens per minute (confirmed by its
429 error). That is enough for small runs with `--batch-size=45 --delay-ms=21000`, which is ~2 minutes
per 200 movies, or ~5 hours for 28.5k. Adding a payment method removes the limit and the free tokens
still apply. The 429 message mentions free tokens for "Voyage series 3", while the pricing page lists
200M for voyage-4, so check the dashboard usage after the first big run.

Changing models later means re-embedding everything, which is cheap. Never mix vectors from different
models. `embedding_model` tracks this.

## Data sources and licensing

- **TMDB** (checked 2026-10-18):
  - Free licence is non-commercial. Charging users, using TMDB data to drive revenue, or training AI/ML systems on TMDB content needs a separate written agreement, possibly with fees.
  - Attribution required: TMDB logo (less prominent than our branding) and the notice that the product "uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB."
  - Cached data may not be kept longer than 6 months, and all TMDB content must be deleted if the licence ends. The sync job must refresh every movie within 6 months (`tmdb_synced_at`).
  - Watch-provider (streaming) data comes from JustWatch and needs JustWatch attribution.
- **MovieLens** dataset: non-commercial. OK for offline testing of recommendation quality only.
- **IMDb** datasets: non-commercial. Not planned.
- Store `tmdb_id` on everything so other sources can be added or swapped later.

## Phases

Status: phase 1 done (2026-10-18). See README.md for commands.


1. **Skeleton**: Next.js + Drizzle + Supabase (local), schema, TMDB sync script, embedding script.
2. **Catalog**: browse, search by title, movie pages, "more like this".
3. **Accounts**: auth, ratings, watched log, watchlist.
4. **Profile**: onboarding test, taste clusters, recommendation feed.
5. **Natural-language search**: Claude parsing + hybrid search + optional re-rank.
6. **Multilingual UI**: translations from TMDB, localized UI.
7. **Later**: Python collaborative-filtering worker, social features (follow, compare taste), TV series.

## Risks and open points

- **TMDB commercial licence**: needed before charging money. Cost unknown. Using TMDB content to build embeddings may count as "training AI/ML systems" under their terms, which should be asked about when negotiating.
- **Storage**: at popularity >= 3 (28.5k movies) vectors are ~58 MB plus a similar amount for the HNSW index, which should fit Supabase's free database size (500 MB, from memory, not checked). Going to 200k movies would be ~800 MB and need 512 dims or the paid tier.
- **Popularity sort**: TMDB `popularity` reflects what is trending now, so the first 200 imported are mostly 2025-2026 releases. Fine for the full sync, but the onboarding movie set should be picked by `vote_count` and spread across decades.
- **pgvector version**: latest upstream is 0.8.7 (2026-10-01). Hosts can lag. Check with `SELECT extversion FROM pg_extension WHERE extname = 'vector';` and make sure it's 0.8+ for iterative scans.
- **Cold start**: recommendations are weak until ~15 to 20 ratings per user.
- **LLM cost and model**: Claude model choice and prices not checked yet. Check before phase 5.
- Supabase Free tier limits and Vercel limits not checked yet.

## Sources

- Voyage AI pricing: https://docs.voyageai.com/docs/pricing
- Voyage AI embeddings docs: https://docs.voyageai.com/docs/embeddings
- OpenAI API pricing: https://developers.openai.com/api/docs/pricing
- TMDB API terms of use: https://www.themoviedb.org/api-terms-of-use
- pgvector changelog: https://github.com/pgvector/pgvector/blob/master/CHANGELOG.md
- Open embedding model comparisons (third-party): https://www.datallmlab.com/blog/best-embedding-models.html
- Gemini embedding pricing (third-party): https://www.getmaxim.ai/bifrost/llm-cost-calculator/provider/gemini/model/gemini-embedding-001
