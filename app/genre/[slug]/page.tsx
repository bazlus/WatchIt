import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { GENRES, genreFromSlug, genreSlug } from "@/server/catalog/genres";
import { getMoviesByGenre } from "@/server/catalog/queries";
import { MovieGrid } from "../../_components/movie-grid";

export function generateStaticParams() {
  return GENRES.map((g) => ({ slug: genreSlug(g) }));
}

export async function generateMetadata({ params }: PageProps<"/genre/[slug]">): Promise<Metadata> {
  const genre = genreFromSlug((await params).slug);
  return { title: genre ? `${genre} movies · Movie Recs` : "Movie Recs" };
}

export default function GenrePage({ params }: PageProps<"/genre/[slug]">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <GenreMovies params={params} />
      </Suspense>
    </main>
  );
}

async function GenreMovies({ params }: { params: PageProps<"/genre/[slug]">["params"] }) {
  const genre = genreFromSlug((await params).slug);
  if (!genre) notFound();

  await connection();
  const list = await getMoviesByGenre(genre);
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{genre}</h1>
      {list.length ? (
        <MovieGrid movies={list} />
      ) : (
        <p className="mt-6 text-zinc-500">No {genre.toLowerCase()} movies in the catalog yet.</p>
      )}
    </>
  );
}
