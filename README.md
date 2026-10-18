# Movie Recs

Movie recommendation web app. Design and decisions are in [PLAN.md](PLAN.md).

## Setup

Needs Node 22+ and Docker running.

```bash
npm install
cp .env.example .env.local      # then fill in TMDB_API_READ_TOKEN and VOYAGE_API_KEY
npm run db:start                # local Supabase (Postgres + pgvector + auth) in Docker
npm run db:migrate
npm run dev                     # http://localhost:3000
```

Local Supabase Studio (DB browser): http://127.0.0.1:54323. Stop the stack with `npm run db:stop`.

## Loading movies

```bash
npm run tmdb:sync -- initial --limit=200     # try a small batch first
npm run tmdb:sync -- initial                 # everything with popularity >= 3 (resumable)
npm run embed -- --dry-run                   # shows sample texts and estimated cost
npm run embed
```

Without a payment method on Voyage (3 requests / 10K tokens per minute), use
`npm run embed -- --batch-size=45 --delay-ms=21000`.

Keep the catalog fresh (run daily):

```bash
npm run tmdb:sync -- changes --days=2
npm run tmdb:sync -- stale                   # TMDB terms: cached data max 6 months
npm run embed                                # re-embeds movies whose text changed
```

## Layout

- `app/`: Next.js pages (UI).
- `server/db/`: Drizzle schema, client, migrations. Change `schema.ts`, then `npm run db:generate` and `npm run db:migrate`.
- `server/tmdb/`: TMDB API client and DB upsert.
- `server/embeddings/`: Voyage client and the text we embed per movie.
- `server/catalog/`: queries used by pages.
- `scripts/`: CLI jobs (sync, embed).

The browser never talks to the database. Only server code does. All tables have RLS enabled
with no policies, which blocks Supabase's public REST API.
