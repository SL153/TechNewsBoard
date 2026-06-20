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

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **TechNewsBoard** (712 symbols, 1090 relationships, 46 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/TechNewsBoard/context` | Codebase overview, check index freshness |
| `gitnexus://repo/TechNewsBoard/clusters` | All functional areas |
| `gitnexus://repo/TechNewsBoard/processes` | All execution flows |
| `gitnexus://repo/TechNewsBoard/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
