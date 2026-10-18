-- Supabase convention: extensions live in the "extensions" schema, which is on the search_path.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
