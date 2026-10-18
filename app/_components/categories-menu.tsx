"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GENRES, genreSlug } from "@/server/catalog/genres";

export function CategoriesMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close on outside click and Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        Categories
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className="absolute right-0 z-20 mt-1 grid w-72 grid-cols-2 gap-x-2 rounded-md border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          {GENRES.map((g) => {
            const href = `/genre/${genreSlug(g)}`;
            const active = pathname === href;
            return (
              <li key={g}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`block rounded px-2 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${active ? "font-semibold" : "text-zinc-600 dark:text-zinc-300"}`}
                >
                  {g}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
