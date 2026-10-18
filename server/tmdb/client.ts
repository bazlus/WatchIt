// Minimal TMDB v3 client. Docs: https://developer.themoviedb.org/reference
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";

const API = "https://api.themoviedb.org/3";

export type TmdbMovie = {
  id: number;
  imdb_id: string | null;
  title: string;
  original_title: string | null;
  original_language: string | null;
  release_date: string | null; // "" when unknown
  runtime: number | null;
  genres: { id: number; name: string }[];
  overview: string | null;
  tagline: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_count: number;
  vote_average: number | null;
  popularity: number | null;
  adult: boolean;
  video: boolean;
  keywords?: { keywords: { id: number; name: string }[] };
  credits?: {
    cast: { id: number; name: string; character: string | null; order: number; profile_path: string | null }[];
    crew: { id: number; name: string; job: string; profile_path: string | null }[];
  };
  translations?: {
    translations: { iso_639_1: string; iso_3166_1: string; data: { title?: string; overview?: string } }[];
  };
};

export type TmdbExportLine = {
  id: number;
  original_title: string;
  popularity: number;
  adult: boolean;
  video: boolean;
};

export class TmdbNotFoundError extends Error {}

// TMDB allows roughly 40 requests/second. Space request starts to stay under that.
const MIN_INTERVAL_MS = 1000 / 35;
let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL_MS;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

async function tmdbGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  // Read access token goes in a header. The v3 API key goes in the query string.
  const token = process.env.TMDB_API_READ_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;
  if (!token && !apiKey) throw new Error("Set TMDB_API_READ_TOKEN or TMDB_API_KEY");

  const query = new URLSearchParams(token ? params : { ...params, api_key: apiKey! });
  const url = `${API}${path}?${query}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  for (let attempt = 1; ; attempt++) {
    await throttle();
    const res = await fetch(url, { headers });
    if (res.ok) return (await res.json()) as T;
    if (res.status === 404) throw new TmdbNotFoundError(path);

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 5) {
      // Log the path only, so the API key in the query string never ends up in logs.
      throw new Error(`TMDB ${res.status} for ${path}: ${await res.text()}`);
    }
    const retryAfter = Number(res.headers.get("retry-after")) || 2 ** attempt;
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
  }
}

export function getMovieDetails(tmdbId: number) {
  return tmdbGet<TmdbMovie>(`/movie/${tmdbId}`, {
    language: "en-US",
    append_to_response: "keywords,credits,translations",
  });
}

// IDs of movies changed in [startDate, endDate]. TMDB allows at most 14 days per query.
export async function getChangedMovieIds(startDate: string, endDate: string): Promise<number[]> {
  const ids: number[] = [];
  for (let page = 1; ; page++) {
    const res = await tmdbGet<{ results: { id: number }[]; total_pages: number }>("/movie/changes", {
      start_date: startDate,
      end_date: endDate,
      page: String(page),
    });
    ids.push(...res.results.map((r) => r.id));
    if (page >= res.total_pages) return ids;
  }
}

// Daily export of all movie IDs (newline-delimited JSON, gzipped).
// https://developer.themoviedb.org/docs/daily-id-exports
export async function* readMovieIdExport(date: Date): AsyncGenerator<TmdbExportLine> {
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const url = `https://files.tmdb.org/p/exports/movie_ids_${mm}_${dd}_${date.getUTCFullYear()}.json.gz`;

  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Export download failed (${res.status}): ${url}`);

  const lines = createInterface({
    input: Readable.fromWeb(res.body as import("node:stream/web").ReadableStream).pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (line.trim()) yield JSON.parse(line) as TmdbExportLine;
  }
}
