'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Moon, Sun, ExternalLink, Clock, Zap, Search, Bookmark, BookmarkCheck, Settings, ChevronDown, X, ArrowUpRight, MessageCircle, Rss, Bell, Check } from 'lucide-react';
import Link from 'next/link';
import ChatSidebar from './components/ChatSidebar';
import ChatProviderSettings from './components/ChatProviderSettings';
import FeedManager from './components/FeedManager';
import DataImportExport from './components/DataImportExport';
import NotificationSettings from './components/NotificationSettings';
import * as NotificationStore from '@/lib/notification-store';
import { getEnabledSources } from '@/lib/feed-store';

const CATEGORY_MAP = ['All', 'Startups', 'Consumer Tech', 'AI', 'Innovation', 'Open Source'];
const DAY_RANGES = [
  { label: 'Today', days: 1 },
  { label: '3 Days', days: 3 },
  { label: '7 Days', days: 7 },
  { label: '14 Days', days: 14 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
];
const REFRESH_INTERVALS = [
  { label: 'Off', value: 0 },
  { label: '15 min', value: 900000 },
  { label: '30 min', value: 1800000 },
  { label: '1 hour', value: 3600000 },
  { label: '3 hours', value: 10800000 },
  { label: '12 hours', value: 43200000 },
];

const BOOKMARKS_KEY = 'technews-bookmarks';
const SETTINGS_KEY = 'technews-settings';

function loadBookmarks() {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(BOOKMARKS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
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
  } catch {
    return null;
  }
}

function saveSettings(settings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export default function Home() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState(null);
  const [selectedSources, setSelectedSources] = useState(null);
  const [dayRange, setDayRange] = useState(3);
  const [sortBy, setSortBy] = useState('newest');
  const [darkMode, setDarkMode] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(1800000);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const searchTimeoutRef = useRef(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sourceFilterOpen, setSourceFilterOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatProvider, setChatProvider] = useState(null);
  const [feedManagerOpen, setFeedManagerOpen] = useState(false);
  const [selectedArticles, setSelectedArticles] = useState(new Set());
  const [focusArticle, setFocusArticle] = useState(null);
  const [compareArticles, setCompareArticles] = useState(null);
  const [chatLayoutMode, setChatLayoutMode] = useState('split');

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchQuery]);

  useEffect(() => {
    fetchNews();
  }, [dayRange, selectedCategories, debouncedSearchQuery]);

  useEffect(() => {
    setSelectedCategories(new Set(['All']));
    setSelectedSources(new Set());
    setBookmarks(loadBookmarks());
  }, []);

  useEffect(() => {
    const savedSettings = loadSettings();
    if (savedSettings) {
      setDarkMode(savedSettings.darkMode ?? false);
      setAutoRefreshInterval(savedSettings.autoRefreshInterval ?? 1800000);
    }
  }, []);

  useEffect(() => {
    saveSettings({ darkMode, autoRefreshInterval });
  }, [darkMode, autoRefreshInterval]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    if (autoRefreshInterval === 0 || loading) return;

    const interval = setInterval(async () => {
      await fetchNews(true);
    }, autoRefreshInterval);

    return () => clearInterval(interval);
  }, [autoRefreshInterval, loading]);

  async function fetchNews(isRefresh = false) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      
      if (isRefresh) params.set('refresh', 'true');
      
      if (dayRange < Infinity && dayRange !== undefined) {
        params.set('days', String(dayRange));
      }
      
      const cats = selectedCategories || new Set(['All']);
      if (!cats.has('All')) {
        [...cats].forEach(cat => params.append('category', cat));
      }
      
      if (searchQuery.trim()) {
        params.set('q', searchQuery.trim());
      }

      // Pass enabled feed sources so the server knows which feeds to fetch
      const enabledSources = getEnabledSources();
      const sourceNames = enabledSources.map(s => s.source);
      params.set('feeds', JSON.stringify(sourceNames));
      
      const queryString = params.toString();
      const url = `/api/news${queryString ? '?' + queryString : ''}`;

      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch news');
      const data = await res.json();
      setNews(data);
      setLastFetchTime(new Date());

      // Check for notification matches
      try {
        const config = NotificationStore.loadNotificationConfig();
        if (config.enabled && ('Notification' in window)) {
          const result = NotificationStore.checkArticleMatches(data);
          if (result.matchedArticles.length > 0) {
            NotificationStore.showNotifications(result.matchedArticles);
          }
        }
      } catch {
        // Silently fail notification checks
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleCategory(cat) {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (cat === 'All') {
        next.clear();
        next.add('All');
      } else {
        if (next.has(cat)) {
          next.delete(cat);
          if (next.size === 0) next.add('All');
        } else {
          next.delete('All');
          next.add(cat);
        }
      }
      return next;
    });
  }

  function toggleSource(source) {
    setSelectedSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  }

  function handleResetFilters() {
    setSelectedCategories(new Set(['All']));
    setSelectedSources(new Set());
    setDayRange(3);
    setSortBy('newest');
    setSearchQuery('');
    fetchNews();
  }

  function toggleBookmark(article) {
    const key = article.link || article.title;
    const exists = bookmarks.some(b => b.link === key);
    let newBookmarks;
    if (exists) {
      newBookmarks = bookmarks.filter(b => b.link !== key);
    } else {
      newBookmarks = [...bookmarks, { ...article, bookmarkedAt: new Date().toISOString() }];
    }
    setBookmarks(newBookmarks);
    saveBookmarks(newBookmarks);
  }

  function isBookmarked(link) {
    return bookmarks.some(b => b.link === link);
  }

  const allSources = [...new Set(news.map(n => n.source))].sort();

  const filteredNews = news.filter(n => {
    const cats = selectedCategories || new Set(['All']);
    const sources = selectedSources || new Set();
    if (!cats.has('All') && !cats.has(n.category)) return false;
    if (sources.size > 0 && !sources.has(n.source)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!(n.title.toLowerCase().includes(q) || (n.description && n.description.toLowerCase().includes(q)))) return false;
    }
    return true;
  });

  const sortedNews = [...filteredNews].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.pubDate || 0) - new Date(a.pubDate || 0);
    return new Date(a.pubDate || 0) - new Date(b.pubDate || 0);
  });

  const topStories = sortedNews.slice(0, 5);
  const restOfNews = sortedNews.slice(5);

  function formatPubDate(pubDate) {
    if (!pubDate) return '';
    try {
      const date = new Date(pubDate);
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
    } catch {
      return '';
    }
  }

  function formatRelativeTime(pubDate) {
    if (!pubDate) return '';
    try {
      const diff = Date.now() - new Date(pubDate).getTime();
      const hours = Math.floor(diff / 3600000);
      if (hours < 1) return 'just now';
      if (hours === 1) return '1 hour ago';
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days === 1) return '1 day ago';
      return `${days}d ago`;
    } catch {
      return '';
    }
  }

  function isFavicon(url) {
    return url?.includes('www.google.com/s2/favicons') ?? false;
  }

  function toggleArticleSelection(item) {
    const key = item.link || item.title;
    setSelectedArticles(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleAskAbout(item) {
    setChatOpen(true);
    setFocusArticle({ title: item.title, source: item.source, description: item.description, link: item.link });
  }

  function handleCompareSelected() {
    if (selectedArticles.size < 2) return;
    const selected = sortedNews.filter(item => {
      const key = item.link || item.title;
      return selectedArticles.has(key);
    });
    setChatOpen(true);
    setCompareArticles(selected.map(a => ({ title: a.title, source: a.source, category: a.category, description: a.description, link: a.link })));
  }

  function handleLayoutToggle() {
    setChatLayoutMode(prev => prev === 'overlay' ? 'split' : 'overlay');
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground transition-[background-color,color] duration-300" style={{ backgroundImage: darkMode ? undefined : 'linear-gradient(135deg, #f9fafb, #ebf5ff)' }}>
      {/* Header */}
      <header className="flex-shrink-0 z-40 border-b backdrop-blur-xl bg-card/70 dark:bg-background/80 border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">Tech News Dashboard</h1>
            {autoRefreshInterval > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-800/30 text-green-800 dark:text-green-100">
                <Zap size={10} className="animate-pulse" /> Auto-refresh ON
              </span>
            )}
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="p-2 rounded-lg transition-colors hover:bg-muted dark:hover:bg-accent"
              aria-label="Settings"
            >
              <Settings size={18} />
            </button>
            {autoRefreshInterval > 0 && (
                <span className="hidden md:inline text-xs px-2 py-0.5 rounded-full bg-secondary dark:bg-accent text-muted-foreground">
                {REFRESH_INTERVALS.find(i => i.value === autoRefreshInterval)?.label}
              </span>
            )}
            <Link href="/bookmarks" className="p-2 rounded-lg transition-colors hover:bg-muted dark:hover:bg-accent relative" aria-label="Bookmarks">
              <Bookmark size={18} />
              {bookmarks.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold bg-blue-600 text-white">
                  {bookmarks.length}
                </span>
              )}
            </Link>
            <button
              onClick={() => fetchNews(true)}
              disabled={loading}
              aria-label="Refresh now"
              className="p-2 rounded-lg transition-colors hover:bg-muted dark:hover:bg-accent"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-lg transition-colors hover:bg-muted dark:hover:bg-accent"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {settingsOpen && (
          <div className="border-t border-border dark:border-border bg-card/90 dark:bg-background/90 backdrop-blur-xl">
            <div className="max-w-6xl mx-auto px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Auto-refresh interval</span>
                  <button onClick={() => setSettingsOpen(false)} aria-label="Close settings" className="p-1 rounded hover:bg-muted dark:hover:bg-accent text-muted-foreground">
                  <X size={14} />
                </button>
              </div>
              <div className="flex gap-2">
                {REFRESH_INTERVALS.map(interval => (
                  <button
                    key={interval.value}
                    onClick={() => setAutoRefreshInterval(interval.value)}
                    touch-action="manipulation"
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      autoRefreshInterval === interval.value
                        ? 'bg-blue-600 text-white dark:bg-blue-700'
                        : 'bg-secondary hover:bg-muted text-muted-foreground border-border dark:bg-accent dark:hover:bg-muted/80 dark:text-muted-foreground dark:border-border'
                    }`}
                  >
                    {interval.label}
                  </button>
                ))}
              </div>

              {/* Manage Feeds Button */}
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                <button
                  onClick={() => setFeedManagerOpen(!feedManagerOpen)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${feedManagerOpen ? 'bg-blue-600 text-white dark:bg-blue-700' : 'bg-secondary hover:bg-muted text-muted-foreground border-border dark:bg-accent dark:hover:bg-muted/80 dark:text-muted-foreground dark:border-border'}`}
                >
                  <Rss size={14} className="mr-1 inline" />
                  Manage Feeds
                </button>
              </div>

              {/* Feed Manager */}
              {feedManagerOpen && (
                <div className="mt-3 pt-2 border-t border-border">
                  <FeedManager darkMode={darkMode} onFeedsChange={() => fetchNews()} />
                </div>
              )}

              {/* Data Import/Export */}
              <div className="mt-4 pt-3 border-t border-border">
                <DataImportExport darkMode={darkMode} />
              </div>

              {/* Notification Settings */}
              <div className="mt-4 pt-3 border-t border-border">
                <NotificationSettings darkMode={darkMode} />
              </div>

              {/* Chat Provider Settings */}
              <div className="mt-4 pt-3 border-t border-border">
                <ChatProviderSettings darkMode={darkMode} onProviderChange={setChatProvider} />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Content area */}
      <div className={`flex-1 min-h-0 ${chatLayoutMode === 'split' ? 'flex' : ''}`}>
      {/* Main Content */}
      <main className={`${chatLayoutMode === 'split' ? 'flex-1 min-w-0' : ''} overflow-y-auto px-4 py-5`}>
        <div className="max-w-6xl mx-auto">
        {/* Search Bar */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search articles by title or description"
            placeholder="Search articles by title or description..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border transition-[border-color,background-color,color] bg-card dark:bg-card border-border dark:border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-2"
            style={{ '--tw-ring-color': darkMode ? 'var(--primary-700)' : 'var(--primary-600)' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-0.5 rounded-md text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {/* Categories */}
          <span className="text-xs text-muted-foreground">Categories:</span>
          {CATEGORY_MAP.map(cat => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                (selectedCategories || new Set(['All'])).has(cat)
                  ? 'bg-blue-600 text-white dark:bg-blue-700'
                  : 'bg-secondary hover:bg-muted text-muted-foreground border-border dark:bg-accent dark:hover:bg-muted/80 dark:text-muted-foreground dark:border-border'
              }`}
              touch-action="manipulation"
            >
              {cat}
            </button>
          ))}

          {/* Day Range */}
          <span className="text-xs ml-3 text-muted-foreground">Time:</span>
          {DAY_RANGES.map(range => (
            <button
              key={range.label}
              onClick={() => setDayRange(range.days)}
              touch-action="manipulation"
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                dayRange === range.days
                  ? 'bg-blue-600 text-white dark:bg-blue-700'
                  : 'bg-secondary hover:bg-muted text-muted-foreground border-border dark:bg-accent dark:hover:bg-muted/80 dark:text-muted-foreground dark:border-border'
              }`}
            >
              {range.label}
            </button>
          ))}

          {/* Sort */}
          <span className="text-xs ml-3 text-muted-foreground">Sort:</span>
          <div className="flex gap-1">
            <button
              onClick={() => setSortBy('newest')}
              touch-action="manipulation"
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                sortBy === 'newest'
                  ? 'bg-blue-600 text-white dark:bg-blue-700'
                  : 'bg-secondary hover:bg-muted text-muted-foreground border-border dark:bg-accent dark:hover:bg-muted/80 dark:text-muted-foreground dark:border-border'
              }`}
            >
              Newest
            </button>
            <button
              onClick={() => setSortBy('oldest')}
              touch-action="manipulation"
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                sortBy === 'oldest'
                  ? 'bg-blue-600 text-white dark:bg-blue-700'
                  : 'bg-secondary hover:bg-muted text-muted-foreground border-border dark:bg-accent dark:hover:bg-muted/80 dark:text-muted-foreground dark:border-border'
              }`}
            >
              Oldest
            </button>
          </div>

          {/* Source Filter */}
          <span className="text-xs ml-3 text-muted-foreground">Source:</span>
          {allSources.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setSourceFilterOpen(!sourceFilterOpen)}
                touch-action="manipulation"
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                  sourceFilterOpen
                    ? 'bg-secondary dark:bg-accent text-foreground border-border'
                    : selectedSources && selectedSources.size > 0
                      ? 'bg-blue-600/15 text-blue-600 border-blue-200 dark:bg-blue-700/15 dark:text-blue-300 dark:border-blue-700'
                      : 'bg-secondary hover:bg-muted text-muted-foreground border-border dark:bg-accent dark:hover:bg-muted/80 dark:text-muted-foreground dark:border-border'
                }`}
              >
                {(selectedSources?.size ?? 0) > 0 ? (
                  [...selectedSources].slice(0, 2).join(', ') + ((selectedSources?.size ?? 0) > 2 ? '...' : '')
                ) : 'All'}
                <ChevronDown size={12} />
              </button>
              {sourceFilterOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSourceFilterOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 z-50 p-2 rounded-xl border shadow-lg min-w-[200px] max-h-[300px] overflow-y-auto bg-popover dark:bg-card border-border">
                    {allSources.map(source => (
                      <button
                        key={source}
                        onClick={() => toggleSource(source)}
                        touch-action="manipulation"
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-2 ${
                          ((selectedSources || new Set()).has(source))
                            ? 'bg-blue-600/15 dark:bg-blue-700/15 text-blue-600 dark:text-blue-300'
                            : 'hover:bg-muted dark:hover:bg-accent text-muted-foreground dark:text-muted-foreground'
                        }`}
                      >
                        <span className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${
                          (selectedSources || new Set()).has(source)
                            ? 'bg-blue-600 dark:bg-blue-700 border-blue-600 dark:border-blue-700'
                            : 'border-border dark:border-border'
                        }`}>
                          {(selectedSources || new Set()).has(source) && <X size={8} className="text-white" />}
                        </span>
                        {source}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Active filter count */}
          {(selectedSources && selectedSources.size > 0 || dayRange < Infinity || !selectedCategories || !selectedCategories.has('All') || searchQuery.trim()) && (
            <span className="text-xs text-muted-foreground">
              ({sortedNews.length} results)
            </span>
          )}

          {/* Reset button */}
          {((selectedSources?.size ?? 0) > 0 || dayRange !== 3 || !selectedCategories?.has('All') || searchQuery.trim() || sortBy !== 'newest') && (
            <button
              onClick={handleResetFilters}
              className="px-2 py-1 rounded-full text-xs font-medium border border-border bg-secondary hover:bg-muted dark:bg-accent dark:hover:bg-muted/80 text-muted-foreground"
            >
              Reset
            </button>
          )}
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <RefreshCw size={32} className="animate-spin opacity-40 mb-3" />
            <span className={`text-sm ${darkMode ? 'opacity-40' : 'opacity-50'}`}>Loading news...</span>
          </div>
        )}

        {error && !loading && (
          <div className="p-5 rounded-xl mb-5 bg-destructive/10 dark:bg-destructive/20 border border-destructive dark:border-destructive/60">
            <p className="text-sm">{error}</p>
            <button onClick={() => fetchNews(true)} className="mt-2 px-3 py-1.5 text-sm rounded-lg font-medium bg-destructive/20 dark:bg-destructive/30 text-destructive hover:bg-destructive/30 dark:hover:bg-destructive/40">Try again</button>
          </div>
        )}

        {/* Executive Summary - Today's Top Stories */}
        {!loading && !error && topStories.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-3 text-muted-foreground">Today's Top Stories</h2>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {topStories.map((item, idx) => {
                const itemKey = item.link || item.title;
                const isSelected = selectedArticles.has(itemKey);
                return (
                  <a
                    key={idx}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block p-4 rounded-xl border transition-all hover:shadow-md group relative overflow-hidden bg-card dark:bg-card ${isSelected ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-border dark:border-border'} hover:shadow-lg`}
                  >
                    {item.gradientClass && (
                      <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${item.gradientClass}`} />
                    )}
                    {/* Selection checkbox */}
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleArticleSelection(item); }}
                      className="absolute top-2 left-2 z-10 p-1 rounded-md bg-card dark:bg-card border border-border opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <div className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center ${isSelected ? 'bg-blue-600' : 'border border-muted-foreground/40'}`}>
                        {isSelected && <Check size={10} className="text-white" />}
                      </div>
                    </button>
                    {item.image && (
                      <div className={`mb-3 rounded-lg overflow-hidden bg-muted dark:bg-accent flex items-center justify-center ${isFavicon(item.image) ? 'h-12' : ''}`}>
                        <img src={item.image} alt="" className={`w-full ${isFavicon(item.image) ? 'h-8 object-contain p-1.5' : 'h-20 object-cover'}`} loading="lazy" onError={e => e.currentTarget.style.display = 'none'} />
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 text-xs text-muted-foreground">
                          <span className={`px-2 py-0.5 rounded-full font-medium ${darkMode ? 'bg-blue-700/15 text-blue-300' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>{item.category}</span>
                          <span className="w-1 h-1 rounded-full bg-muted dark:bg-accent" aria-hidden="true" />
                          <span>{item.source}</span>
                          {item.language && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-muted dark:bg-accent" aria-hidden="true" />
                            </>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold leading-snug mb-1.5 group-hover:underline truncate">{item.title}</h3>
                        {item.description && (
                          <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAskAbout(item); }}
                          aria-label="Ask about this article"
                          className="p-1 rounded-lg text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:bg-muted dark:hover:bg-accent transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <MessageCircle size={12} />
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleBookmark(item); }}
                          aria-label={isBookmarked(item.link || item.title) ? 'Remove bookmark' : 'Bookmark article'}
                        className={`p-1 rounded-lg transition-colors ${
                          isBookmarked(item.link || item.title)
                            ? 'dark:text-blue-300 dark:hover:bg-accent text-blue-600 hover:bg-blue-50'
                            : 'text-muted-foreground dark:text-muted-foreground/50 hover:text-foreground hover:bg-muted dark:hover:bg-accent'
                        }`}
                      >
                        {isBookmarked(item.link || item.title) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                      </button>
                      <ExternalLink size={12} className={`opacity-0 group-hover:opacity-30 transition-opacity`} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Clock size={12} />
                    {formatPubDate(item.pubDate)}
                    <span className="opacity-50">·</span>
                    <span>{formatRelativeTime(item.pubDate)}</span>
                  </div>
                </a>
              );
            })}
            </div>
          </section>
        )}

        {/* News Cards */}
        {!loading && !error && sortedNews.length === 0 && (
          <div className="text-center py-16 opacity-40">
            <p>{searchQuery ? 'No articles match your search.' : 'No news found with current filters.'}</p>
          </div>
        )}

        {!loading && !error && restOfNews.length === 0 && sortedNews.length > 0 && (
          <div className="text-center py-8 opacity-40">
            <p>All articles shown above as top stories.</p>
          </div>
        )}

        {restOfNews.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-foreground">
            {restOfNews.map((item, idx) => {
              const itemKey = item.link || item.title;
              const isSelected = selectedArticles.has(itemKey);
              return (
                <a
                  key={idx}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block p-4 rounded-xl border transition-all hover:shadow-md group relative overflow-hidden bg-card dark:bg-card ${isSelected ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-border dark:border-border'} hover:shadow-lg`}
                >
                  {item.gradientClass && (
                    <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${item.gradientClass}`} />
                  )}
                  {/* Selection checkbox */}
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleArticleSelection(item); }}
                    className="absolute top-2 left-2 z-10 p-1 rounded-md bg-card dark:bg-card border border-border opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <div className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center ${isSelected ? 'bg-blue-600' : 'border border-muted-foreground/40'}`}>
                      {isSelected && <Check size={10} className="text-white" />}
                    </div>
                  </button>
                  {item.image && (
                    <div className={`mb-3 rounded-lg overflow-hidden bg-muted dark:bg-accent flex items-center justify-center ${isFavicon(item.image) ? 'h-12' : ''}`}>
                      <img
                        src={item.image}
                        alt=""
                        className={`w-full ${isFavicon(item.image) ? 'h-8 object-contain p-1.5' : 'h-40 object-cover'}`}
                        loading="lazy"
                        onError={e => e.currentTarget.style.display = 'none'}
                      />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 text-xs text-muted-foreground">
                        <span className={`px-2 py-0.5 rounded-full font-medium ${darkMode ? 'bg-blue-700/15 text-blue-300' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>{item.category}</span>
                        <span className="w-1 h-1 rounded-full bg-muted dark:bg-accent" aria-hidden="true" />
                        <span>{item.source}</span>
                        {item.language && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-muted dark:bg-accent" aria-hidden="true" />
                            <span className="text-orange-400">{item.language}</span>
                          </>
                        )}
                      </div>
                      <h2 className="text-sm font-semibold leading-snug mb-1.5 group-hover:underline truncate">{item.title}</h2>
                      {item.description && (
                        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAskAbout(item); }}
                        aria-label="Ask about this article"
                        className="p-1 rounded-lg text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:bg-muted dark:hover:bg-accent transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <MessageCircle size={12} />
                      </button>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleBookmark(item); }}
                        aria-label={isBookmarked(item.link || item.title) ? 'Remove bookmark' : 'Bookmark article'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isBookmarked(item.link || item.title)
                            ? 'dark:text-blue-300 dark:hover:bg-accent text-blue-600 hover:bg-blue-50'
                            : 'text-muted-foreground dark:text-muted-foreground/50 hover:text-foreground hover:bg-muted dark:hover:bg-accent'
                        }`}
                      >
                        {isBookmarked(item.link || item.title) ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                      </button>
                      <ExternalLink size={14} className={`opacity-0 group-hover:opacity-30 transition-opacity`} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Clock size={12} />
                    {formatPubDate(item.pubDate)}
                    <span className="opacity-50">·</span>
                    <span>{formatRelativeTime(item.pubDate)}</span>
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {!loading && sortedNews.length > 0 && (
          <div className="mt-6 text-center text-xs text-muted-foreground">
            {sortedNews.length} articles from {new Set(sortedNews.map(n => n.source)).size} sources · 
            Last updated: {lastFetchTime ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(lastFetchTime) : new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date())}
          </div>
        )}
        </div>
      </main>

      {/* Floating Compare Button */}
      {selectedArticles.size >= 2 && (
        <button
          onClick={handleCompareSelected}
          className="fixed bottom-16 right-6 z-40 px-3 py-2 rounded-full shadow-lg bg-blue-600 text-white dark:bg-blue-700 hover:opacity-90 transition-all text-xs font-medium flex items-center gap-1.5"
        >
          <ArrowUpRight size={12} />
          Compare {selectedArticles.size} articles
        </button>
      )}

      {/* Floating Chat Toggle (hidden in split mode) */}
      {chatLayoutMode === 'overlay' && (
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className={`fixed bottom-6 right-6 z-40 p-3 rounded-full shadow-lg transition-all ${
            chatOpen
              ? 'bg-blue-600 text-white dark:bg-blue-700'
              : 'bg-card dark:bg-card text-muted-foreground border border-border hover:bg-muted dark:hover:bg-accent'
          }`}
          aria-label="Toggle chat"
        >
          <MessageCircle size={20} />
        </button>
      )}

      {/* Chat Sidebar */}
      <ChatSidebar
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        provider={chatProvider}
        articles={sortedNews}
        darkMode={darkMode}
        focusArticle={focusArticle}
        compareArticles={compareArticles}
        layoutMode={chatLayoutMode}
        onLayoutToggle={handleLayoutToggle}
      />
      </div>
    </div>
  );
}
