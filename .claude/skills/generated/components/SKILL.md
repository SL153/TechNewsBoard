---
name: components
description: "Skill for the Components area of TechNewsBoard. 70 symbols across 13 files."
---

# Components

70 symbols | 13 files | Cohesion: 90%

## When to Use

- Working with code in `app/`
- Understanding how loadFeeds, saveFeeds, addFeed work
- Modifying components-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/import.ts` | importAllData, importBookmarks, importSettings, importFeeds, loadBookmarks (+7) |
| `app/components/FeedManager.js` | FeedManager, handleAddFeed, handleUpdateFeed, handleDeleteFeed, handleToggleFeed (+4) |
| `app/components/ChatProviderSettings.js` | loadAllConfigs, saveConfigForType, migrateLegacyConfig, ChatProviderSettings, loadConfigForType (+3) |
| `lib/feed-store.ts` | loadFeeds, saveFeeds, addFeed, updateFeed, removeFeed (+2) |
| `app/components/DataImportExport.js` | handleExportFeeds, confirmImport, handleExportAll, handleExportSettings, handleImportFile (+2) |
| `lib/state-manager.ts` | readState, readSettings, readChatProvider, readNotificationConfig, readChatHistory (+1) |
| `app/components/ChatSidebar.js` | loadChatHistory, saveChatHistory, generateQuickPrompts, ChatSidebar, sendMessage (+1) |
| `app/components/NotificationSettings.js` | handleToggleEnable, requestPermission, NotificationSettings, handleKeywordChange, saveKeywords |
| `lib/export.ts` | exportFeeds, exportAllData, exportSettings |
| `lib/notification-store.ts` | saveNotificationConfig, toggleNotifications, updateCategoryKeywords |

## Entry Points

Start here when exploring this area:

- **`loadFeeds`** (Function) — `lib/feed-store.ts:52`
- **`saveFeeds`** (Function) — `lib/feed-store.ts:65`
- **`addFeed`** (Function) — `lib/feed-store.ts:70`
- **`updateFeed`** (Function) — `lib/feed-store.ts:77`
- **`removeFeed`** (Function) — `lib/feed-store.ts:84`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `loadFeeds` | Function | `lib/feed-store.ts` | 52 |
| `saveFeeds` | Function | `lib/feed-store.ts` | 65 |
| `addFeed` | Function | `lib/feed-store.ts` | 70 |
| `updateFeed` | Function | `lib/feed-store.ts` | 77 |
| `removeFeed` | Function | `lib/feed-store.ts` | 84 |
| `toggleFeed` | Function | `lib/feed-store.ts` | 91 |
| `getEnabledSources` | Function | `lib/feed-store.ts` | 99 |
| `exportFeeds` | Function | `lib/export.ts` | 48 |
| `FeedManager` | Function | `app/components/FeedManager.js` | 11 |
| `handleAddFeed` | Function | `app/components/FeedManager.js` | 25 |
| `handleUpdateFeed` | Function | `app/components/FeedManager.js` | 41 |
| `handleDeleteFeed` | Function | `app/components/FeedManager.js` | 50 |
| `handleToggleFeed` | Function | `app/components/FeedManager.js` | 56 |
| `testFeedUrl` | Function | `app/components/FeedManager.js` | 62 |
| `startEdit` | Function | `app/components/FeedManager.js` | 76 |
| `handleImport` | Function | `app/components/FeedImportExport.js` | 22 |
| `handleExportFeeds` | Function | `app/components/DataImportExport.js` | 25 |
| `importAllData` | Function | `lib/import.ts` | 23 |
| `importBookmarks` | Function | `lib/import.ts` | 135 |
| `importSettings` | Function | `lib/import.ts` | 172 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Home → IsBrowser` | cross_community | 5 |
| `ChatSidebar → IsBrowser` | cross_community | 5 |
| `HandleExportAll → IsBrowser` | cross_community | 5 |
| `HandleExportBookmarks → IsBrowser` | cross_community | 5 |
| `HandleExportSettings → IsBrowser` | cross_community | 5 |
| `Home → LoadFeeds` | cross_community | 4 |
| `FeedManager → LoadFeeds` | intra_community | 4 |
| `FeedManager → SaveFeeds` | intra_community | 4 |
| `ChatProviderSettings → LoadAllConfigs` | intra_community | 4 |
| `NotificationSettings → LoadNotificationConfig` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| App | 5 calls |
| Bookmarks | 1 calls |

## How to Explore

1. `gitnexus_context({name: "loadFeeds"})` — see callers and callees
2. `gitnexus_query({query: "components"})` — find related execution flows
3. Read key files listed above for implementation details
