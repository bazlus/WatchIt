export type MovieTextInput = {
  title: string;
  releaseYear: number | null;
  genres: string[];
  keywords: string[];
  overview: string | null;
  tagline: string | null;
  directors: string[];
  topCast: string[];
};

const MAX_KEYWORDS = 25;

// The English text we embed for each movie. Changing this format means re-embedding the
// catalog, so bump EMBEDDING_MODEL_TAG when you do.
export function movieEmbeddingText(m: MovieTextInput): string {
  const lines = [
    `${m.title}${m.releaseYear ? ` (${m.releaseYear})` : ""}.`,
    m.genres.length ? `Genres: ${m.genres.join(", ")}.` : "",
    m.directors.length ? `Director: ${m.directors.join(", ")}.` : "",
    m.topCast.length ? `Starring: ${m.topCast.join(", ")}.` : "",
    m.keywords.length ? `Keywords: ${m.keywords.slice(0, MAX_KEYWORDS).join(", ")}.` : "",
    m.tagline ?? "",
    m.overview ?? "",
  ];
  return lines.filter(Boolean).join("\n");
}
