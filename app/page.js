'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Moon, Sun, ExternalLink, Clock, Zap, Search, Bookmark, BookmarkCheck, Settings, ChevronDown, X, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

const CATEGORY_MAP = ['All', 'Startups', 'Consumer Tech', 'AI', 'Innovation', 'Open Source'];
const DAY_RANGES = [
  { label: 'Today', days: 1 },
  { label: '3 Days', days: 3 },
  { label: '7 Days', days: 7 },
  { label: '14 Days', days: 14 },
  { label: 'All Time', days: Infinity },
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
  const [bookmarks, setBookmarks] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sourceFilterOpen, setSourceFilterOpen] = useState(false);

  useEffect(() => {
    fetchNews();
  }, []);

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
      const params = isRefresh ? '?refresh=true' : '';
      const res = await fetch(`/api/news${params}`);
      if (!res.ok) throw new Error('Failed to fetch news');
      const data = await res.json();
      setNews(data);
      setLastFetchTime(new Date());
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
    if (dayRange !== Infinity) {
      const pubDate = new Date(n.pubDate || 0);
      const cutoff = new Date(Date.now() - dayRange * 86400000);
      if (pubDate < cutoff) return false;
    }
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

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-950 text-gray-100' : 'bg-gradient-to-br from-slate-50 to-blue-50 text-gray-900'} transition-[background-color,color] duration-300`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 border-b backdrop-blur-xl ${darkMode ? 'bg-gray-950/80 border-gray-800' : 'bg-white/70 border-gray-200'}`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">Tech News Dashboard</h1>
            {autoRefreshInterval > 0 && (
              <span className={`hidden sm:inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-green-950/50 text-green-400' : 'bg-green-100 text-green-700'}`}>
                <Zap size={10} className="animate-pulse" /> Auto-refresh ON
              </span>
            )}
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'} ${settingsOpen ? (darkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900') : ''}`}
              aria-label="Settings"
            >
              <Settings size={18} />
            </button>
            {autoRefreshInterval > 0 && (
              <span className={`hidden md:inline text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                {REFRESH_INTERVALS.find(i => i.value === autoRefreshInterval)?.label}
              </span>
            )}
            <Link href="/bookmarks" className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'} relative`} aria-label="Bookmarks">
              <Bookmark size={18} />
              {bookmarks.length > 0 && (
                <span className={`absolute -top-0.5 -right-0.5 text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold ${darkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'}`}>
                  {bookmarks.length}
                </span>
              )}
            </Link>
            <button
              onClick={() => fetchNews(true)}
              disabled={loading}
              aria-label="Refresh now"
              className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {settingsOpen && (
          <div className={`border-t ${darkMode ? 'border-gray-800 bg-gray-950/90' : 'border-gray-200 bg-white/90'} backdrop-blur-xl`}>
            <div className="max-w-6xl mx-auto px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Auto-refresh interval</span>
                <button onClick={() => setSettingsOpen(false)} aria-label="Close settings" className={`p-1 rounded ${darkMode ? 'hover:bg-gray-800 text-gray-600' : 'hover:bg-gray-100 text-gray-400'}`}>
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
                        ? darkMode ? 'bg-blue-600 text-white' : 'bg-gray-900 text-white'
                        : darkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200'
                    }`}
                  >
                    {interval.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-5">
        {/* Search Bar */}
        <div className={`relative mb-4`}>
          <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search articles by title or description"
            placeholder="Search articles by title or description..."
            className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border transition-[border-color,background-color,color] ${
              darkMode
                ? 'bg-gray-900 border-gray-800 text-gray-100 placeholder:text-gray-600 focus:border-blue-700'
                : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-gray-400'
            } focus-visible:ring-2 focus-visible:ring-blue-500`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-0.5 rounded-md ${darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Clear
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {/* Categories */}
          <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Categories:</span>
          {CATEGORY_MAP.map(cat => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                (selectedCategories || new Set(['All'])).has(cat)
                  ? darkMode ? 'bg-blue-600 text-white' : 'bg-gray-900 text-white'
                  : darkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700' : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200'
              }`}
              touch-action="manipulation"
            >
              {cat}
            </button>
          ))}

          {/* Day Range */}
          <span className={`text-xs ml-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Time:</span>
          {DAY_RANGES.map(range => (
            <button
              key={range.label}
              onClick={() => setDayRange(range.days)}
              touch-action="manipulation"
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                dayRange === range.days
                  ? darkMode ? 'bg-blue-600 text-white' : 'bg-gray-900 text-white'
                  : darkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700' : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200'
              }`}
            >
              {range.label}
            </button>
          ))}

          {/* Sort */}
          <span className={`text-xs ml-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Sort:</span>
          <div className="flex gap-1">
            <button
              onClick={() => setSortBy('newest')}
              touch-action="manipulation"
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                sortBy === 'newest'
                  ? darkMode ? 'bg-blue-600 text-white' : 'bg-gray-900 text-white'
                  : darkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700' : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200'
              }`}
            >
              Newest
            </button>
            <button
              onClick={() => setSortBy('oldest')}
              touch-action="manipulation"
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                sortBy === 'oldest'
                  ? darkMode ? 'bg-blue-600 text-white' : 'bg-gray-900 text-white'
                  : darkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700' : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200'
              }`}
            >
              Oldest
            </button>
          </div>

          {/* Source Filter */}
          <span className={`text-xs ml-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Source:</span>
          {allSources.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setSourceFilterOpen(!sourceFilterOpen)}
                touch-action="manipulation"
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                  sourceFilterOpen
                    ? darkMode ? 'bg-gray-800 text-white border border-gray-700' : 'bg-gray-100 text-gray-900 border border-gray-200'
                    : selectedSources && selectedSources.size > 0
                      ? darkMode ? 'bg-blue-600/30 text-blue-400 border border-blue-800' : 'bg-blue-50 text-blue-700 border border-blue-200'
                      : darkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700' : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200'
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
                  <div className={`absolute top-full left-0 mt-1 z-50 p-2 rounded-xl border shadow-lg min-w-[200px] max-h-[300px] overflow-y-auto ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
                    {allSources.map(source => (
                      <button
                        key={source}
                        onClick={() => toggleSource(source)}
                        touch-action="manipulation"
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-2 ${
                          ((selectedSources || new Set()).has(source))
                            ? darkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-700'
                            : darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                        }`}
                      >
                        <span className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${
                          (selectedSources || new Set()).has(source)
                            ? (darkMode ? 'bg-blue-600 border-blue-600' : 'bg-blue-600 border-blue-600')
                            : (darkMode ? 'border-gray-600' : 'border-gray-300')
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
            <span className={`text-xs ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
              ({sortedNews.length} results)
            </span>
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
          <div className={`p-5 rounded-xl mb-5 ${darkMode ? 'bg-red-950/30 border border-red-900' : 'bg-red-50 border border-red-200'}`}>
            <p className="text-sm">{error}</p>
            <button onClick={() => fetchNews(true)} className={`mt-2 px-3 py-1.5 text-sm rounded-lg font-medium ${darkMode ? 'bg-red-950/50 text-red-400 hover:bg-red-950' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>Try again</button>
          </div>
        )}

        {/* Executive Summary - Today's Top Stories */}
        {!loading && !error && topStories.length > 0 && (
          <section className="mb-8">
            <h2 className={`text-sm font-bold uppercase tracking-wider mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Today's Top Stories</h2>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {topStories.map((item, idx) => (
                <a
                  key={idx}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block p-4 rounded-xl border transition-all hover:shadow-md group relative overflow-hidden ${
                    darkMode
                      ? 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                      : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-lg'
                  }`}
                >
                  {item.gradientClass && (
                    <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${item.gradientClass}`} />
                  )}
                  {item.image && (
                    <div className={`mb-3 rounded-lg overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-gray-100'} flex items-center justify-center ${isFavicon(item.image) ? 'h-12' : ''}`}>
                      <img src={item.image} alt="" className={`w-full ${isFavicon(item.image) ? 'h-8 object-contain p-1.5' : 'h-20 object-cover'}`} loading="lazy" onError={e => e.currentTarget.style.display = 'none'} />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className={`flex items-center gap-2 mb-1.5 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        <span className={`px-2 py-0.5 rounded-full font-medium ${
                          darkMode ? 'bg-blue-950/50 text-blue-300' : 'bg-blue-50 text-blue-700 border border-blue-100'
                        }`}>{item.category}</span>
                        <span className={`w-1 h-1 rounded-full ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`} aria-hidden="true" />
                        <span>{item.source}</span>
                        {item.language && (
                          <>
                            <span className={`w-1 h-1 rounded-full ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`} aria-hidden="true" />
                            <span className="text-orange-400">{item.language}</span>
                          </>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold leading-snug mb-1.5 group-hover:underline truncate">{item.title}</h3>
                      {item.description && (
                        <p className={`text-xs leading-relaxed ${darkMode ? 'text-gray-600' : 'text-gray-400'} line-clamp-2`}>
                          {item.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleBookmark(item); }}
                        aria-label={isBookmarked(item.link || item.title) ? 'Remove bookmark' : 'Bookmark article'}
                        className={`p-1 rounded-lg transition-colors ${
                          isBookmarked(item.link || item.title)
                            ? (darkMode ? 'text-blue-400 hover:bg-gray-800' : 'text-blue-600 hover:bg-blue-50')
                            : (darkMode ? 'text-gray-700 hover:text-gray-400 hover:bg-gray-800' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100')
                        }`}
                      >
                        {isBookmarked(item.link || item.title) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                      </button>
                      <ExternalLink size={12} className={`opacity-0 group-hover:opacity-30 transition-opacity`} />
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 mt-2 text-xs ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                    <Clock size={12} />
                    {formatPubDate(item.pubDate)}
                    <span className="opacity-50">·</span>
                    <span>{formatRelativeTime(item.pubDate)}</span>
                  </div>
                </a>
              ))}
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
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            {restOfNews.map((item, idx) => (
            <a
              key={idx}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`block p-4 rounded-xl border transition-all hover:shadow-md group relative overflow-hidden ${
                darkMode
                  ? 'bg-gray-900/50 border-gray-800 hover:border-gray-700 hover:bg-gray-900'
                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-lg'
              }`}
            >
              {item.gradientClass && (
                <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${item.gradientClass}`} />
              )}
              {item.image && (
                <div className={`mb-3 rounded-lg overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-gray-100'} flex items-center justify-center ${isFavicon(item.image) ? 'h-12' : ''}`}>
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
                  <div className={`flex items-center gap-2 mb-1.5 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    <span className={`px-2 py-0.5 rounded-full font-medium ${
                      darkMode ? 'bg-blue-950/50 text-blue-300' : 'bg-blue-50 text-blue-700 border border-blue-100'
                    }`}>{item.category}</span>
                    <span className={`w-1 h-1 rounded-full ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`} aria-hidden="true" />
                    <span>{item.source}</span>
                    {item.language && (
                      <>
                        <span className={`w-1 h-1 rounded-full ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`} aria-hidden="true" />
                        <span className="text-orange-400">{item.language}</span>
                      </>
                    )}
                  </div>
                  <h2 className="text-sm font-semibold leading-snug mb-1.5 group-hover:underline truncate">{item.title}</h2>
                  {item.description && (
                    <p className={`text-xs leading-relaxed ${darkMode ? 'text-gray-500' : 'text-gray-500'} line-clamp-2`}>
                      {item.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleBookmark(item); }}
                    aria-label={isBookmarked(item.link || item.title) ? 'Remove bookmark' : 'Bookmark article'}
                    className={`p-1.5 rounded-lg transition-colors ${
                      isBookmarked(item.link || item.title)
                        ? (darkMode ? 'text-blue-400 hover:bg-gray-800' : 'text-blue-600 hover:bg-blue-50')
                        : (darkMode ? 'text-gray-700 hover:text-gray-400 hover:bg-gray-800' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100')
                    }`}
                  >
                    {isBookmarked(item.link || item.title) ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                  </button>
                  <ExternalLink size={14} className={`opacity-0 group-hover:opacity-30 transition-opacity`} />
                </div>
              </div>
              <div className={`flex items-center gap-2 mt-2 text-xs ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                <Clock size={12} />
                {formatPubDate(item.pubDate)}
                <span className="opacity-50">·</span>
                <span>{formatRelativeTime(item.pubDate)}</span>
              </div>
            </a>
          ))}
        </div>
        )}

        {/* Footer */}
        {!loading && sortedNews.length > 0 && (
          <div className={`mt-6 text-center text-xs ${darkMode ? 'text-gray-700' : 'text-gray-400'}`}>
            {sortedNews.length} articles from {new Set(sortedNews.map(n => n.source)).size} sources · 
            Last updated: {lastFetchTime ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(lastFetchTime) : new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date())}
          </div>
        )}
      </main>
    </div>
  );
}
