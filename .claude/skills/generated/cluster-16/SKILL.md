---
name: cluster-16
description: "Skill for the Cluster_16 area of TechNewsBoard. 6 symbols across 1 files."
---

# Cluster_16

6 symbols | 1 files | Cohesion: 94%

## When to Use

- Working with code in `lib/`
- Understanding how fetchGitHubTrending work
- Modifying cluster_16-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/github-trending.ts` | truncate, getLanguageGradient, extractLanguage, fetchWithTimeout, fetchGitHubApiFallback (+1) |

## Entry Points

Start here when exploring this area:

- **`fetchGitHubTrending`** (Function) — `lib/github-trending.ts:98`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `fetchGitHubTrending` | Function | `lib/github-trending.ts` | 98 |
| `truncate` | Function | `lib/github-trending.ts` | 8 |
| `getLanguageGradient` | Function | `lib/github-trending.ts` | 30 |
| `extractLanguage` | Function | `lib/github-trending.ts` | 39 |
| `fetchWithTimeout` | Function | `lib/github-trending.ts` | 54 |
| `fetchGitHubApiFallback` | Function | `lib/github-trending.ts` | 66 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `GET → FetchWithTimeout` | cross_community | 3 |
| `GET → ExtractLanguage` | cross_community | 3 |
| `GET → GetLanguageGradient` | cross_community | 3 |
| `GET → Truncate` | cross_community | 3 |

## How to Explore

1. `gitnexus_context({name: "fetchGitHubTrending"})` — see callers and callees
2. `gitnexus_query({query: "cluster_16"})` — find related execution flows
3. Read key files listed above for implementation details
