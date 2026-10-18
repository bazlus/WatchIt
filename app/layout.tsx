import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "./_components/site-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Movie Recs",
  description: "Movie recommendations based on your taste",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        {children}
        {/* Required by the TMDB API terms of use. Add the TMDB logo here once the UI has branding. */}
        <footer className="px-4 py-6 text-center text-xs text-zinc-500">
          This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.
        </footer>
      </body>
    </html>
  );
}
