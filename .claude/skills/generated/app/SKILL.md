---
name: app
description: "Skill for the App area of TechNewsBoard. 21 symbols across 3 files."
---

# App

21 symbols | 3 files | Cohesion: 74%

## When to Use

- Working with code in `app/`
- Understanding how Home, toggleCategory, toggleSource work
- Modifying app-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `app/page.js` | Home, toggleCategory, toggleSource, isBookmarked, formatPubDate (+7) |
| `lib/state-manager.ts` | isBrowser, writeState, writeSettings, writeChatProvider, writeNotificationConfig (+1) |
| `lib/notification-store.ts` | loadNotificationConfig, checkArticleMatches, showNotifications |

## Entry Points

Start here when exploring this area:

- **`Home`** (Function) — `app/page.js:53`
- **`toggleCategory`** (Function) — `app/page.js:168`
- **`toggleSource`** (Function) — `app/page.js:187`
- **`isBookmarked`** (Function) — `app/page.js:220`
- **`formatPubDate`** (Function) — `app/page.js:257`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `Home` | Function | `app/page.js` | 53 |
| `toggleCategory` | Function | `app/page.js` | 168 |
| `toggleSource` | Function | `app/page.js` | 187 |
| `isBookmarked` | Function | `app/page.js` | 220 |
| `formatPubDate` | Function | `app/page.js` | 257 |
| `formatRelativeTime` | Function | `app/page.js` | 267 |
| `isFavicon` | Function | `app/page.js` | 283 |
| `toggleArticleSelection` | Function | `app/page.js` | 287 |
| `handleAskAbout` | Function | `app/page.js` | 297 |
| `writeState` | Function | `lib/state-manager.ts` | 29 |
| `writeSettings` | Function | `lib/state-manager.ts` | 57 |
| `writeChatProvider` | Function | `lib/state-manager.ts` | 75 |
| `writeNotificationConfig` | Function | `lib/state-manager.ts` | 107 |
| `resetAllState` | Function | `lib/state-manager.ts` | 112 |
| `loadNotificationConfig` | Function | `lib/notification-store.ts` | 26 |
| `checkArticleMatches` | Function | `lib/notification-store.ts` | 72 |
| `showNotifications` | Function | `lib/notification-store.ts` | 110 |
| `interval` | Function | `app/page.js` | 118 |
| `fetchNews` | Function | `app/page.js` | 125 |
| `isBrowser` | Function | `lib/state-manager.ts` | 13 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `BookmarksPage → IsBrowser` | cross_community | 6 |
| `Home → IsBrowser` | cross_community | 5 |
| `ChatSidebar → IsBrowser` | cross_community | 5 |
| `HandleExportAll → IsBrowser` | cross_community | 5 |
| `HandleExportBookmarks → IsBrowser` | cross_community | 5 |
| `HandleExportSettings → IsBrowser` | cross_community | 5 |
| `ClearAll → IsBrowser` | cross_community | 5 |
| `ToggleBookmark → IsBrowser` | cross_community | 5 |
| `Home → LoadFeeds` | cross_community | 4 |
| `Home → LoadNotificationConfig` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Bookmarks | 2 calls |
| Components | 2 calls |

## How to Explore

1. `gitnexus_context({name: "Home"})` — see callers and callees
2. `gitnexus_query({query: "app"})` — find related execution flows
3. Read key files listed above for implementation details
