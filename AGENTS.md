# TechNewsBoard — Agent Instructions

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run start` — start production server

No lint, typecheck, or test scripts exist.

## Architecture
- Next.js 16 App Router, React 19, ESM-only (`"type": "module"`)
- All pages are `'use client'`; no server components used
- `app/` — pages: `layout.js`, `page.js` (main dashboard), `bookmarks/page.js`
- `lib/` — data sources: `rss-parser.ts`, `news-sources.ts`, `hacker-news.ts`, `github-trending.ts`

## Missing API route
The frontend calls `fetch('/api/news')` but **no `app/api/news/route.ts` exists**. The API route needs to be created, wiring together the `lib/` fetch functions (`rss-parser.ts`, `hacker-news.ts`, `github-trending.ts`) into a single endpoint.

## Style / conventions
- Tailwind v4 via `@tailwindcss/postcss` (no traditional config directives in CSS — only `@import "tailwindcss"`)
- Dark mode toggled via `document.documentElement.classList.add/remove('dark')`, not CSS media query
- Path alias: `@/*` → `./*` (tsconfig)
- TypeScript is `strict: false`; no ESLint or Prettier configured

## Data flow
1. `lib/news-sources.ts` defines RSS feeds + categories (`Startups`, `Consumer Tech`, `Innovation`)
2. `lib/rss-parser.ts` fetches + retries with fallback URLs for each feed
3. `lib/hacker-news.ts` fetches top 15 stories from HN Firebase API
4. `lib/github-trending.ts` scrapes GitHub Trending (typescript, daily) HTML via regex
5. All sources return `ParsedNewsItem[]` — unified shape: `{ title, link, description, pubDate, category, source }`

## Gotchas
- Bookmarks stored in `localStorage` under key `technews-bookmarks`
- Auto-refresh interval is 5 minutes (`300000ms`)
- GitHub Trending parser uses regex on HTML — fragile if GitHub changes markup
- RSS feeds have fallback URLs configured; some sources (BBC, MIT Tech Review) have none
