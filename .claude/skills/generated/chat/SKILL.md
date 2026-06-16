---
name: chat
description: "Skill for the Chat area of TechNewsBoard. 8 symbols across 4 files."
---

# Chat

8 symbols | 4 files | Cohesion: 93%

## When to Use

- Working with code in `lib/`
- Understanding how checkRateLimit, formatRequestBody, getChatUrl work
- Modifying chat-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/chat-providers.ts` | formatRequestBody, getChatUrl, getHeaders, parseStreamChunk |
| `app/api/chat/route.ts` | POST, start |
| `lib/rate-limiter.ts` | checkRateLimit |
| `app/api/auth/github/route.ts` | POST |

## Entry Points

Start here when exploring this area:

- **`checkRateLimit`** (Function) — `lib/rate-limiter.ts:15`
- **`formatRequestBody`** (Function) — `lib/chat-providers.ts:79`
- **`getChatUrl`** (Function) — `lib/chat-providers.ts:106`
- **`getHeaders`** (Function) — `lib/chat-providers.ts:125`
- **`POST`** (Function) — `app/api/chat/route.ts:13`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `checkRateLimit` | Function | `lib/rate-limiter.ts` | 15 |
| `formatRequestBody` | Function | `lib/chat-providers.ts` | 79 |
| `getChatUrl` | Function | `lib/chat-providers.ts` | 106 |
| `getHeaders` | Function | `lib/chat-providers.ts` | 125 |
| `POST` | Function | `app/api/chat/route.ts` | 13 |
| `POST` | Function | `app/api/auth/github/route.ts` | 8 |
| `parseStreamChunk` | Function | `lib/chat-providers.ts` | 146 |
| `start` | Method | `app/api/chat/route.ts` | 77 |

## How to Explore

1. `gitnexus_context({name: "checkRateLimit"})` — see callers and callees
2. `gitnexus_query({query: "chat"})` — find related execution flows
3. Read key files listed above for implementation details
