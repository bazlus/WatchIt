import Link from "next/link";
import { Suspense } from "react";
import { CategoriesMenu } from "./categories-menu";
import { SearchBox, SearchForm } from "./search-box";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Movie Recs
        </Link>
        {/* Search sits on its own row on phones and between logo and menu on wider screens. */}
        <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1">
          <Suspense fallback={<SearchForm />}>
            <SearchBox />
          </Suspense>
        </div>
        <div className="ml-auto sm:ml-0">
          <CategoriesMenu />
        </div>
      </div>
    </header>
  );
}
