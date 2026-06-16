---
name: cluster-6
description: "Skill for the Cluster_6 area of TechNewsBoard. 4 symbols across 1 files."
---

# Cluster_6

4 symbols | 1 files | Cohesion: 86%

## When to Use

- Working with code in `lib/`
- Understanding how items work
- Modifying cluster_6-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/rss-parser.ts` | truncate, normalizeImageUrl, extractImage, items |

## Entry Points

Start here when exploring this area:

- **`items`** (Function) — `lib/rss-parser.ts:182`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `items` | Function | `lib/rss-parser.ts` | 182 |
| `truncate` | Function | `lib/rss-parser.ts` | 24 |
| `normalizeImageUrl` | Function | `lib/rss-parser.ts` | 29 |
| `extractImage` | Function | `lib/rss-parser.ts` | 45 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Items → NormalizeImageUrl` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Cluster_5 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "items"})` — see callers and callees
2. `gitnexus_query({query: "cluster_6"})` — find related execution flows
3. Read key files listed above for implementation details
