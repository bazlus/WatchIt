"use client";

import Form from "next/form";
import { useSearchParams } from "next/navigation";

export function SearchBox() {
  const q = useSearchParams().get("q") ?? "";
  return <SearchForm key={q} defaultValue={q} />;
}

// Also used as the Suspense fallback, before search params are available.
export function SearchForm({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <Form action="/search" className="w-full" role="search">
      <input
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="Search by title or describe a movie…"
        aria-label="Search movies"
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400"
      />
    </Form>
  );
}
