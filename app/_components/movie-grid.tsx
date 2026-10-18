import Image from "next/image";
import { posterUrl, type MovieCard } from "@/server/catalog/queries";

export function MovieGrid({ movies }: { movies: MovieCard[] }) {
  return (
    <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
      {movies.map((m) => (
        <li key={m.id}>
          <div className="relative aspect-[2/3] overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
            {m.posterPath && (
              <Image
                src={posterUrl(m.posterPath)}
                alt=""
                fill
                sizes="(min-width: 1024px) 160px, (min-width: 640px) 25vw, 50vw"
                className="object-cover"
              />
            )}
          </div>
          <p className="mt-2 text-sm font-medium leading-tight">{m.title}</p>
          <p className="text-xs text-zinc-500">
            {m.releaseYear ?? "—"}
            {m.voteAverage ? ` · ${m.voteAverage.toFixed(1)}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
