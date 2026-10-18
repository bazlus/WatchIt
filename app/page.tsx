import { connection } from "next/server";
import { Suspense } from "react";
import { getCatalogStats, getPopularMovies } from "@/server/catalog/queries";
import { MovieGrid } from "./_components/movie-grid";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Popular movies</h1>
      <Suspense fallback={<p className="mt-6 text-zinc-500">Loading…</p>}>
        <PopularMovies />
      </Suspense>
    </main>
  );
}

async function PopularMovies() {
  await connection();
  const [stats, list] = await Promise.all([getCatalogStats(), getPopularMovies()]);

  if (!list.length) {
    return (
      <p className="mt-6 text-zinc-500">
        No movies yet. Run <code>npm run tmdb:sync -- initial --limit=200</code>.
      </p>
    );
  }

  return (
    <>
      <p className="mt-1 text-sm text-zinc-500">
        {stats.total} movies in the catalog, {stats.embedded} embedded.
      </p>
      <MovieGrid movies={list} />
    </>
  );
}
