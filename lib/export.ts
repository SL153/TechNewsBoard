const BOOKMARKS_KEY = 'technews-bookmarks';
const SETTINGS_KEY = 'technews-settings';
const FEEDS_KEY = 'technews-feeds';
const CHAT_PROVIDER_KEY = 'technews-chat-provider';

export function exportAllData() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    bookmarks: loadBookmarks(),
    settings: loadSettings(),
    feeds: loadFeeds(),
    chatProvider: loadChatProvider(),
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
  const data = { version: 1, exportedAt: new Date().toISOString(), bookmarks: loadBookmarks() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `technews-bookmarks-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSettings() {
  const data = { version: 1, exportedAt: new Date().toISOString(), settings: loadSettings() };
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

function loadBookmarks() {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(BOOKMARKS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function loadSettings() {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

function loadFeeds() {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(FEEDS_KEY);
    if (!stored) return [];
    const data = JSON.parse(stored);
    return data.sources || [];
  } catch { return []; }
}

function loadChatProvider() {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(CHAT_PROVIDER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}
