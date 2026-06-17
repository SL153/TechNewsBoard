'use client';

import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Moon, Sun, ExternalLink, Clock, Search, Bookmark, BookmarkCheck, Settings, X, ArrowUpRight, MessageCircle, Rss, SlidersHorizontal, MousePointer2 } from 'lucide-react';
import Link from 'next/link';
import ChatSidebar from './components/ChatSidebar';
import ChatProviderSettings from './components/ChatProviderSettings';
import FeedManager from './components/FeedManager';
import DataImportExport from './components/DataImportExport';
import NotificationSettings from './components/NotificationSettings';
import PhantomDome from './components/PhantomDome';
import { getEnabledSources } from '@/lib/feed-store';
import * as NotificationStore from '@/lib/notification-store';

const CATEGORY_MAP = ['All', 'Startups', 'Consumer Tech', 'AI', 'Innovation', 'Open Source'];
const LANGUAGES = ['English', '繁體中文'];
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
  const [darkMode, setDarkMode] = useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(1800000);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const searchTimeoutRef = useRef(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatProvider, setChatProvider] = useState(null);
  const [feedManagerOpen, setFeedManagerOpen] = useState(false);
  const [selectedArticles, setSelectedArticles] = useState(new Set());
  const [focusArticle, setFocusArticle] = useState(null);
  const [compareArticles, setCompareArticles] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [clock, setClock] = useState('');

  // Progressive reveal (client-side only, 1A)
  const MAX_VISIBLE = 300;
  const BATCH_SIZE = 18; // 6 columns × 3 rows
  const [visibleCount, setVisibleCount] = useState(120); // initial 40 columns — dense starting view
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    fetchNews();
  }, [dayRange, selectedCategories, debouncedSearchQuery, selectedLanguage]);

  useEffect(() => {
    setSelectedCategories(new Set(['All']));
    setSelectedSources(new Set());
    setBookmarks(loadBookmarks());
  }, []);

  useEffect(() => {
    const savedSettings = loadSettings();
    if (savedSettings) {
      setDarkMode(savedSettings.darkMode ?? true);
      setAutoRefreshInterval(savedSettings.autoRefreshInterval ?? 1800000);
    }
  }, []);

  useEffect(() => {
    saveSettings({ darkMode, autoRefreshInterval });
  }, [darkMode, autoRefreshInterval]);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  useEffect(() => {
    if (autoRefreshInterval === 0 || loading) return;
    const interval = setInterval(async () => { await fetchNews(true); }, autoRefreshInterval);
    return () => clearInterval(interval);
  }, [autoRefreshInterval, loading]);

  // Debounce search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchQuery]);

  // Live clock
  useEffect(() => {
    function update() {
      setClock(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()));
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  async function fetchNews(isRefresh = false) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (isRefresh) params.set('refresh', 'true');
      if (dayRange < Infinity && dayRange !== undefined) params.set('days', String(dayRange));

      const cats = selectedCategories || new Set(['All']);
      if (!cats.has('All')) [...cats].forEach(cat => params.append('category', cat));
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const enabledSources = getEnabledSources();
      params.set('feeds', JSON.stringify(enabledSources.map(s => s.source)));
      params.set('lang', selectedLanguage === '繁體中文' ? 'zh-HK' : '');

      const queryString = params.toString();
      const url = `/api/news${queryString ? '?' + queryString : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch news');
      const data = await res.json();
      setNews(data);
      setLastFetchTime(new Date());

      try {
        const config = NotificationStore.loadNotificationConfig();
        if (config.enabled && ('Notification' in window)) {
          const result = NotificationStore.checkArticleMatches(data);
          if (result.matchedArticles.length > 0) NotificationStore.showNotifications(result.matchedArticles);
        }
      } catch { /* ignore */ }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleCategory(cat) {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (cat === 'All') { next.clear(); next.add('All'); }
      else {
        if (next.has(cat)) { next.delete(cat); if (next.size === 0) next.add('All'); }
        else { next.delete('All'); next.add(cat); }
      }
      return next;
    });
  }

  function toggleSource(source) {
    setSelectedSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
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
    const newBookmarks = exists
      ? bookmarks.filter(b => b.link !== key)
      : [...bookmarks, { ...article, bookmarkedAt: new Date().toISOString() }];
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

  // Apply progressive reveal cap (1A + 7B)
  const visibleNews = sortedNews.slice(0, Math.min(visibleCount, MAX_VISIBLE));

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

  function isFavicon(itemImage) {
    return itemImage?.includes('www.google.com/s2/favicons') ?? false;
  }

  // Progressive reveal handler (1A, 3B, 4B, 7B)
  function handleNearRightEdge(currentRotY, maxRotY) {
    if (isLoadingMore) return;
    if (visibleCount >= MAX_VISIBLE) return;
    if (visibleCount >= sortedNews.length) return;

    // In the anchored system, right edge is at +rightEdgeDeg (passed as maxRotY).
    const distToRight = maxRotY - currentRotY;
    if (distToRight < 30) {
      setIsLoadingMore(true);
      // small delay so ghost cards are visible
      setTimeout(() => {
        setVisibleCount(c => Math.min(c + BATCH_SIZE, MAX_VISIBLE, sortedNews.length));
        setIsLoadingMore(false);
      }, 180);
    }
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
    const selected = sortedNews.filter(item => selectedArticles.has(item.link || item.title));
    setChatOpen(true);
    setCompareArticles(selected.map(a => ({ title: a.title, source: a.source, category: a.category, description: a.description, link: a.link })));
  }

  const activeFilterCount =
    (selectedCategories && !selectedCategories.has('All') ? selectedCategories.size : 0) +
    ((selectedSources?.size ?? 0) > 0 ? 1 : 0) +
    (dayRange !== 3 ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0) +
    (selectedLanguage !== 'English' ? 1 : 0);

  function renderCard(item, idx) {
    const itemKey = item.link || item.title;
    const isSelected = selectedArticles.has(itemKey);
    const favicon = isFavicon(item.image);
    const hasRealImage = item.image && !favicon;
    return (
      <div className={`phantom-card group relative flex flex-col h-full ${isSelected ? 'ring-1 ring-blue-400/50' : ''}`}>
        {/* Selection checkbox */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleArticleSelection(item); }}
          className="absolute top-3 left-3 z-20 p-1 rounded-md bg-black/80 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Select article"
        >
          <div className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center ${isSelected ? 'bg-blue-500' : 'border border-white/20'}`}>
            {isSelected && <X size={8} className="text-white" />}
          </div>
        </button>

        {/* Persistent bookmark icon (top-right, subtle) */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleBookmark(item); }}
          aria-label={isBookmarked(itemKey) ? 'Remove bookmark' : 'Bookmark'}
          className={`absolute top-3 right-3 z-20 p-1 rounded-md transition-colors ${isBookmarked(itemKey) ? 'text-blue-400' : 'text-white/40 hover:text-white/80'}`}
        >
          {isBookmarked(itemKey) ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
        </button>

        {item.gradientClass && (
          <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${item.gradientClass} z-10`} />
        )}

        <a href={item.link} target="_blank" rel="noopener noreferrer" className="flex flex-col h-full" draggable="false">
          {/* Image region — uniform height; gradient placeholder when no image */}
          <div className="relative h-[180px] flex-shrink-0 overflow-hidden bg-white/5 flex items-center justify-center">
            {hasRealImage ? (
              <img src={item.image} alt="" draggable="false" className="w-full h-full object-cover" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />
            ) : favicon ? (
              <>
                <div className="absolute inset-0 phantom-card-placeholder" />
                <img src={item.image} alt="" draggable="false" className="relative h-8 object-contain" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />
              </>
            ) : (
              <div className="absolute inset-0 phantom-card-placeholder flex flex-col items-center justify-center">
                <span className="text-[15px] tracking-[0.08em] text-white/20 font-medium text-center px-3">{item.source}</span>
              </div>
            )}
            {/* Category pill overlaid on image (bottom-left) */}
            <span className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded text-[9px] tracking-wider uppercase bg-black/60 backdrop-blur text-white/80">
              {item.category}
            </span>
          </div>

          {/* Content — flex column, footer pinned to bottom */}
          <div className="flex flex-col flex-1 min-h-0 px-4 pt-3 pb-3">
            <div className="flex items-center gap-2 mb-2 flex-shrink-0">
              <span className="phantom-mono truncate">{item.source}</span>
            </div>

            <h3 className="text-[13px] font-medium leading-snug mb-1.5 group-hover:text-white transition-colors line-clamp-2 text-white/85 flex-shrink-0">
              {item.title}
            </h3>

            <div className="flex items-center justify-between pt-2 mt-auto border-t border-white/5 flex-shrink-0">
              <div className="flex items-center gap-1.5 phantom-mono-dim pt-1">
                <Clock size={9} />
                {formatRelativeTime(item.pubDate)}
              </div>
              <div className="flex items-center gap-0.5 pt-1">
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAskAbout(item); }}
                  aria-label="Ask about this article"
                  className="p-1 rounded text-white/25 hover:text-blue-400 hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <MessageCircle size={11} />
                </button>
                <ExternalLink size={11} className="text-white/25 opacity-0 group-hover:opacity-50 transition-opacity" />
              </div>
            </div>
          </div>
        </a>
      </div>
    );
  }

  const currentRefreshLabel = REFRESH_INTERVALS.find(i => i.value === autoRefreshInterval)?.label ?? 'Off';

  return (
    <div id="main-content" className="fixed inset-0 bg-black text-white overflow-hidden phantom-stage-bg">
      {/* ===== TOP BAR (corner-anchored, floats over the wall) ===== */}
      <div className="phantom-topbar">
        {/* Top-left: brand + live status */}
        <div className="flex flex-col gap-1.5">
          <Link href="/" className="text-sm font-semibold tracking-[0.22em] uppercase text-white/95">
            Innovation Board
          </Link>
          <div className="phantom-mono-dim flex items-center gap-2">
            {autoRefreshInterval > 0 ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live · {currentRefreshLabel}
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                Paused
              </>
            )}
          </div>
        </div>

        {/* Top-right: clock + controls */}
        <div className="flex items-start gap-4">
          <div className="hidden sm:flex flex-col items-end gap-1 mr-1">
            <span className="phantom-mono text-white/70">{clock}</span>
              <span className="phantom-mono-dim">
                {visibleNews.length} stories · {new Set(visibleNews.map(n => n.source)).size} sources
              </span>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/bookmarks" className="relative p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors" aria-label="Bookmarks">
              <Bookmark size={16} />
              {bookmarks.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold bg-white text-black">
                  {bookmarks.length}
                </span>
              )}
            </Link>
            <button onClick={() => fetchNews(true)} disabled={loading} aria-label="Refresh now" className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setDarkMode(!darkMode)} aria-label="Toggle theme" className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors">
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button onClick={() => setSettingsOpen(true)} aria-label="Settings" className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors">
              <Settings size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ===== THE WALL ===== */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <RefreshCw size={24} className="animate-spin opacity-30 mb-4" />
          <span className="phantom-mono-dim">Loading the wall</span>
        </div>
      )}

      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="phantom-panel max-w-sm text-center">
            <p className="text-sm text-white/70 mb-4">{error}</p>
            <button onClick={() => fetchNews(true)} className="phantom-pill active">Try again</button>
          </div>
        </div>
      )}

      {!loading && !error && sortedNews.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <span className="phantom-mono-dim">{searchQuery ? 'No articles match your search' : 'No news found'}</span>
        </div>
      )}

      {!loading && !error && visibleNews.length > 0 && (
        <PhantomDome
          items={visibleNews}
          renderItem={renderCard}
          cardWidth={320}
          cardHeight={320}
          radius={2100}
          anglePerColumn={13}
          maxArc={300}
          maxTilt={34}
          initialOffsetDeg={70}
          verticalDamping={0.25}
          onNearRightEdge={handleNearRightEdge}
        />
      )}

      {/* News-left counter floating above the wall */}
      {!loading && !error && sortedNews.length > 0 && (
        <div className="fixed bottom-[68px] left-1/2 -translate-x-1/2 z-40 phantom-news-left">
          {visibleNews.length < sortedNews.length ? `${sortedNews.length - visibleNews.length} more` : 'All loaded'}
        </div>
      )}

      {/* Ghost cards while loading next batch (6B) */}
      {!loading && !error && isLoadingMore && visibleNews.length > 0 && (
        <div className="fixed bottom-28 right-8 z-50 flex gap-2 opacity-40">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-[72px] h-[72px] rounded-lg border border-white/20 bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {/* Drag hint */}
      {!loading && !error && sortedNews.length > 0 && (
        <div className="phantom-drag-hint fixed bottom-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 phantom-mono-dim pointer-events-none">
          <MousePointer2 size={11} />
          Drag or scroll to explore
        </div>
      )}

      {/* ===== BOTTOM NAV (categories) ===== */}
      {!loading && (
        <nav className="phantom-bottomnav">
          {CATEGORY_MAP.map(cat => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`phantom-nav-pill ${(selectedCategories || new Set(['All'])).has(cat) ? 'active' : ''}`}
            >
              {cat}
            </button>
          ))}
        </nav>
      )}

      {/* ===== BOTTOM-LEFT: search ===== */}
      <div className="fixed bottom-[22px] left-7 z-50 flex items-center gap-2">
        <div className="phantom-search flex items-center px-3 py-2 w-[180px] focus-within:w-[260px] transition-[width] duration-300">
          <Search size={13} className="text-white/30 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search articles"
            className="bg-transparent outline-none text-xs text-white placeholder:text-white/25 ml-2 w-full"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} aria-label="Clear search" className="text-white/40 hover:text-white">
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* ===== BOTTOM-RIGHT: Filter ===== */}
      <button onClick={() => setFiltersOpen(true)} className="phantom-corner-btn bottom-[22px] right-7" style={{ position: 'fixed' }}>
        <SlidersHorizontal size={13} />
        Filter
        {activeFilterCount > 0 && (
          <span className="ml-1 text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold bg-white text-black">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* ===== FILTER OVERLAY ===== */}
      {filtersOpen && (
        <div className="phantom-overlay" onClick={() => setFiltersOpen(false)}>
          <div className="phantom-panel phantom-scroll" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-semibold tracking-[0.18em] uppercase">Filters</h2>
              <button onClick={() => setFiltersOpen(false)} className="p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white" aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <p className="phantom-mono-dim mb-2.5">Language</p>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map(lang => (
                    <button key={lang} onClick={() => setSelectedLanguage(lang)} className={`phantom-pill ${selectedLanguage === lang ? 'active' : ''}`}>{lang}</button>
                  ))}
                </div>
              </div>

              <div>
                <p className="phantom-mono-dim mb-2.5">Category</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_MAP.map(cat => (
                    <button key={cat} onClick={() => toggleCategory(cat)} className={`phantom-pill ${(selectedCategories || new Set(['All'])).has(cat) ? 'active' : ''}`}>{cat}</button>
                  ))}
                </div>
              </div>

              <div>
                <p className="phantom-mono-dim mb-2.5">Time range</p>
                <div className="flex flex-wrap gap-2">
                  {DAY_RANGES.map(range => (
                    <button key={range.label} onClick={() => setDayRange(range.days)} className={`phantom-pill ${dayRange === range.days ? 'active' : ''}`}>{range.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <p className="phantom-mono-dim mb-2.5">Sort</p>
                <div className="flex gap-2">
                  <button onClick={() => setSortBy('newest')} className={`phantom-pill ${sortBy === 'newest' ? 'active' : ''}`}>Newest</button>
                  <button onClick={() => setSortBy('oldest')} className={`phantom-pill ${sortBy === 'oldest' ? 'active' : ''}`}>Oldest</button>
                </div>
              </div>

              {allSources.length > 0 && (
                <div>
                  <p className="phantom-mono-dim mb-2.5">Sources ({allSources.length})</p>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto phantom-scroll">
                    {allSources.map(source => (
                      <button key={source} onClick={() => toggleSource(source)} className={`phantom-pill ${(selectedSources || new Set()).has(source) ? 'active' : ''}`}>{source}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-7 pt-5 border-t border-white/10">
              <span className="phantom-mono-dim">{sortedNews.length} results</span>
              <div className="flex gap-2">
                <button onClick={handleResetFilters} className="phantom-pill">Reset all</button>
                <button onClick={() => setFiltersOpen(false)} className="phantom-pill active">Done</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== SETTINGS OVERLAY ===== */}
      {settingsOpen && (
        <div className="phantom-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="phantom-panel phantom-scroll" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-semibold tracking-[0.18em] uppercase">Settings</h2>
              <button onClick={() => setSettingsOpen(false)} className="p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white" aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <p className="phantom-mono-dim mb-2.5">Auto-refresh interval</p>
                <div className="flex flex-wrap gap-2">
                  {REFRESH_INTERVALS.map(interval => (
                    <button key={interval.value} onClick={() => setAutoRefreshInterval(interval.value)} className={`phantom-pill ${autoRefreshInterval === interval.value ? 'active' : ''}`}>{interval.label}</button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-white/10">
                <button onClick={() => setFeedManagerOpen(!feedManagerOpen)} className={`phantom-pill ${feedManagerOpen ? 'active' : ''}`}>
                  <Rss size={12} className="mr-1.5 inline" /> Manage Feeds
                </button>
                {feedManagerOpen && (
                  <div className="mt-4"><FeedManager darkMode={true} onFeedsChange={() => fetchNews()} /></div>
                )}
              </div>

              <div className="pt-4 border-t border-white/10"><DataImportExport darkMode={true} /></div>
              <div className="pt-4 border-t border-white/10"><NotificationSettings darkMode={true} /></div>
              <div className="pt-4 border-t border-white/10"><ChatProviderSettings darkMode={true} onProviderChange={setChatProvider} /></div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Floating Compare Button ===== */}
      {selectedArticles.size >= 2 && (
        <button onClick={handleCompareSelected} className="fixed bottom-20 right-7 z-50 px-4 py-2.5 rounded-full shadow-lg phantom-fab text-xs tracking-wider uppercase flex items-center gap-2">
          <ArrowUpRight size={12} />
          Compare {selectedArticles.size}
        </button>
      )}

      {/* ===== Chat toggle (overlay) ===== */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className={`fixed top-1/2 -translate-y-1/2 right-0 z-50 px-2 py-4 rounded-l-xl transition-all ${chatOpen ? 'bg-white text-black' : 'bg-white/8 backdrop-blur-xl text-white/60 border border-r-0 border-white/10 hover:bg-white/15'}`}
        aria-label="Toggle chat"
      >
        <MessageCircle size={18} />
      </button>

      {/* ===== Chat Sidebar (overlay) ===== */}
      <ChatSidebar
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        provider={chatProvider}
        articles={sortedNews}
        darkMode={darkMode}
        focusArticle={focusArticle}
        compareArticles={compareArticles}
        layoutMode="overlay"
        onLayoutToggle={() => {}}
      />
    </div>
  );
}
