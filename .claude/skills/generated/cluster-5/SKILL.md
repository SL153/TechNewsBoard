---
name: cluster-5
description: "Skill for the Cluster_5 area of TechNewsBoard. 5 symbols across 1 files."
---

# Cluster_5

5 symbols | 1 files | Cohesion: 80%

## When to Use

- Working with code in `lib/`
- Understanding how stripCDATA, fetchWithTimeout, parseRSSXML work
- Modifying cluster_5-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/rss-parser.ts` | stripCDATA, fetchWithTimeout, parseRSSXML, fetchRSSFeed, fetchWithRetry |

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `stripCDATA` | Function | `lib/rss-parser.ts` | 19 |
| `fetchWithTimeout` | Function | `lib/rss-parser.ts` | 65 |
| `parseRSSXML` | Function | `lib/rss-parser.ts` | 76 |
| `fetchRSSFeed` | Function | `lib/rss-parser.ts` | 148 |
| `fetchWithRetry` | Function | `lib/rss-parser.ts` | 155 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `GET → StripCDATA` | cross_community | 6 |
| `GET → FetchWithTimeout` | cross_community | 5 |

## How to Explore

1. `gitnexus_context({name: "stripCDATA"})` — see callers and callees
2. `gitnexus_query({query: "cluster_5"})` — find related execution flows
3. Read key files listed above for implementation details
