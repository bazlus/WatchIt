// TMDB's movie genre list (GET /genre/movie/list). It rarely changes, so it is kept here
// instead of querying the DB for every page.
export const GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Science Fiction",
  "TV Movie",
  "Thriller",
  "War",
  "Western",
] as const;

export const genreSlug = (genre: string) => genre.toLowerCase().replace(/\s+/g, "-");

export const genreFromSlug = (slug: string) => GENRES.find((g) => genreSlug(g) === slug);
