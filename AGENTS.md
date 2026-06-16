# TechNewsBoard — Agent Instructions

## Mandatory Tools

**You MUST use both AgentMemory and GitNexus for every session.** These are not optional — they preserve context across sessions and prevent unsafe code changes.

- **AgentMemory**: Save all decisions, patterns, and insights. Recall context before working on unfamiliar areas.
- **GitNexus**: Run impact analysis before editing any symbol. Detect changes before committing.

See the `## AgentMemory` and `<!-- gitnexus:start -->` sections below for full rules.

---

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

## AgentMemory — Session Memory (MANDATORY)

**You MUST use agentmemory for all session context and long-term knowledge.** Never rely solely on conversation history.

### Always Do

- **MUST save important decisions, insights, and patterns to memory.** Use `agentmemory_memory_save` whenever you make a decision, discover a pattern, or learn something that will be needed in future sessions.
- **MUST recall context before working on unfamiliar areas.** Use `agentmemory_memory_recall` or `agentmemory_memory_smart_search` before modifying code you haven't worked with recently.
- **MUST save file modifications and their reasons.** When you edit a file, save what changed and why so future sessions understand the rationale.
- **MUST use memory types correctly:** `pattern` for recurring behaviors, `preference` for user choices, `architecture` for structural decisions, `bug` for known issues and fixes, `workflow` for process steps, `fact` for static information.

### Never Do

- NEVER skip saving important context just because the conversation is still active — sessions can be lost.
- NEVER assume you know how a file was modified without checking memory first.
- NEVER save trivial or redundant information that clutters memory.

### Tools

| Tool | Use for |
|------|---------|
| `agentmemory_memory_save` | Save decisions, patterns, insights to long-term memory |
| `agentmemory_memory_recall` | Search past sessions by keywords/concepts |
| `agentmemory_memory_smart_search` | Hybrid semantic + keyword search with progressive disclosure |
| `agentmemory_memory_export` | Export all memory as JSON for inspection |
| `agentmemory_memory_audit` | View audit trail of memory operations |
| `agentmemory_memory_governance_delete` | Delete specific memories with audit trail |
| `agentmemory_memory_sessions` | List recent sessions and their status |

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **TechNewsBoard** (823 symbols, 1266 relationships, 47 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
| Work in the Components area (70 symbols) | `.claude/skills/generated/components/SKILL.md` |
| Work in the App area (21 symbols) | `.claude/skills/generated/app/SKILL.md` |
| Work in the Bookmarks area (12 symbols) | `.claude/skills/generated/bookmarks/SKILL.md` |
| Work in the Chat area (8 symbols) | `.claude/skills/generated/chat/SKILL.md` |
| Work in the News area (6 symbols) | `.claude/skills/generated/news/SKILL.md` |
| Work in the Cluster_16 area (6 symbols) | `.claude/skills/generated/cluster-16/SKILL.md` |
| Work in the Cluster_5 area (5 symbols) | `.claude/skills/generated/cluster-5/SKILL.md` |
| Work in the Cluster_6 area (4 symbols) | `.claude/skills/generated/cluster-6/SKILL.md` |
| Work in the Cluster_14 area (4 symbols) | `.claude/skills/generated/cluster-14/SKILL.md` |

<!-- gitnexus:end -->
