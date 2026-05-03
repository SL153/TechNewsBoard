const BOOKMARKS_KEY = 'technews-bookmarks';
const SETTINGS_KEY = 'technews-settings';
const FEEDS_KEY = 'technews-feeds';
const CHAT_PROVIDER_KEY = 'technews-chat-provider';

export interface ImportData {
  version: number;
  exportedAt?: string;
  bookmarks?: any[];
  settings?: object | null;
  feeds?: Array<{ url: string; category: string; source: string; maxItems?: number; enabled: boolean }>;
  chatProvider?: object | null;
}

export interface ImportResult {
  bookmarksCount: number;
  settingsApplied: boolean;
  feedsAdded: number;
  feedsUpdated: number;
  feedsSkipped: number;
  chatProviderApplied: boolean;
}

export function importAllData(fileContent: string, mode: 'skip' | 'replace'): ImportResult {
  let data: ImportData;
  try {
    data = JSON.parse(fileContent);
  } catch {
    throw new Error('Invalid JSON file');
  }

  if (data.version !== 1) {
    throw new Error(`Unsupported schema version ${data.version}`);
  }

  const result: ImportResult = {
    bookmarksCount: 0,
    settingsApplied: false,
    feedsAdded: 0,
    feedsUpdated: 0,
    feedsSkipped: 0,
    chatProviderApplied: false,
  };

  // Import bookmarks - dedupe by link/title
  if (data.bookmarks && Array.isArray(data.bookmarks)) {
    const existing = loadBookmarks();
    const existingKeys = new Set(existing.map(b => b.link || b.title));
    let addedCount = 0;
    
    data.bookmarks.forEach(bookmark => {
      const key = bookmark.link || bookmark.title;
      if (!key) return;
      
      if (mode === 'replace') {
        existingKeys.add(key); // replace means we keep all new ones
      } else if (!existingKeys.has(key)) {
        existing.push(bookmark);
        addedCount++;
      }
    });

    if (mode === 'replace') {
      saveBookmarks(data.bookmarks.filter(b => b.link || b.title));
      result.bookmarksCount = data.bookmarks.length;
    } else {
      saveBookmarks(existing);
      result.bookmarksCount = addedCount;
    }
  }

  // Import settings - replace or merge
  if (data.settings !== undefined) {
    if (mode === 'replace') {
      saveSettings(data.settings);
      result.settingsApplied = true;
    } else {
      const existing = loadSettings();
      const merged = { ...existing, ...data.settings };
      saveSettings(merged);
      result.settingsApplied = true;
    }
  }

  // Import feeds - add/update/skip based on URL match
  if (data.feeds && Array.isArray(data.feeds)) {
    const existingFeeds = loadFeeds();
    const existingUrls = new Map(existingFeeds.map(f => [f.url, f]));
    
    data.feeds.forEach(feed => {
      const url = feed.url;
      if (!url) return;
      
      if (mode === 'replace') {
        // replace mode: just use the imported feeds directly
      } else if (existingUrls.has(url)) {
        result.feedsUpdated++;
      } else {
        result.feedsAdded++;
      }
    });

    if (mode === 'replace') {
      saveFeeds({ version: 1, sources: data.feeds.filter(f => f.url) });
      result.feedsAdded = data.feeds.length;
      result.feedsUpdated = 0;
      result.feedsSkipped = 0;
    } else {
      // Merge mode: add new feeds, keep existing ones unchanged
      const merged = [...existingFeeds];
      data.feeds.forEach(feed => {
        if (!feed.url || !merged.find(f => f.url === feed.url)) {
          merged.push({ ...feed, enabled: feed.enabled !== false });
        }
      });
      saveFeeds({ version: 1, sources: merged });
    }
  }

  // Import chat provider - replace or merge
  if (data.chatProvider !== undefined) {
    const existing = loadChatProvider();
    if (mode === 'replace') {
      saveChatProvider(data.chatProvider);
      result.chatProviderApplied = true;
    } else {
      const merged = { ...existing, ...data.chatProvider };
      saveChatProvider(merged);
      result.chatProviderApplied = true;
    }
  }

  return result;
}

export function importBookmarks(fileContent: string, mode: 'skip' | 'replace') {
  let data: ImportData;
  try {
    data = JSON.parse(fileContent);
  } catch {
    throw new Error('Invalid JSON file');
  }

  if (data.version !== 1) {
    throw new Error(`Unsupported schema version ${data.version}`);
  }

  const existing = loadBookmarks();
  const existingKeys = new Set(existing.map(b => b.link || b.title));
  let addedCount = 0;

  if (mode === 'replace') {
    const valid = (data.bookmarks || []).filter(b => b.link || b.title);
    saveBookmarks(valid);
    return valid.length;
  }

  data.bookmarks?.forEach(bookmark => {
    const key = bookmark.link || bookmark.title;
    if (!key) return;
    
    if (!existingKeys.has(key)) {
      existing.push(bookmark);
      addedCount++;
    }
  });

  saveBookmarks(existing);

  return addedCount;
}

export function importSettings(fileContent: string, mode: 'skip' | 'replace') {
  let data: ImportData;
  try {
    data = JSON.parse(fileContent);
  } catch {
    throw new Error('Invalid JSON file');
  }

  if (data.version !== 1) {
    throw new Error(`Unsupported schema version ${data.version}`);
  }

  if (mode === 'replace') {
    saveSettings(data.settings);
    return true;
  } else {
    const existing = loadSettings();
    const merged = { ...existing, ...(data.settings || {}) };
    saveSettings(merged);
    return true;
  }
}

export function importFeeds(fileContent: string, mode: 'skip' | 'replace') {
  let data: ImportData;
  try {
    data = JSON.parse(fileContent);
  } catch {
    throw new Error('Invalid JSON file');
  }

  if (data.version !== 1) {
    throw new Error(`Unsupported schema version ${data.version}`);
  }

  if (!data.feeds || !Array.isArray(data.feeds)) {
    return { added: 0, updated: 0 };
  }

  const existingFeeds = loadFeeds();
  const existingUrls = new Set(existingFeeds.map(f => f.url));
  
  let addedCount = 0;
  let updatedCount = 0;

  if (mode === 'replace') {
    saveFeeds({ version: 1, sources: data.feeds.filter(f => f.url) });
    return { added: data.feeds.length, updated: 0 };
  } else {
    const merged = [...existingFeeds];
    data.feeds.forEach(feed => {
      if (!feed.url || !merged.find(f => f.url === feed.url)) {
        merged.push({ ...feed, enabled: feed.enabled !== false });
        addedCount++;
      } else {
        updatedCount++;
      }
    });
    saveFeeds({ version: 1, sources: merged });
    return { added: addedCount, updated: updatedCount };
  }
}

function loadBookmarks() {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(BOOKMARKS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveBookmarks(bookmarks) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
}

function loadSettings() {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

function saveSettings(settings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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

function saveFeeds(data) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FEEDS_KEY, JSON.stringify(data));
}

function loadChatProvider() {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(CHAT_PROVIDER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

function saveChatProvider(provider) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CHAT_PROVIDER_KEY, JSON.stringify(provider));
}
