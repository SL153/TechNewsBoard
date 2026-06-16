import {
  readBookmarks,
  writeFeeds,
  readSettings,
  readChatProvider,
} from '@/lib/state-manager';
import { loadFeeds } from '@/lib/feed-store'; // feed-store has its own CRUD ops

export function exportAllData() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    bookmarks: readBookmarks(),
    settings: readSettings(),
    feeds: loadFeeds(),
    chatProvider: readChatProvider(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `technews-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportBookmarks() {
  const data = { version: 1, exportedAt: new Date().toISOString(), bookmarks: readBookmarks() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `technews-bookmarks-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSettings() {
  const data = { version: 1, exportedAt: new Date().toISOString(), settings: readSettings() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `technews-settings-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportFeeds() {
  const data = { version: 1, exportedAt: new Date().toISOString(), feeds: loadFeeds() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `technews-feeds-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
