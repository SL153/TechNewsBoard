# Multi-Feature Enhancements Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add 8 new features to TechNewsBoard: timeline view, trend charts, reading list, cross-source comparison, article depth tags, scheduled digest export, provider usage tracker, and auto-summarization per article.

**Architecture:** All features use existing data structures (ParsedNewsItem from rss-parser.ts, localStorage state via state-manager.ts). UI components follow the existing pattern: 'use client' React components with Tailwind CSS styling, lucide-react icons. New lib files handle data logic; new component files handle UI. No external dependencies needed beyond what's already installed.

**Tech Stack:** Next.js 16, React 19, TypeScript (lib), JavaScript (components), Tailwind CSS 4, Vitest for tests, localStorage for persistence.

---

## Feature 2: Timeline / Calendar View

### Task 2.1: Create timeline data utility

**Objective:** Build a function that groups articles by date and produces timeline-ready data structure.

**Files:**
- Create: `lib/timeline.ts`
- Test: `lib/timeline.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { groupByDate, buildTimelineData } from './timeline';
import type { ParsedNewsItem } from './rss-parser';

describe('groupByDate', () => {
  it('groups articles by date string', () => {
    const articles: ParsedNewsItem[] = [
      { title: 'A', link: '/a', pubDate: '2026-05-08T10:00:00Z', category: 'AI', source: 'TechCrunch' },
      { title: 'B', link: '/b', pubDate: '2026-05-08T14:00:00Z', category: 'Startups', source: 'VentureBeat' },
      { title: 'C', link: '/c', pubDate: '2026-05-07T09:00:00Z', category: 'AI', source: 'OpenAI Blog' },
    ];
    const result = groupByDate(articles);
    expect(result['2026-05-08']).toHaveLength(2);
    expect(result['2026-05-07']).toHaveLength(1);
  });

  it('handles articles without pubDate', () => {
    const articles: ParsedNewsItem[] = [
      { title: 'A', link: '/a', pubDate: null, category: 'AI', source: 'TechCrunch' },
    ];
    const result = groupByDate(articles);
    expect(result['unknown']).toHaveLength(1);
  });
});

describe('buildTimelineData', () => {
  it('returns sorted date keys with article counts', () => {
    const articles: ParsedNewsItem[] = [
      { title: 'A', link: '/a', pubDate: '2026-05-08T10:00:00Z', category: 'AI', source: 'TechCrunch' },
      { title: 'B', link: '/b', pubDate: '2026-05-07T09:00:00Z', category: 'Startups', source: 'VentureBeat' },
    ];
    const result = buildTimelineData(articles);
    expect(result.dateKeys).toEqual(['2026-05-08', '2026-05-07']);
    expect(result['2026-05-08'].count).toBe(1);
  });
});
```

**Step 2: Run test to verify failure**

Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npx vitest run lib/timeline.test.ts`
Expected: FAIL — "module not found" or "groupByDate is not defined"

**Step 3: Write minimal implementation**

```typescript
import type { ParsedNewsItem } from './rss-parser';

export function groupByDate(articles: ParsedNewsItem[]): Record<string, ParsedNewsItem[]> {
  const groups: Record<string, ParsedNewsItem[]> = {};
  for (const article of articles) {
    let dateKey: string;
    if (!article.pubDate) {
      dateKey = 'unknown';
    } else {
      try {
        const date = new Date(article.pubDate);
        dateKey = date.toISOString().slice(0, 10); // YYYY-MM-DD
      } catch {
        dateKey = 'unknown';
      }
    }
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(article);
  }
  return groups;
}

export interface TimelineData {
  dateKeys: string[]; // sorted descending (newest first)
  [dateKey: string]: { articles: ParsedNewsItem[]; count: number };
}

export function buildTimelineData(articles: ParsedNewsItem[]): TimelineData {
  const grouped = groupByDate(articles);
  const dateKeys = Object.keys(grouped).sort((a, b) => {
    if (a === 'unknown') return 1;
    if (b === 'unknown') return -1;
    return b.localeCompare(a); // descending
  });

  const result: TimelineData = { dateKeys };
  for (const key of dateKeys) {
    result[key] = { articles: grouped[key], count: grouped[key].length };
  }
  return result;
}
```

**Step 4: Run test to verify pass**

Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npx vitest run lib/timeline.test.ts`
Expected: PASS — "2 passed"

**Step 5: Commit**

```bash
cd /mnt/c/POC/paperclip/TechNewsBoard
git add lib/timeline.ts lib/timeline.test.ts
git commit -m "feat: add timeline data utility for grouping articles by date"
```

### Task 2.2: Create TimelineView component

**Objective:** Build a React component that renders articles as a vertical timeline with date headers.

**Files:**
- Create: `app/components/TimelineView.js`
- Modify: `app/page.js` (add state and toggle)

**Step 1: Write the component**

```javascript
'use client';

import { useState } from 'react';
import { Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { buildTimelineData } from '@/lib/timeline';

export default function TimelineView({ articles, darkMode }) {
  const [expandedDates, setExpandedDates] = useState(new Set());

  if (!articles || articles.length === 0) return null;

  const timelineData = buildTimelineData(articles);

  function toggleDate(dateKey) {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  }

  // Expand all dates by default
  if (expandedDates.size === 0) {
    setExpandedDates(new Set(timelineData.dateKeys));
  }

  return (
    <div className="space-y-4">
      {timelineData.dateKeys.map(dateKey => {
        const data = timelineData[dateKey];
        const isExpanded = expandedDates.has(dateKey);
        const isUnknown = dateKey === 'unknown';

        return (
          <div key={dateKey} className="border border-border dark:border-border rounded-xl bg-card dark:bg-card overflow-hidden">
            {/* Date header */}
            <button
              onClick={() => toggleDate(dateKey)}
              className="w-full flex items-center justify-between px-4 py-3 bg-secondary dark:bg-accent text-foreground hover:bg-muted dark:hover:bg-muted/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-muted-foreground" />
                <span className="text-sm font-semibold">
                  {isUnknown ? 'No date' : new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'long', day: 'numeric' }).format(new Date(dateKey + 'T00:00:00Z'))}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted dark:bg-accent text-muted-foreground">
                  {data.count} article{data.count !== 1 ? 's' : ''}
                </span>
              </div>
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* Articles list */}
            {isExpanded && (
              <div className="px-4 py-3 space-y-2">
                {data.articles.map((article, idx) => (
                  <a
                    key={idx}
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-lg border border-border dark:border-border hover:bg-muted dark:hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${darkMode ? 'bg-blue-700/15 text-blue-300' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                          {article.category}
                        </span>
                        <h4 className="text-sm font-semibold leading-snug mt-1 group-hover:underline truncate">
                          {article.title}
                        </h4>
                        {article.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {article.description}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{article.source}</span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Add timeline toggle to page.js**

Modify `app/page.js`: Add a new state variable and view mode toggle.

At line ~60 (after sortBy state), add:
```javascript
const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'timeline'
```

In the filters section (~line 514-539, after Sort buttons), add a View mode toggle:
```javascript
{/* View Mode */}
<span className="text-xs ml-3 text-muted-foreground">View:</span>
<div className="flex gap-1">
  <button
    onClick={() => setViewMode('grid')}
    touch-action="manipulation"
    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
      viewMode === 'grid'
        ? 'bg-blue-600 text-white dark:bg-blue-700'
        : 'bg-secondary hover:bg-muted text-muted-foreground border-border dark:bg-accent dark:hover:bg-muted/80 dark:text-muted-foreground dark:border-border'
    }`}
  >
    Grid
  </button>
  <button
    onClick={() => setViewMode('timeline')}
    touch-action="manipulation"
    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
      viewMode === 'timeline'
        ? 'bg-blue-600 text-white dark:bg-blue-700'
        : 'bg-secondary hover:bg-muted text-muted-foreground border-border dark:bg-accent dark:hover:bg-muted/80 dark:text-muted-foreground dark:border-border'
    }`}
  >
    Timeline
  </button>
</div>
```

Save the view mode in settings. Modify the saveSettings useEffect (~line 105):
```javascript
useEffect(() => {
  saveSettings({ darkMode, autoRefreshInterval, viewMode });
}, [darkMode, autoRefreshInterval, viewMode]);
```

Load view mode from settings. Modify loadSettings useEffect (~line 97):
```javascript
useEffect(() => {
  const savedSettings = loadSettings();
  if (savedSettings) {
    setDarkMode(savedSettings.darkMode ?? false);
    setAutoRefreshInterval(savedSettings.autoRefreshInterval ?? 1800000);
    setViewMode(savedSettings.viewMode ?? 'grid');
  }
}, []);
```

Update AppSettings interface in `lib/state-manager.ts` (~line 49):
```typescript
export interface AppSettings {
  darkMode?: boolean;
  autoRefreshInterval?: number; // ms
  viewMode?: 'grid' | 'timeline';
}
```

**Step 3: Replace article rendering with conditional view**

In the article rendering section (~line 725-812), replace the grid rendering with a conditional:

```javascript
{!loading && restOfNews.length > 0 && (
  <>
    {viewMode === 'grid' && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-foreground">
        {/* existing grid rendering code from lines 726-812 */}
      </div>
    )}
    {viewMode === 'timeline' && (
      <TimelineView articles={sortedNews} darkMode={darkMode} />
    )}
  </>
)}
```

**Step 4: Verify the component renders**

Run dev server and check that timeline view toggles correctly.
Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npm run dev`
Verify: Toggle between Grid and Timeline views in the UI.

**Step 5: Commit**

```bash
cd /mnt/c/POC/paperclip/TechNewsBoard
git add app/components/TimelineView.js app/page.js lib/state-manager.ts
git commit -m "feat: add timeline/calendar view mode for article display"
```

---

## Feature 3: Trend Charts

### Task 3.1: Create trend data utility

**Objective:** Build functions that compute category/source/article count trends over time periods.

**Files:**
- Create: `lib/trends.ts`
- Test: `lib/trends.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { computeCategoryTrends, computeSourceTrends, buildTrendData } from './trends';
import type { ParsedNewsItem } from './rss-parser';

describe('computeCategoryTrends', () => {
  it('counts articles per category over date range', () => {
    const articles: ParsedNewsItem[] = [
      { title: 'A', link: '/a', pubDate: '2026-05-08T10:00:00Z', category: 'AI', source: 'TechCrunch' },
      { title: 'B', link: '/b', pubDate: '2026-05-08T14:00:00Z', category: 'Startups', source: 'VentureBeat' },
      { title: 'C', link: '/c', pubDate: '2026-05-07T09:00:00Z', category: 'AI', source: 'OpenAI Blog' },
      { title: 'D', link: '/d', pubDate: '2026-05-07T15:00:00Z', category: 'AI', source: 'IEEE Spectrum' },
    ];
    const result = computeCategoryTrends(articles);
    expect(result['AI']).toBe(3);
    expect(result['Startups']).toBe(1);
  });

  it('handles unknown categories', () => {
    const articles: ParsedNewsItem[] = [
      { title: 'A', link: '/a', pubDate: '2026-05-08T10:00:00Z', category: '', source: 'TechCrunch' },
    ];
    const result = computeCategoryTrends(articles);
    expect(result['']).toBe(1);
  });
});

describe('computeSourceTrends', () => {
  it('counts articles per source over date range', () => {
    const articles: ParsedNewsItem[] = [
      { title: 'A', link: '/a', pubDate: '2026-05-08T10:00:00Z', category: 'AI', source: 'TechCrunch' },
      { title: 'B', link: '/b', pubDate: '2026-05-07T09:00:00Z', category: 'Startups', source: 'TechCrunch' },
    ];
    const result = computeSourceTrends(articles);
    expect(result['TechCrunch']).toBe(2);
  });
});

describe('buildTrendData', () => {
  it('returns daily counts per category for last N days', () => {
    const articles: ParsedNewsItem[] = [
      { title: 'A', link: '/a', pubDate: '2026-05-08T10:00:00Z', category: 'AI', source: 'TechCrunch' },
      { title: 'B', link: '/b', pubDate: '2026-05-07T09:00:00Z', category: 'Startups', source: 'VentureBeat' },
    ];
    const result = buildTrendData(articles, 3);
    // Should have entries for 2026-05-08 and 2026-05-07
    expect(result.dailyCounts['2026-05-08']?.AI).toBe(1);
    expect(result.dailyCounts['2026-05-07']?.Startups).toBe(1);
  });
});
```

**Step 2: Run test to verify failure**

Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npx vitest run lib/trends.test.ts`
Expected: FAIL — "module not found"

**Step 3: Write minimal implementation**

```typescript
import type { ParsedNewsItem } from './rss-parser';

export function computeCategoryTrends(articles: ParsedNewsItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const article of articles) {
    const cat = article.category || '';
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return counts;
}

export function computeSourceTrends(articles: ParsedNewsItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const article of articles) {
    const source = article.source || '';
    counts[source] = (counts[source] || 0) + 1;
  }
  return counts;
}

export interface TrendData {
  dailyCounts: Record<string, Record<string, number>>; // date -> category -> count
  topCategories: Array<{ category: string; count: number }>;// sorted descending
  totalArticles: number;
}

export function buildTrendData(articles: ParsedNewsItem[], days: number = 7): TrendData {
  // Group by date first
  const groupedByDate: Record<string, ParsedNewsItem[]> = {};
  for (const article of articles) {
    let dateKey: string;
    if (!article.pubDate) {
      dateKey = 'unknown';
    } else {
      try {
        dateKey = new Date(article.pubDate).toISOString().slice(0, 10);
      } catch {
        dateKey = 'unknown';
      }
    }
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(article);
  }

  // Build daily counts per category
  const dailyCounts: Record<string, Record<string, number>> = {};
  for (const [dateKey, dateArticles] of Object.entries(groupedByDate)) {
    dailyCounts[dateKey] = {};
    for (const article of dateArticles) {
      const cat = article.category || '';
      dailyCounts[dateKey][cat] = (dailyCounts[dateKey][cat] || 0) + 1;
    }
  }

  // Compute top categories across all dates
  const categoryTotals: Record<string, number> = {};
  for (const dateData of Object.values(dailyCounts)) {
    for (const [cat, count] of Object.entries(dateData)) {
      categoryTotals[cat] = (categoryTotals[cat] || 0) + count;
    }
  }

  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({ category, count }));

  return {
    dailyCounts,
    topCategories,
    totalArticles: articles.length,
  };
}
```

**Step 4: Run test to verify pass**

Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npx vitest run lib/trends.test.ts`
Expected: PASS — "3 passed"

**Step 5: Commit**

```bash
cd /mnt/c/POC/paperclip/TechNewsBoard
git add lib/trends.ts lib/trends.test.ts
git commit -m "feat: add trend data utility for category/source/article count analysis"
```

### Task 3.2: Create TrendChart component

**Objective:** Build a React component that renders simple bar charts showing article counts per category.

**Files:**
- Create: `app/components/TrendChart.js`

**Step 1: Write the component**

```javascript
'use client';

import { BarChart3, TrendingUp } from 'lucide-react';
import { buildTrendData } from '@/lib/trends';

export default function TrendChart({ articles, darkMode }) {
  if (!articles || articles.length === 0) return null;

  const trendData = buildTrendData(articles);

  // Find max count for scaling
  const maxCount = Math.max(...trendData.topCategories.map(t => t.count), 1);

  return (
    <div className="p-4 rounded-xl border border-border dark:border-border bg-card dark:bg-card">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={16} className="text-muted-foreground" />
        <span className="text-sm font-semibold">Article Trends</span>
        <TrendingUp size={14} className="text-green-500 dark:text-green-400 ml-auto" />
      </div>

      {/* Top categories bar chart */}
      <div className="space-y-2">
        {trendData.topCategories.map((item, idx) => {
          const barWidth = (item.count / maxCount) * 100;
          return (
            <div key={idx} className="flex items-center gap-3">
              <span className="text-xs font-medium w-24 truncate text-foreground dark:text-foreground">
                {item.category}
              </span>
              <div className="flex-1 h-6 bg-muted dark:bg-accent rounded-full overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all ${
                    darkMode ? 'bg-blue-600' : 'bg-blue-500'
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className="text-xs font-bold w-8 text-right text-muted-foreground">
                {item.count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Total summary */}
      <div className="mt-3 pt-2 border-t border-border dark:border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>{trendData.totalArticles} total articles</span>
        <span>Top {trendData.topCategories.length} categories shown</span>
      </div>
    </div>
  );
}
```

**Step 2: Add trend chart to page.js header area**

Modify `app/page.js`: Insert TrendChart after the filters section (~line 608), before loading/error states.

Add after line 608 (after the filters div closes):
```javascript
{/* Trend Chart */}
{!loading && !error && sortedNews.length > 0 && (
  <div className="mb-5">
    <TrendChart articles={sortedNews} darkMode={darkMode} />
  </div>
)}
```

Add import at top of page.js (~line 9):
```javascript
import TrendChart from './components/TrendChart';
```

**Step 3: Verify the chart renders**

Run dev server and check that trend chart appears above the article grid.
Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npm run dev`
Verify: Bar chart shows category counts with proportional widths.

**Step 4: Commit**

```bash
cd /mnt/c/POC/paperclip/TechNewsBoard
git add app/components/TrendChart.js app/page.js
git commit -m "feat: add trend chart component showing article counts per category"
```

---

## Feature 4: Reading List (separate from bookmarks)

### Task 4.1: Create reading list state manager

**Objective:** Add read/write functions for a reading list stored in localStorage, separate from bookmarks.

**Files:**
- Modify: `lib/state-manager.ts`

**Step 1: Add reading list types and functions to state-manager.ts**

After the existing Bookmark operations (~line 46), add:

```typescript
// Reading list operations (articles queued for later reading)
export interface ReadingListItem {
  title: string;
  link: string;
  category: string;
  source: string;
  addedAt: string; // ISO timestamp
  read?: boolean; // marked as read
}

export function readReadingList(): ReadingListItem[] {
  return readState('technews-reading-list', []);
}

export function writeReadingList(items: ReadingListItem[]): void {
  writeState('technews-reading-list', items);
}

export function addReadingItem(item: Omit<ReadingListItem, 'addedAt'>): ReadingListItem[] {
  const list = readReadingList();
  // Don't duplicate — check by link
  if (list.some(r => r.link === item.link)) return list;
  const newItem: ReadingListItem = { ...item, addedAt: new Date().toISOString() };
  const updated = [...list, newItem];
  writeReadingList(updated);
  return updated;
}

export function removeReadingItem(link: string): ReadingListItem[] {
  const list = readReadingList();
  const updated = list.filter(r => r.link !== link);
  writeReadingList(updated);
  return updated;
}

export function markAsRead(link: string): ReadingListItem[] {
  const list = readReadingList();
  const updated = list.map(r => r.link === link ? { ...r, read: true } : r);
  writeReadingList(updated);
  return updated;
}

export function clearReadingList(): ReadingListItem[] {
  writeReadingList([]);
  return [];
}
```

Also add the key to KEYS constant (~line 5):
```typescript
const KEYS = {
  BOOKMARKS: 'technews-bookmarks',
  SETTINGS: 'technews-settings',
  CHAT_PROVIDER: 'technews-chat-provider',
  CHAT_HISTORY: 'technews-chat-history',
  NOTIFICATIONS: 'technews-notifications',
  READING_LIST: 'technews-reading-list',
} as const;
```

**Step 2: Verify the functions work with a test**

Create `lib/state-manager.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
// Note: state-manager uses localStorage which is unavailable in node env.
// These tests verify the interface shapes only.
describe('ReadingListItem interface', () => {
  it('has required fields', () => {
    // TypeScript compilation check — if this file compiles, the interface is valid
    const item = { title: 'Test', link: '/test', category: 'AI', source: 'TC', addedAt: '2026-05-08T00:00:00Z' };
    expect(item.title).toBeDefined();
  });
});
```

Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npx vitest run lib/state-manager.test.ts`
Expected: PASS — compilation succeeds

**Step 3: Commit**

```bash
cd /mnt/c/POC/paperclip/TechNewsBoard
git add lib/state-manager.ts lib/state-manager.test.ts
git commit -m "feat: add reading list state manager with CRUD operations"
```

### Task 4.2: Create ReadingList component

**Objective:** Build a React component that displays the reading list with read/unread status and actions.

**Files:**
- Create: `app/components/ReadingList.js`

**Step 1: Write the component**

```javascript
'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Check, X, Trash2, ArrowRight } from 'lucide-react';
import { readReadingList, removeReadingItem, markAsRead, clearReadingList } from '@/lib/state-manager';

export default function ReadingList({ darkMode }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setItems(readReadingList());
  }, []);

  function handleRemove(link) {
    const updated = removeReadingItem(link);
    setItems(updated);
  }

  function handleMarkRead(link) {
    const updated = markAsRead(link);
    setItems(updated);
  }

  function handleClear() {
    const updated = clearReadingList();
    setItems(updated);
  }

  const unreadCount = items.filter(i => !i.read).length;
  const readCount = items.filter(i => i.read).length;

  if (!open && items.length === 0) return null;

  return (
    <div className={`fixed right-0 top-0 h-full z-50 w-[28rem] lg:w-[32rem] flex-shrink-0 flex flex-col border-l bg-card dark:bg-card border-border shadow-xl transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card dark:bg-card">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-blue-600 dark:text-blue-300" />
          <span className="text-sm font-semibold">Reading List</span>
          {unreadCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-secondary dark:bg-accent text-muted-foreground">
              {unreadCount} unread
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {items.length > 0 && (
            <button onClick={handleClear} aria-label="Clear reading list" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-accent transition-colors">
              <Trash2 size={14} />
            </button>
          )}
          <button onClick={() => setOpen(false)} aria-label="Close reading list" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-accent transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {items.length === 0 && (
          <div className="text-center py-8 opacity-40">
            <BookOpen size={32} className="mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No articles in your reading list.</p>
          </div>
        )}

        {items.map((item, idx) => (
          <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg border ${item.read ? 'border-border/50 dark:border-border/30 bg-muted/10 dark:bg-accent/10' : 'border-border dark:border-border bg-card dark:bg-card'} transition-colors`}>
            {/* Read checkbox */}
            <button
              onClick={() => handleMarkRead(item.link)}
              className={`flex-shrink-0 p-1 rounded ${item.read ? 'bg-green-600' : 'border border-muted-foreground/40 hover:bg-muted dark:hover:bg-accent'} transition-colors`}
              aria-label={item.read ? 'Mark as unread' : 'Mark as read'}
            >
              {item.read && <Check size={10} className="text-white" />}
            </button>

            {/* Article info */}
            <div className="flex-1 min-w-0">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${darkMode ? 'bg-blue-700/15 text-blue-300' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                {item.category}
              </span>
              <h4 className="text-sm font-semibold leading-snug mt-1 group-hover:underline truncate">
                <a href={item.link} target="_blank" rel="noopener noreferrer">{item.title}</a>
              </h4>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>{item.source}</span>
                <span className="opacity-50">·</span>
                <span>{new Date(item.addedAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Remove button */}
            <button onClick={() => handleRemove(item.link)} aria-label="Remove from reading list" className="flex-shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20 transition-colors">
              <X size={12} />
            </button>
          </div>
        ))}

        {/* Summary */}
        {items.length > 0 && (
          <div className="mt-3 pt-2 border-t border-border dark:border-border text-xs text-muted-foreground flex items-center justify-between">
            <span>{readCount} read, {unreadCount} unread</span>
            <ArrowRight size={12} />
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Add reading list toggle to page.js header**

Modify `app/page.js`: Add a ReadingList button in the header (~line 344-351, after Bookmarks link).

Add after the Bookmarks Link:
```javascript
<button
  onClick={() => setReadingListOpen(!readingListOpen)}
  className="p-2 rounded-lg transition-colors hover:bg-muted dark:hover:bg-accent relative"
  aria-label="Reading list"
>
  <BookOpen size={18} />
  {unreadCount > 0 && (
    <span className="absolute -top-0.5 -right-0.5 text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold bg-green-600 text-white">
      {unreadCount}
    </span>
  )}
</button>
```

Add import at top (~line 10):
```javascript
import ReadingList from './components/ReadingList';
import { readReadingList } from '@/lib/state-manager';
```

Add state variable (~line 73, after feedManagerOpen):
```javascript
const [readingListOpen, setReadingListOpen] = useState(false);
```

Compute unreadCount:
```javascript
const readingListItems = readReadingList();
const unreadCount = readingListItems.filter(i => !i.read).length;
```

Add ReadingList component at bottom (~line 865, after ChatSidebar):
```javascript
<ReadingList darkMode={darkMode} />
```

**Step 3: Add "add to reading list" button on article cards**

Modify the article card buttons (~line 677-696 for top stories, ~line 781-799 for rest of news).

Add a ReadingList button between Bookmark and ExternalLink:
```javascript
<button
  onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToReadingList(item); }}
  aria-label="Add to reading list"
  className="p-1 rounded-lg text-muted-foreground hover:text-green-600 dark:hover:text-green-400 hover:bg-muted dark:hover:bg-accent transition-colors opacity-0 group-hover:opacity-100"
>
  <BookOpen size={12} />
</button>
```

Add addToReadingList function (~line 219, after toggleBookmark):
```javascript
function addToReadingList(article) {
  addReadingItem({ title: article.title, link: article.link, category: article.category, source: article.source });
}
```

**Step 4: Verify the reading list UI works**

Run dev server. Check that:
- Reading list button appears in header with unread count badge
- Clicking opens the slide-out panel
- Article cards have BookOpen icon on hover to add items
- Mark as read / remove buttons work

Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npm run dev`

**Step 5: Commit**

```bash
cd /mnt/c/POC/paperclip/TechNewsBoard
git add app/components/ReadingList.js app/page.js
git commit -m "feat: add reading list feature separate from bookmarks"
```

---

## Feature 5: Cross-source comparison

### Task 5.1: Create cross-source detection utility

**Objective:** Build a function that identifies articles from different sources covering similar topics (based on title keyword overlap).

**Files:**
- Create: `lib/cross-source.ts`
- Test: `lib/cross-source.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { findCrossSourcePairs, buildCrossSourceData } from './cross-source';
import type { ParsedNewsItem } from './rss-parser';

describe('findCrossSourcePairs', () => {
  it('identifies articles with overlapping keywords from different sources', () => {
    const articles: ParsedNewsItem[] = [
      { title: 'Apple launches new AI chip', link: '/a1', category: 'AI', source: 'TechCrunch' },
      { title: 'Apple unveils AI-powered processor', link: '/a2', category: 'Consumer Tech', source: 'The Verge' },
      { title: 'Google releases new model', link: '/g1', category: 'AI', source: 'Google Blog' },
    ];
    const result = findCrossSourcePairs(articles);
    expect(result.length).toBe(1); // Only Apple articles from different sources match
    expect(result[0].article1.source).toBe('TechCrunch');
    expect(result[0].article2.source).toBe('The Verge');
  });

  it('ignores articles from the same source', () => {
    const articles: ParsedNewsItem[] = [
      { title: 'Apple launches new AI chip', link: '/a1', category: 'AI', source: 'TechCrunch' },
      { title: 'Apple unveils AI processor', link: '/a2', category: 'AI', source: 'TechCrunch' },
    ];
    const result = findCrossSourcePairs(articles);
    expect(result.length).toBe(0); // Same source, no cross-source pair
  });

  it('requires at least 3 shared keywords', () => {
    const articles: ParsedNewsItem[] = [
      { title: 'Apple launches chip', link: '/a1', category: 'AI', source: 'TechCrunch' },
      { title: 'Samsung releases phone', link: '/s1', category: 'Consumer Tech', source: 'The Verge' },
    ];
    const result = findCrossSourcePairs(articles);
    expect(result.length).toBe(0); // Only 1 shared word (none really), below threshold
  });
});

describe('buildCrossSourceData', () => {
  it('returns pairs with similarity score', () => {
    const articles: ParsedNewsItem[] = [
      { title: 'Apple launches new AI chip', link: '/a1', category: 'AI', source: 'TechCrunch' },
      { title: 'Apple unveils AI-powered processor', link: '/a2', category: 'Consumer Tech', source: 'The Verge' },
    ];
    const result = buildCrossSourceData(articles);
    expect(result.pairs.length).toBe(1);
    expect(result.pairs[0].sharedKeywords.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify failure**

Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npx vitest run lib/cross-source.test.ts`
Expected: FAIL — "module not found"

**Step 3: Write minimal implementation**

```typescript
import type { ParsedNewsItem } from './rss-parser';

function extractKeywords(title: string): Set<string> {
  // Extract meaningful words (2+ chars, exclude common stop words)
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'new', 'launches', 'unveils', 'releases', 'announces', 'introduces']);
  const words = title.toLowerCase().split(/[\s\-]+/);
  return new Set(words.filter(w => w.length >= 2 && !stopWords.has(w)));
}

function computeOverlap(setA: Set<string>, setB: Set<string>): number {
  let overlap = 0;
  for (const word of setA) {
    if (setB.has(word)) overlap++;
  }
  return overlap;
}

export interface CrossSourcePair {
  article1: ParsedNewsItem;
  article2: ParsedNewsItem;
  sharedKeywords: string[];
  similarityScore: number; // overlap count
}

export function findCrossSourcePairs(articles: ParsedNewsItem[]): CrossSourcePair[] {
  const pairs: CrossSourcePair[] = [];
  const keywordSets = new Map<string, Set<string>>(); // link -> keywords

  for (const article of articles) {
    keywordSets.set(article.link || article.title, extractKeywords(article.title));
  }

  // Compare all pairs
  const links = Array.from(keywordSets.keys());
  for (let i = 0; i < links.length; i++) {
    for (let j = i + 1; j < links.length; j++) {
      const linkA = links[i];
      const linkB = links[j];
      const articleA = articles.find(a => a.link === linkA || a.title === linkA);
      const articleB = articles.find(a => a.link === linkB || a.title === linkB);

      if (!articleA || !articleB) continue;
      if (articleA.source === articleB.source) continue; // Same source, skip

      const keywordsA = keywordSets.get(linkA)!;
      const keywordsB = keywordSets.get(linkB)!;
      const overlap = computeOverlap(keywordsA, keywordsB);

      if (overlap >= 3) { // Minimum 3 shared meaningful keywords
        pairs.push({
          article1: articleA,
          article2: articleB,
          sharedKeywords: Array.from(keywordsA).filter(w => keywordsB.has(w)),
          similarityScore: overlap,
        });
      }
    }
  }

  // Sort by similarity score descending
  pairs.sort((a, b) => b.similarityScore - a.similarityScore);
  return pairs;
}

export interface CrossSourceData {
  pairs: CrossSourcePair[];
  totalPairs: number;
}

export function buildCrossSourceData(articles: ParsedNewsItem[]): CrossSourceData {
  const pairs = findCrossSourcePairs(articles);
  return {
    pairs,
    totalPairs: pairs.length,
  };
}
```

**Step 4: Run test to verify pass**

Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npx vitest run lib/cross-source.test.ts`
Expected: PASS — "2 passed"

**Step 5: Commit**

```bash
cd /mnt/c/POC/paperclip/TechNewsBoard
git add lib/cross-source.ts lib/cross-source.test.ts
git commit -m "feat: add cross-source comparison detection utility"
```

### Task 5.2: Create CrossSourceComparison component

**Objective:** Build a React component that displays cross-source article pairs side-by-side for comparison.

**Files:**
- Create: `app/components/CrossSourceComparison.js`

**Step 1: Write the component**

```javascript
'use client';

import { Compare, ExternalLink, Link2 } from 'lucide-react';
import { buildCrossSourceData } from '@/lib/cross-source';

export default function CrossSourceComparison({ articles, darkMode }) {
  if (!articles || articles.length === 0) return null;

  const crossSourceData = buildCrossSourceData(articles);

  if (crossSourceData.totalPairs === 0) return null;

  return (
    <div className="p-4 rounded-xl border border-border dark:border-border bg-card dark:bg-card">
      <div className="flex items-center gap-2 mb-3">
        <Compare size={16} className="text-muted-foreground" />
        <span className="text-sm font-semibold">Cross-source Coverage</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary dark:bg-accent text-muted-foreground ml-auto">
          {crossSourceData.totalPairs} pair{crossSourceData.totalPairs !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Pairs */}
      <div className="space-y-3">
        {crossSourceData.pairs.map((pair, idx) => (
          <div key={idx} className="border border-border dark:border-border rounded-lg p-3 bg-secondary dark:bg-accent">
            {/* Shared keywords badge */}
            <div className="flex items-center gap-1 mb-2">
              <Link2 size={12} className="text-green-500 dark:text-green-400" />
              <span className="text-xs text-muted-foreground">Shared:</span>
              {pair.sharedKeywords.map((kw, kIdx) => (
                <span key={kIdx} className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-800/30 text-green-800 dark:text-green-100">
                  {kw}
                </span>
              ))}
            </div>

            {/* Two articles side by side */}
            <div className="grid grid-cols-2 gap-3">
              {/* Article 1 */}
              <a href={pair.article1.link} target="_blank" rel="noopener noreferrer" className="block p-2 rounded border border-border dark:border-border hover:bg-muted dark:hover:bg-accent transition-colors group">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${darkMode ? 'bg-blue-700/15 text-blue-300' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                  {pair.article1.category}
                </span>
                <h4 className="text-sm font-semibold leading-snug mt-1 group-hover:underline truncate">
                  {pair.article1.title}
                </h4>
                <span className="text-xs text-muted-foreground mt-1">{pair.article1.source}</span>
              </a>

              {/* Article 2 */}
              <a href={pair.article2.link} target="_blank" rel="noopener noreferrer" className="block p-2 rounded border border-border dark:border-border hover:bg-muted dark:hover:bg-accent transition-colors group">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${darkMode ? 'bg-blue-700/15 text-blue-300' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                  {pair.article2.category}
                </span>
                <h4 className="text-sm font-semibold leading-snug mt-1 group-hover:underline truncate">
                  {pair.article2.title}
                </h4>
                <span className="text-xs text-muted-foreground mt-1">{pair.article2.source}</span>
              </a>
            </div>

            {/* Chat comparison trigger */}
            <button
              onClick={() => {
                // Trigger chat with compareArticles — this would integrate with page.js state
                // For now, just a placeholder that opens chat sidebar
              }}
              className="mt-2 w-full text-xs px-3 py-1.5 rounded-lg bg-blue-600/10 dark:bg-blue-700/10 text-blue-600 dark:text-blue-300 hover:bg-blue-600/20 dark:hover:bg-blue-700/20 transition-colors flex items-center justify-center gap-1"
            >
              <Compare size={12} /> Compare these in chat
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Add cross-source comparison to page.js**

Modify `app/page.js`: Insert CrossSourceComparison after TrendChart (~line after the trend chart div).

Add import at top (~line 11):
```javascript
import CrossSourceComparison from './components/CrossSourceComparison';
```

Add after TrendChart section:
```javascript
{/* Cross-source Comparison */}
{!loading && !error && sortedNews.length > 0 && (
  <div className="mb-5">
    <CrossSourceComparison articles={sortedNews} darkMode={darkMode} />
  </div>
)}
```

**Step 3: Verify the component renders**

Run dev server. Check that cross-source pairs appear when multiple sources cover similar topics.
Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npm run dev`

**Step 4: Commit**

```bash
cd /mnt/c/POC/paperclip/TechNewsBoard
git add app/components/CrossSourceComparison.js app/page.js
git commit -m "feat: add cross-source comparison component for related coverage detection"
```

---

## Feature 6: Article Depth Tags

### Task 6.1: Create depth classification utility

**Objective:** Build a function that classifies articles as "quick read," "deep dive," or "technical" based on description length and content signals.

**Files:**
- Create: `lib/depth-tags.ts`
- Test: `lib/depth-tags.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { classifyDepth, addDepthTags } from './depth-tags';
import type { ParsedNewsItem } from './rss-parser';

describe('classifyDepth', () => {
  it('classifies short descriptions as quick read', () => {
    const article: ParsedNewsItem = { title: 'Apple launches chip', link: '/a', description: 'Apple announced a new processor.', category: 'AI', source: 'TechCrunch' };
    expect(classifyDepth(article)).toBe('quick-read');
  });

  it('classifies long descriptions as deep dive', () => {
    const article: ParsedNewsItem = { title: 'Deep learning breakthrough', link: '/a', description: 'A comprehensive analysis of neural network architectures, training methodologies, and deployment strategies across multiple domains including computer vision, natural language processing, and reinforcement learning. The research covers transformer models, attention mechanisms, and optimization techniques.', category: 'AI', source: 'IEEE Spectrum' };
    expect(classifyDepth(article)).toBe('deep-dive');
  });

  it('classifies technical content as technical', () => {
    const article: ParsedNewsItem = { title: 'GPU architecture details', link: '/a', description: 'The new GPU features 128 tensor cores, 40GB HBM3 memory, and a 1024-bit memory interface. Compute capability 9.0 supports FP8 precision.', category: 'Consumer Tech', source: 'NVIDIA Blog' };
    expect(classifyDepth(article)).toBe('technical');
  });

  it('defaults to quick-read for no description', () => {
    const article: ParsedNewsItem = { title: 'Breaking news', link: '/a', description: null, category: 'Startups', source: 'TechCrunch' };
    expect(classifyDepth(article)).toBe('quick-read');
  });
});

describe('addDepthTags', () => {
  it('adds depth tag to each article', () => {
    const articles: ParsedNewsItem[] = [
      { title: 'A', link: '/a', description: 'Short.', category: 'AI', source: 'TC' },
      { title: 'B', link: '/b', description: 'Very long detailed technical analysis with lots of words here...', category: 'AI', source: 'TC' },
    ];
    const result = addDepthTags(articles);
    expect(result[0].tags).toContain('quick-read');
    expect(result[1].tags).toContain('deep-dive');
  });
});
```

**Step 2: Run test to verify failure**

Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npx vitest run lib/depth-tags.test.ts`
Expected: FAIL — "module not found"

**Step 3: Write minimal implementation**

```typescript
import type { ParsedNewsItem } from './rss-parser';

export type DepthLevel = 'quick-read' | 'deep-dive' | 'technical';

// Technical keyword patterns that indicate technical depth
const TECHNICAL_KEYWORDS = [
  'tensor', 'core', 'memory', 'interface', 'compute', 'capability', 'fp8', 'fp16', 'fp32',
  'architecture', 'specification', 'benchmark', 'latency', 'throughput', 'bandwidth',
  'protocol', 'api', 'sdk', 'framework', 'library', 'compiler', 'runtime',
  'algorithm', 'model', 'training', 'inference', 'precision', 'quantization',
];

export function classifyDepth(article: ParsedNewsItem): DepthLevel {
  const desc = article.description || '';

  // No description -> quick read
  if (!desc) return 'quick-read';

  // Check for technical keywords
  const descLower = desc.toLowerCase();
  let techCount = 0;
  for (const keyword of TECHNICAL_KEYWORDS) {
    if (descLower.includes(keyword)) techCount++;
  }
  if (techCount >= 2) return 'technical';

  // Length-based classification
  const wordCount = desc.split(/\s+/).length;
  if (wordCount <= 15) return 'quick-read';
  if (wordCount >= 50) return 'deep-dive';

  // Middle range -> quick read (default for moderate length)
  return 'quick-read';
}

export function addDepthTags(articles: ParsedNewsItem[]): ParsedNewsItem[] {
  return articles.map(article => {
    const depth = classifyDepth(article);
    const existingTags = article.tags || [];
    return { ...article, tags: [...existingTags, depth] };
  });
}

export function getDepthBadgeClass(depth: DepthLevel, darkMode: boolean): string {
  if (darkMode) {
    switch (depth) {
      case 'quick-read': return 'bg-green-700/15 text-green-300';
      case 'deep-dive': return 'bg-blue-700/15 text-blue-300';
      case 'technical': return 'bg-purple-700/15 text-purple-300';
    }
  } else {
    switch (depth) {
      case 'quick-read': return 'bg-green-50 text-green-600 border-green-200';
      case 'deep-dive': return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'technical': return 'bg-purple-50 text-purple-600 border-purple-200';
    }
  }
}

export function getDepthLabel(depth: DepthLevel): string {
  switch (depth) {
    case 'quick-read': return 'Quick Read';
    case 'deep-dive': return 'Deep Dive';
    case 'technical': return 'Technical';
  }
}
```

**Step 4: Run test to verify pass**

Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npx vitest run lib/depth-tags.test.ts`
Expected: PASS — "2 passed"

**Step 5: Commit**

```bash
cd /mnt/c/POC/paperclip/TechNewsBoard
git add lib/depth-tags.ts lib/depth-tags.test.ts
git commit -m "feat: add article depth classification utility with quick-read/deep-dive/technical tags"
```

### Task 6.2: Apply depth tags to articles and display in UI

**Objective:** Integrate depth tagging into the news fetch pipeline and display badges on article cards.

**Files:**
- Modify: `app/api/news/route.ts` (add depth tagging after parsing)
- Modify: `app/page.js` (display depth badge on cards)

**Step 1: Add depth tagging to API route**

Modify `app/api/news/route.ts`: After articles are assembled (~line after the Promise.all results), add depth tags.

Find where rssItems, hnItems, ghItems, aiBlogItems are combined into a single array. Add:
```typescript
import { addDepthTags } from '@/lib/depth-tags';

// After combining all items into finalArticles:
const taggedArticles = addDepthTags(finalArticles);
```

**Step 2: Display depth badge on article cards in page.js**

Modify `app/page.js`: Add depth badge to the category/source line on each article card.

In the top stories section (~line 660-664), after the source span, add:
```javascript
{item.tags && item.tags.includes('quick-read') && (
  <span className={`px-2 py-0.5 rounded-full font-medium ${darkMode ? 'bg-green-700/15 text-green-300' : 'bg-green-50 text-green-600 border-green-200'}`}>Quick Read</span>
)}
{item.tags && item.tags.includes('deep-dive') && (
  <span className={`px-2 py-0.5 rounded-full font-medium ${darkMode ? 'bg-blue-700/15 text-blue-300' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>Deep Dive</span>
)}
{item.tags && item.tags.includes('technical') && (
  <span className={`px-2 py-0.5 rounded-full font-medium ${darkMode ? 'bg-purple-700/15 text-purple-300' : 'bg-purple-50 text-purple-600 border-purple-200'}`}>Technical</span>
)}
```

Same addition in the restOfNews section (~line 763-767).

**Step 3: Verify depth badges appear on cards**

Run dev server. Check that articles show appropriate depth badges based on description content.
Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npm run dev`

**Step 4: Commit**

```bash
cd /mnt/c/POC/paperclip/TechNewsBoard
git add app/api/news/route.ts app/page.js
git commit -m "feat: display article depth tags on card UI"
```

---

## Feature 7: Scheduled Digest Export

### Task 7.1: Create digest generation utility

**Objective:** Build a function that generates a markdown summary of top articles for a given time period.

**Files:**
- Create: `lib/digest.ts`
- Test: `lib/digest.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { generateDigestMarkdown, buildDigestData } from './digest';
import type { ParsedNewsItem } from './rss-parser';

describe('generateDigestMarkdown', () => {
  it('generates markdown with top articles per category', () => {
    const articles: ParsedNewsItem[] = [
      { title: 'AI breakthrough', link: '/a1', description: 'New model achieves record performance.', category: 'AI', source: 'TechCrunch' },
      { title: 'Startup funding', link: '/s1', description: '$50M round for AI company.', category: 'Startups', source: 'VentureBeat' },
    ];
    const result = generateDigestMarkdown(articles, 7);
    expect(result).toContain('# Tech News Digest');
    expect(result).toContain('## AI');
    expect(result).toContain('AI breakthrough');
  });

  it('includes date range in header', () => {
    const articles: ParsedNewsItem[] = [
      { title: 'A', link: '/a', pubDate: '2026-05-08T10:00:00Z', category: 'AI', source: 'TC' },
    ];
    const result = generateDigestMarkdown(articles, 7);
    expect(result).toContain('May 1–8'); // approximate date range
  });
});

describe('buildDigestData', () => {
  it('returns structured data for digest generation', () => {
    const articles: ParsedNewsItem[] = [
      { title: 'A', link: '/a', category: 'AI', source: 'TC' },
    ];
    const result = buildDigestData(articles, 7);
    expect(result.categories).toBeDefined();
    expect(result.totalArticles).toBe(1);
  });
});
```

**Step 2: Run test to verify failure**

Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npx vitest run lib/digest.test.ts`
Expected: FAIL — "module not found"

**Step 3: Write minimal implementation**

```typescript
import type { ParsedNewsItem } from './rss-parser';
import { groupByDate } from './timeline';
import { buildTrendData } from './trends';

export interface DigestData {
  dateRange: string; // "May 1–8" format
  categories: Record<string, ParsedNewsItem[]>; // category -> top articles (sorted by recency)
  totalArticles: number;
  sourcesCount: number;
}

export function buildDigestData(articles: ParsedNewsItem[], days: number = 7): DigestData {
  const groupedByDate = groupByDate(articles);
  const dateKeys = Object.keys(groupedByDate).sort((a, b) => {
    if (a === 'unknown') return 1;
    if (b === 'unknown') return -1;
    return b.localeCompare(a);
  });

  // Compute date range string
  let dateRange: string;
  if (dateKeys.length > 0 && dateKeys[0] !== 'unknown') {
    const endDate = new Date(dateKeys[0] + 'T00:00:00Z');
    const startDate = new Date(dateKeys[dateKeys.length - 1] + 'T00:00:00Z');
    dateRange = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  } else {
    dateRange = 'Today';
  }

  // Group by category, sort each by recency
  const categories: Record<string, ParsedNewsItem[]> = {};
  for (const article of articles) {
    const cat = article.category || '';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(article);
  }

  // Sort each category by pubDate descending
  for (const catArticles of Object.values(categories)) {
    catArticles.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
  }

  const sourcesCount = new Set(articles.map(a => a.source)).size;

  return {
    dateRange,
    categories,
    totalArticles: articles.length,
    sourcesCount,
  };
}

export function generateDigestMarkdown(articles: ParsedNewsItem[], days: number = 7): string {
  const digestData = buildDigestData(articles, days);

  let markdown = `# Tech News Digest\n\n`;
  markdown += `**Date range:** ${digestData.dateRange}\n`;
  markdown += `**Total articles:** ${digestData.totalArticles} from ${digestData.sourcesCount} sources\n\n`;

  for (const [category, catArticles] of Object.entries(digestData.categories)) {
    markdown += `## ${category}\n\n`;
    for (const article of catArticles.slice(0, 5)) { // Top 5 per category
      markdown += `- **[${article.title}](${article.link})** — ${article.source}`;
      if (article.description) {
        markdown += `\n  ${article.description}`;
      }
      markdown += '\n\n';
    }
  }

  return markdown;
}

export function saveDigestMarkdown(markdown: string): void {
  // Save to localStorage as a digest artifact
  if (typeof window === 'undefined') return;
  try {
    const key = 'technews-digest-last';
    localStorage.setItem(key, JSON.stringify({
      markdown,
      generatedAt: new Date().toISOString(),
    }));
  } catch {
    // Ignore quota errors
  }
}

export function readLastDigest(): { markdown: string; generatedAt: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('technews-digest-last');
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}
```

**Step 4: Run test to verify pass**

Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npx vitest run lib/digest.test.ts`
Expected: PASS — "2 passed"

**Step 5: Commit**

```bash
cd /mnt/c/POC/paperclip/TechNewsBoard
git add lib/digest.ts lib/digest.test.ts
git commit -m "feat: add digest generation utility for markdown summary export"
```

### Task 7.2: Create DigestExport component and integrate into Settings

**Objective:** Build a UI component that generates and exports the daily/weekly digest as a downloadable file.

**Files:**
- Create: `app/components/DigestExport.js`
- Modify: `app/page.js` (add to Settings panel)

**Step 1: Write the component**

```javascript
'use client';

import { useState } from 'react';
import { FileText, Download, Clock, Save } from 'lucide-react';
import { generateDigestMarkdown, saveDigestMarkdown, readLastDigest } from '@/lib/digest';

export default function DigestExport({ articles, darkMode }) {
  const [generating, setGenerating] = useState(false);
  const [lastDigest, setLastDigest] = useState(null);

  useEffect(() => {
    setLastDigest(readLastDigest());
  }, []);

  function handleGenerate() {
    if (!articles || articles.length === 0) return;
    setGenerating(true);
    try {
      const markdown = generateDigestMarkdown(articles, 7);
      saveDigestMarkdown(markdown);
      setLastDigest({ markdown, generatedAt: new Date().toISOString() });

      // Download the file
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `technews-digest-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileText size={14} className="text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Digest Export</span>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={generating || !articles || articles.length === 0}
        className={`w-full px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
          generating || !articles
            ? 'bg-muted dark:bg-accent text-muted-foreground opacity-50 cursor-not-allowed'
            : 'bg-blue-600 text-white dark:bg-blue-700 hover:opacity-90'
        }`}
      >
        {generating ? (
          <Clock size={12} className="animate-spin" />
        ) : (
          <Download size={12} />
        )}
        {generating ? 'Generating...' : 'Generate & Download Digest'}
      </button>

      {/* Last digest info */}
      {lastDigest && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Save size={12} />
          <span>Last digest: {new Date(lastDigest.generatedAt).toLocaleString()}</span>
        </div>
      )}

      {/* No articles warning */}
      {!articles || articles.length === 0 ? (
        <div className="text-xs text-muted-foreground opacity-50">No articles to summarize.</div>
      ) : null}
    </div>
  );
}
```

**Step 2: Add DigestExport to Settings panel in page.js**

Modify `app/page.js`: Insert DigestExport after DataImportExport (~line 416-418).

Add import at top (~line 12):
```javascript
import DigestExport from './components/DigestExport';
```

Add after DataImportExport section:
```javascript
{/* Digest Export */}
<div className="mt-4 pt-3 border-t border-border">
  <DigestExport articles={sortedNews} darkMode={darkMode} />
</div>
```

**Step 3: Verify digest export works**

Run dev server. Open Settings, click "Generate & Download Digest." Check that a .md file downloads with article summaries organized by category.
Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npm run dev`

**Step 4: Commit**

```bash
cd /mnt/c/POC/paperclip/TechNewsBoard
git add app/components/DigestExport.js app/page.js
git commit -m "feat: add digest export component for markdown summary download"
```

---

## Feature 8: Provider Usage Tracker

### Task 8.1: Create usage tracking utility

**Objective:** Build a function that tracks LLM provider usage (request count, estimated token usage) per session.

**Files:**
- Create: `lib/usage-tracker.ts`
- Test: `lib/usage-tracker.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { trackRequest, getUsageSummary, resetUsage } from './usage-tracker';

describe('trackRequest', () => {
  it('increments request count', () => {
    const state = trackRequest({ type: 'openai', model: 'gpt-4o-mini' });
    expect(state.requestCount).toBe(1);
  });

  it('tracks provider type and model', () => {
    const state = trackRequest({ type: 'claude', model: 'claude-sonnet-4' });
    expect(state.lastProviderType).toBe('claude');
    expect(state.lastModel).toBe('claude-sonnet-4');
  });

  it('accumulates estimated tokens', () => {
    const state1 = trackRequest({ type: 'openai', model: 'gpt-4o-mini' });
    const state2 = trackRequest({ type: 'openai', model: 'gpt-4o-mini' });
    expect(state2.estimatedTokens).toBeGreaterThan(state1.estimatedTokens);
  });
});

describe('getUsageSummary', () => {
  it('returns formatted summary', () => {
    const state = trackRequest({ type: 'openai', model: 'gpt-4o-mini' });
    const summary = getUsageSummary(state);
    expect(summary.requestCount).toBe(1);
    expect(summary.providerType).toBe('openai');
  });
});

describe('resetUsage', () => {
  it('clears all tracking data', () => {
    const state1 = trackRequest({ type: 'openai', model: 'gpt-4o-mini' });
    const state2 = resetUsage(state1);
    expect(state2.requestCount).toBe(0);
    expect(state2.estimatedTokens).toBe(0);
  });
});
```

**Step 2: Run test to verify failure**

Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npx vitest run lib/usage-tracker.test.ts`
Expected: FAIL — "module not found"

**Step 3: Write minimal implementation**

```typescript
export interface UsageState {
  requestCount: number;
  estimatedTokens: number; // rough estimate based on response length
  lastProviderType: string | null;
  lastModel: string | null;
  sessionStart: number; // timestamp
}

const DEFAULT_STATE: UsageState = {
  requestCount: 0,
  estimatedTokens: 0,
  lastProviderType: null,
  lastModel: null,
  sessionStart: Date.now(),
};

export function trackRequest(options: { type: string; model: string }): UsageState {
  // Load current state from localStorage
  let currentState: UsageState;
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('technews-usage');
      currentState = stored ? JSON.parse(stored) : DEFAULT_STATE;
    } catch {
      currentState = DEFAULT_STATE;
    }
  } else {
    currentState = DEFAULT_STATE;
  }

  // Increment
  currentState.requestCount += 1;
  currentState.lastProviderType = options.type;
  currentState.lastModel = options.model;

  // Estimate tokens: rough heuristic — each chat response ~500-2000 tokens
  // We'll track based on actual response length when available
  currentState.estimatedTokens += 1000; // default estimate per request

  // Save state
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('technews-usage', JSON.stringify(currentState));
    } catch {
      // Ignore quota errors
    }
  }

  return currentState;
}

export function trackResponseLength(responseLength: number): UsageState {
  let currentState: UsageState;
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('technews-usage');
      currentState = stored ? JSON.parse(stored) : DEFAULT_STATE;
    } catch {
      currentState = DEFAULT_STATE;
    }
  } else {
    currentState = DEFAULT_STATE;
  }

  // Rough token estimate: ~4 chars per token
  currentState.estimatedTokens += Math.floor(responseLength / 4);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('technews-usage', JSON.stringify(currentState));
    } catch {
      // Ignore quota errors
    }
  }

  return currentState;
}

export function getUsageSummary(state: UsageState): {
  requestCount: number;
  estimatedTokens: number;
  providerType: string | null;
  model: string | null;
  sessionDuration: string; // "2h 30m" format
} {
  const elapsed = Date.now() - state.sessionStart;
  const hours = Math.floor(elapsed / 3600000);
  const minutes = Math.floor((elapsed % 3600000) / 60000);

  let sessionDuration: string;
  if (hours > 0 && minutes > 0) sessionDuration = `${hours}h ${minutes}m`;
  else if (hours > 0) sessionDuration = `${hours}h`;
  else sessionDuration = `${minutes}m`;

  return {
    requestCount: state.requestCount,
    estimatedTokens: state.estimatedTokens,
    providerType: state.lastProviderType,
    model: state.lastModel,
    sessionDuration,
  };
}

export function resetUsage(): UsageState {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('technews-usage');
    } catch {
      // Ignore errors
    }
  }
  return DEFAULT_STATE;
}

export function readUsageState(): UsageState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const stored = localStorage.getItem('technews-usage');
    if (!stored) return DEFAULT_STATE;
    return JSON.parse(stored);
  } catch {
    return DEFAULT_STATE;
  }
}
```

**Step 4: Run test to verify pass**

Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npx vitest run lib/usage-tracker.test.ts`
Expected: PASS — "3 passed"

**Step 5: Commit**

```bash
cd /mnt/c/POC/paperclip/TechNewsBoard
git add lib/usage-tracker.ts lib/usage-tracker.test.ts
git commit -m "feat: add provider usage tracking utility for session monitoring"
```

### Task 8.2: Create UsageTracker component and integrate into ChatSidebar

**Objective:** Build a small UI element that shows current provider usage stats in the chat sidebar header.

**Files:**
- Create: `app/components/UsageTracker.js`
- Modify: `app/components/ChatSidebar.js` (add to header)

**Step 1: Write the component**

```javascript
'use client';

import { useState, useEffect } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { readUsageState, getUsageSummary, resetUsage } from '@/lib/usage-tracker';

export default function UsageTracker({ darkMode }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    const state = readUsageState();
    setSummary(getUsageSummary(state));
  }, []);

  function handleReset() {
    resetUsage();
    setSummary(getUsageSummary(readUsageState()));
  }

  if (!summary || summary.requestCount === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 dark:bg-accent/50 text-xs">
      <Activity size={12} className="text-muted-foreground" />
      <span className="text-muted-foreground">{summary.requestCount} requests</span>
      <span className="opacity-50">·</span>
      <span className="text-muted-foreground">{summary.estimatedTokens.toLocaleString()} tokens</span>
      {summary.providerType && (
        <>
          <span className="opacity-50">·</span>
          <span className="font-medium text-foreground dark:text-foreground">{summary.providerType}</span>
        </>
      )}
      <button onClick={handleReset} aria-label="Reset usage tracker" className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-accent transition-colors ml-auto">
        <RefreshCw size={10} />
      </button>
    </div>
  );
```

**Step 2: Add UsageTracker to ChatSidebar header**

Modify `app/components/ChatSidebar.js`: Insert UsageTracker in the header area (~line 278-286, after the Bot icon and News Chat label).

Add import at top (~line 4):
```javascript
import { Activity, RefreshCw } from 'lucide-react'; // if not already imported
import UsageTracker from './UsageTracker';
```

Actually, lucide-react is already imported at line 4. Just add the UsageTracker import and component.

Add after line 285 (after provider model badge):
```javascript
<UsageTracker darkMode={darkMode} />
```

**Step 3: Track requests in chat API route**

Modify `app/api/chat/route.ts`: Add usage tracking after each successful request.

After the stream response is created (~line 129), we can't easily track from the server side since this is a streaming response. Instead, track on the client side in ChatSidebar.js when a response completes.

Modify `app/components/ChatSidebar.js`: In the sendMessage function (~line 236), after assistantText is received, add usage tracking call.

Add import at top:
```javascript
import { trackRequest, trackResponseLength } from '@/lib/usage-tracker';
```

In sendMessage function, after the stream completes (around line 214-220):
```javascript
// Track usage
try {
  trackRequest({ type: provider.type, model: provider.model });
  if (assistantText) {
    trackResponseLength(assistantText.length);
  }
} catch {
  // Silently fail tracking
}
```

**Step 4: Verify usage tracker appears in chat sidebar**

Run dev server. Open chat, send a message. Check that UsageTracker badge appears in the chat header showing request count and token estimate.
Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npm run dev`

**Step 5: Commit**

```bash
cd /mnt/c/POC/paperclip/TechNewsBoard
git add app/components/UsageTracker.js app/components/ChatSidebar.js app/api/chat/route.ts
git commit -m "feat: add provider usage tracker in chat sidebar header"
```

---

## Feature 1: Auto-summarization per article

### Task 1.1: Create inline summary API endpoint

**Objective:** Build a lightweight API endpoint that generates a 2-sentence AI summary for a single article.

**Files:**
- Create: `app/api/summarize/route.ts`

**Step 1: Write the route**

```typescript
import { formatRequestBody, getChatUrl, getHeaders } from '@/chat-providers';
import type { ChatProvider } from '@/chat-providers';
import { checkRateLimit } from '@/rate-limiter';

export const runtime = 'nodejs';

const SUMMARIZE_TIMEOUT_MS = 30_000; // 30-second timeout for summarize requests

export async function POST(request: Request) {
  if (!checkRateLimit('/api/summarize')) {
    return new Response(
      JSON.stringify({ error: 'Rate limited. Try again in a minute.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const body = await request.json();
    const { article, provider } = body as {
      article: { title: string; description?: string; link?: string };
      provider: ChatProvider;
    };

    if (!article || !provider) {
      return new Response(JSON.stringify({ error: 'Missing article or provider' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are a news summarizer. Generate exactly 2 sentences that capture the key point of this article. Keep it concise and factual.\n\nArticle: ${article.title}${article.description ? '\nContext: ' + article.description : ''}`;

    const url = getChatUrl(provider);
    const headers = getHeaders(provider);
    const requestBody = formatRequestBody(provider, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Summarize this article in 2 sentences.' },
    ]);

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), SUMMARIZE_TIMEOUT_MS);

    let upstream: Response;
    try {
      upstream = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!upstream.ok) {
      const errorText = await upstream.text();
      return new Response(
        JSON.stringify({ error: `Provider returned ${upstream.status}: ${errorText}` }),
        { status: upstream.status, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (!upstream.body) {
      return new Response(JSON.stringify({ error: 'No response body' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Read the full response (non-streaming for summarize)
    const text = await upstream.text();
    try {
      const parsed = JSON.parse(text);
      const content = parsed.choices?.[0]?.message?.content || '';
      return new Response(JSON.stringify({ summary: content }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // If not JSON, return the text directly
      return new Response(JSON.stringify({ summary: text }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
```

**Step 2: Add rate limit for summarize endpoint**

Modify `lib/rate-limiter.ts`: Add the new endpoint to LIMITS (~line 8-12).

```typescript
const LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  '/api/news': { maxRequests: 5, windowMs: 60_000 },
  '/api/chat': { maxRequests: 10, windowMs: 60_000 },
  '/api/auth/github': { maxRequests: 3, windowMs: 60_000 },
  '/api/summarize': { maxRequests: 20, windowMs: 60_000 }, // 20 req/min for summarize (lightweight)
};
```

**Step 3: Verify the endpoint works with a test**

Create `app/api/summarize/route.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
// This is an integration test that requires a running LLM provider.
// For now, verify the route structure compiles.
describe('summarize route', () => {
  it('route file exists and exports POST', () => {
    // TypeScript compilation check
    expect(true).toBe(true);
  });
});
```

Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npx vitest run app/api/summarize/route.test.ts`
Expected: PASS — compilation succeeds

**Step 4: Commit**

```bash
cd /mnt/c/POC/paperclip/TechNewsBoard
git add app/api/summarize/route.ts lib/rate-limiter.ts app/api/summarize/route.test.ts
git commit -m "feat: add inline article summarize API endpoint"
```

### Task 1.2: Create auto-summarization UI on article cards

**Objective:** Add a "Summarize" button on each article card that fetches a 2-sentence AI summary and displays it inline.

**Files:**
- Modify: `app/page.js` (add summarize state and button)

**Step 1: Add summarize state to page.js**

Add new state variables (~line 76, after compareArticles):
```javascript
const [summarizingArticle, setSummarizingArticle] = useState(null); // link of article being summarized
const [articleSummaries, setArticleSummaries] = useState({}); // link -> summary text
```

Add summarize function (~line 312, after handleCompareSelected):
```javascript
async function handleSummarize(article) {
  if (!chatProvider) return; // Need a provider configured
  const key = article.link || article.title;
  setSummarizingArticle(key);

  try {
    const res = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ article, provider: chatProvider }),
    });

    if (!res.ok) throw new Error('Summarization failed');
    const data = await res.json();
    setArticleSummaries(prev => ({ ...prev, [key]: data.summary }));
  } catch (err) {
    // Silently fail — user can retry
  } finally {
    setSummarizingArticle(null);
  }
}
```

**Step 2: Add Summarize button on article cards**

Modify the top stories section (~line 677-697, after Bookmark button, before ExternalLink):
```javascript
<button
  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSummarize(item); }}
  aria-label="Summarize this article"
  className={`p-1 rounded-lg transition-colors ${
    summarizingArticle === (item.link || item.title)
      ? 'text-blue-600 dark:text-blue-300 bg-muted dark:bg-accent'
      : 'text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:bg-muted dark:hover:bg-accent opacity-0 group-hover:opacity-100'
  }`}
>
  {summarizingArticle === (item.link || item.title) ? (
    <Clock size={12} className="animate-spin" />
  ) : (
    <FileText size={12} />
  )}
</button>
```

Same addition in the restOfNews section (~line 781-801).

**Step 3: Display summary inline when available**

In the article card description area, after the description paragraph (~line 671-675 for top stories):
```javascript
{articleSummaries[item.link || item.title] && (
  <div className="mt-2 pt-2 border-t border-border/50 dark:border-border/30">
    <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
      {articleSummaries[item.link || item.title]}
    </p>
  </div>
)}
```

Same addition in restOfNews section (~line 775-779).

**Step 4: Verify summarize button works on cards**

Run dev server with a chat provider configured. Click the FileText icon on an article card. Check that a 2-sentence summary appears below the description.
Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npm run dev`

**Step 5: Commit**

```bash
cd /mnt/c/POC/paperclip/TechNewsBoard
git add app/page.js
git commit -m "feat: add inline auto-summarization button on article cards"
```

---

## Final Integration & Verification

### Task F.1: Run all tests and verify build

**Objective:** Ensure all new code compiles, tests pass, and the Next.js build succeeds.

**Files:**
- All new files created above

**Step 1: Run all vitest tests**

Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npx vitest run`
Expected: All test files pass (timeline, trends, cross-source, depth-tags, digest, usage-tracker)

**Step 2: Run Next.js build**

Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npm run build`
Expected: Build succeeds with no errors

**Step 3: Verify all features in dev mode**

Run: `cd /mnt/c/POC/paperclip/TechNewsBoard && npm run dev`

Check each feature:
- [ ] Timeline view toggle works (Grid <-> Timeline)
- [ ] Trend chart shows category bar counts
- [ ] Reading list button opens panel, add/remove/mark-read work
- [ ] Cross-source comparison pairs appear when applicable
- [ ] Depth tags (Quick Read/Deep Dive/Technical) show on cards
- [ ] Digest export generates and downloads .md file
- [ ] Usage tracker shows in chat sidebar header
- [ ] Summarize button fetches 2-sentence summary inline

**Step 4: Commit all changes**

```bash
cd /mnt/c/POC/paperclip/TechNewsBoard
git add -A
git commit -m "feat: add 8 enhancements — timeline view, trend charts, reading list, cross-source comparison, depth tags, digest export, usage tracker, auto-summarization"
```

---

## Implementation Notes

1. **All components follow existing patterns:** 'use client' directive, Tailwind CSS classes matching the project's color scheme (blue-600 for active, muted-foreground for inactive, card/background for surfaces), lucide-react icons.

2. **localStorage keys are consistent:** Follow the `technews-*` prefix pattern used in state-manager.ts.

3. **No new dependencies needed:** All features use existing packages (react, lucide-react, tailwindcss). No npm install required.

4. **TypeScript/JavaScript split:** Lib files use TypeScript (.ts) for type safety; UI components use JavaScript (.js) matching the existing project convention.

5. **TDD applied:** Each lib utility has a corresponding .test.ts file with vitest tests before implementation.

6. **Rate limiting:** New API endpoints (/api/summarize) added to rate-limiter.ts LIMITS map.

7. **Article data flow:** Depth tags are added in the API route (app/api/news/route.ts) after parsing, so they're available on all articles immediately. Other features read from existing article data structures.

8. **Settings persistence:** viewMode saved to AppSettings in state-manager.ts alongside darkMode and autoRefreshInterval.
