---
name: news
description: "Skill for the News area of TechNewsBoard. 6 symbols across 3 files."
---

# News

6 symbols | 3 files | Cohesion: 78%

## When to Use

- Working with code in `lib/`
- Understanding how fetchFeedWithFallback, fetchAnthropicResearch, fetchKimiBlog work
- Modifying news-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/ai-blogs.ts` | truncate, fetchWithTimeout, fetchAnthropicResearch, fetchKimiBlog |
| `lib/rss-parser.ts` | fetchFeedWithFallback |
| `app/api/news/route.ts` | GET |

## Entry Points

Start here when exploring this area:

- **`fetchFeedWithFallback`** (Function) — `lib/rss-parser.ts:175`
- **`fetchAnthropicResearch`** (Function) — `lib/ai-blogs.ts:23`
- **`fetchKimiBlog`** (Function) — `lib/ai-blogs.ts:159`
- **`GET`** (Function) — `app/api/news/route.ts:7`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `fetchFeedWithFallback` | Function | `lib/rss-parser.ts` | 175 |
| `fetchAnthropicResearch` | Function | `lib/ai-blogs.ts` | 23 |
| `fetchKimiBlog` | Function | `lib/ai-blogs.ts` | 159 |
| `GET` | Function | `app/api/news/route.ts` | 7 |
| `truncate` | Function | `lib/ai-blogs.ts` | 7 |
| `fetchWithTimeout` | Function | `lib/ai-blogs.ts` | 12 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `GET → StripCDATA` | cross_community | 6 |
| `GET → FetchWithTimeout` | cross_community | 5 |
| `GET → FetchWithTimeout` | cross_community | 3 |
| `GET → Truncate` | cross_community | 3 |
| `GET → FetchWithTimeout` | cross_community | 3 |
| `GET → ExtractLanguage` | cross_community | 3 |
| `GET → GetLanguageGradient` | cross_community | 3 |
| `GET → Truncate` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Cluster_5 | 1 calls |
| Chat | 1 calls |
| Cluster_14 | 1 calls |
| Cluster_16 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "fetchFeedWithFallback"})` — see callers and callees
2. `gitnexus_query({query: "news"})` — find related execution flows
3. Read key files listed above for implementation details
