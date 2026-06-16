// Centralized localStorage state manager for TechNewsBoard
// Handles bookmarks, settings, chat provider, chat history, notifications
// Feed management is handled by lib/feed-store.ts directly

const KEYS = {
  BOOKMARKS: 'technews-bookmarks',
  SETTINGS: 'technews-settings',
  CHAT_PROVIDER: 'technews-chat-provider',
  CHAT_HISTORY: 'technews-chat-history',
  NOTIFICATIONS: 'technews-notifications',
} as const;

// SSR safety check — localStorage only available in browser
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

// Generic read with fallback
export function readState<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

// Generic write with quota error handling
export function writeState<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota exceeded errors — silently drop the write
  }
}

// Bookmark operations
export function readBookmarks(): Array<{ title: string; link: string }> {
  return readState(KEYS.BOOKMARKS, []);
}

export function writeBookmarks(bookmarks: Array<{ title: string; link: string }>): void {
  writeState(KEYS.BOOKMARKS, bookmarks);
}

// Settings operations (darkMode, autoRefreshInterval)
export interface AppSettings {
  darkMode?: boolean;
  autoRefreshInterval?: number; // ms
}

export function readSettings(): AppSettings | null {
  return readState(KEYS.SETTINGS, null);
}

export function writeSettings(settings: AppSettings): void {
  writeState(KEYS.SETTINGS, settings);
}

// Chat provider operations
export interface ChatProviderConfig {
  type: string;
  endpoint: string;
  apiKey?: string;
  model: string;
  requestFormat?: 'openai' | 'anthropic';
  authType?: 'none' | 'bearer';
}

export function readChatProvider(): ChatProviderConfig | null {
  return readState(KEYS.CHAT_PROVIDER, null);
}

export function writeChatProvider(config: ChatProviderConfig): void {
  writeState(KEYS.CHAT_PROVIDER, config);
}

// Chat history operations (keep last 50 messages)
export interface ChatMessage {
  role: string;
  content: string;
}

export function readChatHistory(): ChatMessage[] {
  return readState(KEYS.CHAT_HISTORY, []);
}

export function writeChatHistory(messages: ChatMessage[]): void {
  if (!isBrowser()) return;
  try {
    const trimmed = messages.slice(-50); // Keep last 50 messages
    localStorage.setItem(KEYS.CHAT_HISTORY, JSON.stringify(trimmed));
  } catch { /* ignore quota errors */ }
}

// Notification operations
export interface NotificationConfig {
  enabled?: boolean;
  categoryKeywords?: Record<string, string[]>; // category -> keywords
}

export function readNotificationConfig(): NotificationConfig | null {
  return readState(KEYS.NOTIFICATIONS, null);
}

export function writeNotificationConfig(config: NotificationConfig): void {
  writeState(KEYS.NOTIFICATIONS, config);
}

// Reset all state to defaults (except feeds — handled by feed-store.ts)
export function resetAllState(): void {
  if (!isBrowser()) return;
  try {
    for (const key of Object.values(KEYS)) {
      localStorage.removeItem(key);
    }
  } catch { /* ignore */ }
}
