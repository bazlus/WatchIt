import type { Metadata } from "next";
import { Suspense } from "react";
import { searchMovies } from "@/server/catalog/queries";
import { MovieGrid } from "../_components/movie-grid";

export const metadata: Metadata = { title: "Search · Movie Recs" };

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <Suspense fallback={<p className="text-zinc-500">Searching…</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  if (!q) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="mt-2 text-zinc-500">
          Type a title, or describe what you want to watch, like “slow atmospheric sci-fi with a sad ending”.
        </p>
      </>
    );
  }

  const { titleMatches, semantic, semanticError } = await searchMovies(q);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Results for “{q}”</h1>

      {titleMatches.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Title matches</h2>
          <MovieGrid movies={titleMatches} />
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Matching your description</h2>
        {semanticError ? (
          <p className="mt-2 text-sm text-zinc-500">
            Description search is unavailable right now. Please try again in a minute.
          </p>
        ) : semantic.length ? (
          <MovieGrid movies={semantic} />
        ) : (
          <p className="mt-2 text-sm text-zinc-500">No matches.</p>
        )}
      </section>
    </>
  );
}
