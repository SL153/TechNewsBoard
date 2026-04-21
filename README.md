# TechNewsBoard

A real-time tech news dashboard that aggregates articles from RSS feeds, Hacker News, and GitHub Trending into a single clean interface.

## Features

- **Multi-source aggregation** — RSS feeds (TechCrunch, The Verge, Ars Technica, Wired, BBC, Reuters, MIT Tech Review, VentureBeat, Fast Company), Hacker News top stories, and GitHub Trending repos
- **Image extraction** — pulls embedded images from RSS content HTML with colored gradient fallbacks
- **Executive summary** — "Today's Top Stories" section highlighting the 5 most recent articles across all categories
- **Search & filter** — search by title/description, filter by category (Startups, Consumer Tech, Innovation), sort by date (newest/oldest)
- **Bookmarks** — save and manage articles via localStorage
- **Dark mode** — toggle between light and dark themes
- **Auto-refresh** — fetches new articles every 5 minutes

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

## Build & Deploy

```bash
npm run build   # production build
npm run start   # start production server
```

## Architecture

- **Next.js 16** App Router, React 19, ESM-only
- All pages are `'use client'` components
- Tailwind v4 via `@tailwindcss/postcss`
- TypeScript (`strict: false`) with path alias `@/*` → `./*`

## Data Sources

| Source | Method | Category |
|--------|--------|----------|
| RSS Feeds (8 sources) | `rss-parser` with retry + fallback URLs | Startups, Consumer Tech, Innovation |
| Hacker News | Firebase API (`/topstories.json`) | Startups |
| GitHub Trending | HTML scraping via regex (typescript, daily) | Innovation |

All sources return a unified `ParsedNewsItem[]` shape: `{ title, link, description, image, pubDate, category, source }`.

## Project Structure

```
app/
  layout.js          # Root layout with metadata
  page.js            # Main dashboard (client component)
  bookmarks/page.js  # Bookmarks page (client component)
  globals.css        # Tailwind import only
  api/news/route.ts  # API endpoint aggregating all sources
lib/
  news-sources.ts    # RSS feed definitions + categories
  rss-parser.ts      # RSS fetching with retry and fallback logic
  hacker-news.ts     # HN Firebase API fetcher
  github-trending.ts # GitHub Trending HTML scraper
```

## Configuration

- **Auto-refresh interval**: 5 minutes (`300000ms`) — adjustable in `app/page.js`
- **RSS timeouts**: configurable per feed via `timeout` property in `news-sources.ts`
- **HN timeout**: 15 seconds (`lib/hacker-news.ts`)
- **GitHub Trending**: TypeScript repos, daily timeframe

## Gotchas

- Bookmarks are stored in `localStorage` under key `technews-bookmarks` (browser-only)
- GitHub Trending parser uses regex on HTML — may break if GitHub changes markup
- Some RSS feeds (BBC Technology, MIT Technology Review, VentureBeat, The Information) have no fallback URLs
- All data fetching happens client-side via the `/api/news` route

## Deploy

This project deploys cleanly to any platform that supports Next.js:

- **Vercel** — zero-config, recommended
- **Netlify** — git-based deploy works out of the box
- **Docker** — build a container with `npm run build && npm run start`
- **Any Node host** — `npm install`, `npm run build`, `npm run start`
