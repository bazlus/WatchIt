CREATE TABLE "credits" (
	"movie_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"role" text NOT NULL,
	"character" text,
	"cast_order" smallint,
	CONSTRAINT "credits_movie_id_person_id_role_pk" PRIMARY KEY("movie_id","person_id","role")
);
--> statement-breakpoint
ALTER TABLE "credits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "movie_translations" (
	"movie_id" integer NOT NULL,
	"lang" text NOT NULL,
	"title" text,
	"overview" text,
	CONSTRAINT "movie_translations_movie_id_lang_pk" PRIMARY KEY("movie_id","lang")
);
--> statement-breakpoint
ALTER TABLE "movie_translations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "movies" (
	"id" serial PRIMARY KEY NOT NULL,
	"tmdb_id" integer NOT NULL,
	"imdb_id" text,
	"title" text NOT NULL,
	"original_title" text,
	"original_language" text,
	"release_date" date,
	"release_year" integer,
	"runtime_min" integer,
	"genres" text[] DEFAULT '{}' NOT NULL,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"overview" text,
	"tagline" text,
	"poster_path" text,
	"backdrop_path" text,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"vote_average" real,
	"popularity" real,
	"embedding" halfvec(1024),
	"embedding_model" text,
	"tmdb_synced_at" timestamp with time zone NOT NULL,
	CONSTRAINT "movies_tmdb_id_unique" UNIQUE("tmdb_id")
);
--> statement-breakpoint
ALTER TABLE "movies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "people" (
	"id" serial PRIMARY KEY NOT NULL,
	"tmdb_id" integer NOT NULL,
	"name" text NOT NULL,
	"profile_path" text,
	CONSTRAINT "people_tmdb_id_unique" UNIQUE("tmdb_id")
);
--> statement-breakpoint
ALTER TABLE "people" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ratings" (
	"user_id" uuid NOT NULL,
	"movie_id" integer NOT NULL,
	"rating" smallint NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ratings_user_id_movie_id_pk" PRIMARY KEY("user_id","movie_id")
);
--> statement-breakpoint
ALTER TABLE "ratings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_prefs" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"genres" text[] DEFAULT '{}' NOT NULL,
	"moods" text[] DEFAULT '{}' NOT NULL,
	"languages" text[] DEFAULT '{}' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_prefs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_taste" (
	"user_id" uuid NOT NULL,
	"cluster" smallint NOT NULL,
	"weight" real NOT NULL,
	"taste" halfvec(1024) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_taste_user_id_cluster_pk" PRIMARY KEY("user_id","cluster")
);
--> statement-breakpoint
ALTER TABLE "user_taste" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "watched" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"movie_id" integer NOT NULL,
	"watched_on" date,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "watched" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "watchlist" (
	"user_id" uuid NOT NULL,
	"movie_id" integer NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watchlist_user_id_movie_id_pk" PRIMARY KEY("user_id","movie_id")
);
--> statement-breakpoint
ALTER TABLE "watchlist" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "credits" ADD CONSTRAINT "credits_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credits" ADD CONSTRAINT "credits_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_translations" ADD CONSTRAINT "movie_translations_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_prefs" ADD CONSTRAINT "user_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_taste" ADD CONSTRAINT "user_taste_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watched" ADD CONSTRAINT "watched_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watched" ADD CONSTRAINT "watched_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credits_person_idx" ON "credits" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "movies_embedding_idx" ON "movies" USING hnsw ("embedding" halfvec_cosine_ops);--> statement-breakpoint
CREATE INDEX "movies_vote_count_idx" ON "movies" USING btree ("vote_count");--> statement-breakpoint
CREATE INDEX "movies_synced_at_idx" ON "movies" USING btree ("tmdb_synced_at");--> statement-breakpoint
CREATE INDEX "watched_user_idx" ON "watched" USING btree ("user_id","movie_id");