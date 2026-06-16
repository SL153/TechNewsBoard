---
name: cluster-14
description: "Skill for the Cluster_14 area of TechNewsBoard. 4 symbols across 1 files."
---

# Cluster_14

4 symbols | 1 files | Cohesion: 86%

## When to Use

- Working with code in `lib/`
- Understanding how fetchHackerNews, storyPromises work
- Modifying cluster_14-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/hacker-news.ts` | truncate, fetchWithTimeout, fetchHackerNews, storyPromises |

## Entry Points

Start here when exploring this area:

- **`fetchHackerNews`** (Function) — `lib/hacker-news.ts:22`
- **`storyPromises`** (Function) — `lib/hacker-news.ts:30`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `fetchHackerNews` | Function | `lib/hacker-news.ts` | 22 |
| `storyPromises` | Function | `lib/hacker-news.ts` | 30 |
| `truncate` | Function | `lib/hacker-news.ts` | 6 |
| `fetchWithTimeout` | Function | `lib/hacker-news.ts` | 11 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `GET → FetchWithTimeout` | cross_community | 3 |
| `GET → Truncate` | cross_community | 3 |

## How to Explore

1. `gitnexus_context({name: "fetchHackerNews"})` — see callers and callees
2. `gitnexus_query({query: "cluster_14"})` — find related execution flows
3. Read key files listed above for implementation details
