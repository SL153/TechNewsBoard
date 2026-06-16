---
name: bookmarks
description: "Skill for the Bookmarks area of TechNewsBoard. 12 symbols across 5 files."
---

# Bookmarks

12 symbols | 5 files | Cohesion: 74%

## When to Use

- Working with code in `app/`
- Understanding how readBookmarks, exportBookmarks, handleExportBookmarks work
- Modifying bookmarks-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `app/bookmarks/page.js` | loadBookmarks, BookmarksPage, saveBookmarks, removeBookmark, clearAll |
| `app/page.js` | loadBookmarks, saveBookmarks, toggleBookmark |
| `lib/state-manager.ts` | readBookmarks, writeBookmarks |
| `lib/export.ts` | exportBookmarks |
| `app/components/DataImportExport.js` | handleExportBookmarks |

## Entry Points

Start here when exploring this area:

- **`readBookmarks`** (Function) — `lib/state-manager.ts:39`
- **`exportBookmarks`** (Function) — `lib/export.ts:26`
- **`handleExportBookmarks`** (Function) — `app/components/DataImportExport.js:17`
- **`BookmarksPage`** (Function) — `app/bookmarks/page.js:18`
- **`writeBookmarks`** (Function) — `lib/state-manager.ts:43`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `readBookmarks` | Function | `lib/state-manager.ts` | 39 |
| `exportBookmarks` | Function | `lib/export.ts` | 26 |
| `handleExportBookmarks` | Function | `app/components/DataImportExport.js` | 17 |
| `BookmarksPage` | Function | `app/bookmarks/page.js` | 18 |
| `writeBookmarks` | Function | `lib/state-manager.ts` | 43 |
| `toggleBookmark` | Function | `app/page.js` | 207 |
| `removeBookmark` | Function | `app/bookmarks/page.js` | 34 |
| `clearAll` | Function | `app/bookmarks/page.js` | 40 |
| `loadBookmarks` | Function | `app/page.js` | 37 |
| `loadBookmarks` | Function | `app/bookmarks/page.js` | 10 |
| `saveBookmarks` | Function | `app/page.js` | 41 |
| `saveBookmarks` | Function | `app/bookmarks/page.js` | 14 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `BookmarksPage → IsBrowser` | cross_community | 6 |
| `Home → IsBrowser` | cross_community | 5 |
| `HandleExportAll → IsBrowser` | cross_community | 5 |
| `HandleExportBookmarks → IsBrowser` | cross_community | 5 |
| `ClearAll → IsBrowser` | cross_community | 5 |
| `ToggleBookmark → IsBrowser` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Components | 1 calls |
| App | 1 calls |

## How to Explore

1. `gitnexus_context({name: "readBookmarks"})` — see callers and callees
2. `gitnexus_query({query: "bookmarks"})` — find related execution flows
3. Read key files listed above for implementation details
