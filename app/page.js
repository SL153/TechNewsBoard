'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { RefreshCw, Moon, Sun, ExternalLink, Clock, Search, Bookmark, BookmarkCheck, Settings, X, ArrowUpRight, MessageCircle, Rss, SlidersHorizontal, MousePointer2, Rocket, Smartphone, Sparkles, Lightbulb, Code, Flame, Newspaper } from 'lucide-react';
import Link from 'next/link';
import ChatSidebar from './components/ChatSidebar';
import ChatProviderSettings from './components/ChatProviderSettings';
import FeedManager from './components/FeedManager';
import DataImportExport from './components/DataImportExport';
import NotificationSettings from './components/NotificationSettings';
import PhantomDome from './components/PhantomDome';
import ArticleReader from './components/ArticleReader';
import { getEnabledSources } from '@/lib/feed-store';
import * as NotificationStore from '@/lib/notification-store';

// Fixed left→right zone order on the dome (categories are spatial zones, not filters).
const ZONE_ORDER = ['Startups', 'Consumer Tech', 'AI', 'Innovation', 'Open Source'];
const LANGUAGES = ['English', '繁體中文'];

// Per-category accent system: gradient stripe, hover-glow colour, pill colour,
// a card-background tint, and an icon — so cards stand out by category at a glance.
const CATEGORY_ACCENTS = {
  'Startups':      { gradient: 'from-sky-500 to-indigo-600',     glow: 'oklch(0.62 0.19 255 / 0.20)', pill: 'oklch(0.55 0.18 255 / 0.9)',  tint: 'oklch(0.13 0.03 255)', color: 'oklch(0.55 0.18 255)', icon: Rocket },
  'Consumer Tech': { gradient: 'from-cyan-400 to-teal-500',      glow: 'oklch(0.7 0.14 195 / 0.20)',  pill: 'oklch(0.6 0.14 195 / 0.9)',  tint: 'oklch(0.13 0.03 195)', color: 'oklch(0.6 0.14 195)',  icon: Smartphone },
  'AI':            { gradient: 'from-violet-500 to-fuchsia-600', glow: 'oklch(0.62 0.2 300 / 0.20)',  pill: 'oklch(0.55 0.2 300 / 0.9)',  tint: 'oklch(0.14 0.035 300)', color: 'oklch(0.55 0.2 300)', icon: Sparkles },
  'Innovation':    { gradient: 'from-amber-400 to-orange-600',   glow: 'oklch(0.72 0.17 65 / 0.20)',  pill: 'oklch(0.62 0.16 65 / 0.9)',  tint: 'oklch(0.14 0.03 65)', color: 'oklch(0.62 0.16 65)',  icon: Lightbulb },
  'Open Source':   { gradient: 'from-emerald-500 to-green-600',  glow: 'oklch(0.7 0.15 160 / 0.20)',  pill: 'oklch(0.58 0.15 160 / 0.9)', tint: 'oklch(0.13 0.03 160)', color: 'oklch(0.58 0.15 160)', icon: Code },
};
const DEFAULT_ACCENT = { gradient: 'from-slate-500 to-gray-700', glow: 'oklch(0.6 0.02 264 / 0.15)', pill: 'oklch(0.4 0.02 264 / 0.9)', tint: 'oklch(0.11 0.005 264)', color: 'oklch(0.4 0.02 264)', icon: Newspaper };

function accentFor(item) {
  if (item.source === 'Hacker News') {
    return { gradient: 'from-orange-500 to-red-600', glow: 'oklch(0.65 0.2 35 / 0.20)', pill: 'oklch(0.58 0.19 35 / 0.9)', tint: 'oklch(0.14 0.035 35)', color: 'oklch(0.58 0.19 35)', icon: Flame };
  }
  return CATEGORY_ACCENTS[item.category] || DEFAULT_ACCENT;
}
const DAY_RANGES = [
  { label: 'Today', days: 1 },
  { label: '3 Days', days: 3 },
  { label: '7 Days', days: 7 },
  { label: '14 Days', days: 14 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
];
// Refresh interval is fixed at 15 min and controlled server-side via the
// Redis cache TTL — the frontend cannot change it. The auto-refresh below only
// re-reads the cached API; it never forces an upstream fetch.
const AUTO_REFRESH_MS = 15 * 60 * 1000;

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

// Load the user's connected chat provider from storage (independent of the
// Settings panel being opened) so summaries can prefer it.
function loadChatProvider() {
  if (typeof window === 'undefined') return null;
  try {
    const active = localStorage.getItem('technews-chat-active-type');
    if (!active) return null;
    const all = JSON.parse(localStorage.getItem('technews-chat-providers') || '{}');
    const c = all[active];
    if (!c || !c.endpoint || !c.model) return null;
    return {
      type: active,
      endpoint: c.endpoint,
      apiKey: c.apiKey || '',
      model: c.model,
      requestFormat: c.requestFormat,
      customAuthType: c.customAuthType,
    };
  } catch {
    return null;
  }
}

export default function Home() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Zone navigation: activeZone highlights the current zone pill; flyNonce +
  // flyTargetCol tell PhantomDome to animate to a zone's start column.
  const [activeZone, setActiveZone] = useState('Startups');
  const [flyNonce, setFlyNonce] = useState(0);
  const [flyTargetCol, setFlyTargetCol] = useState(0);
  const [selectedSources, setSelectedSources] = useState(null);
  const [dayRange, setDayRange] = useState(3);
  const [sortBy, setSortBy] = useState('newest');
  const [darkMode, setDarkMode] = useState(true);
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
  const [readerArticle, setReaderArticle] = useState(null);
  const [compareArticles, setCompareArticles] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [clock, setClock] = useState('');

  // Sliding-window feed: PhantomDome windows the full list itself. This key
  // changes whenever the active filters change, telling PhantomDome to jump
  // back to the start of the newly-filtered list.
  const resetKey = `${[...(selectedSources || [])].sort().join(',')}|${dayRange}|${sortBy}|${debouncedSearchQuery}|${selectedLanguage}`;

  // Current window range + zone reported by PhantomDome, for the indicator.
  const [windowInfo, setWindowInfo] = useState({ from: 0, to: 0, total: 0, zone: null });

  useEffect(() => {
    fetchNews();
  }, [dayRange, debouncedSearchQuery, selectedLanguage]);

  useEffect(() => {
    setSelectedSources(new Set());
    setBookmarks(loadBookmarks());
    setChatProvider(loadChatProvider());
  }, []);

  useEffect(() => {
    const savedSettings = loadSettings();
    if (savedSettings) {
      setDarkMode(savedSettings.darkMode ?? true);
    }
  }, []);

  useEffect(() => {
    saveSettings({ darkMode });
  }, [darkMode]);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  // Fixed 15-min auto-refresh — re-reads the cached API (Redis is authoritative
  // for when upstream is actually re-fetched).
  useEffect(() => {
    if (loading) return;
    const interval = setInterval(() => { fetchNews(); }, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [loading]);

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

  async function fetchNews() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dayRange < Infinity && dayRange !== undefined) params.set('days', String(dayRange));
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

  // Category pills navigate (fly) to a zone instead of filtering.
  function flyToZone(cat) {
    const zone = zones.find(z => z.category === cat);
    if (!zone) return;
    setActiveZone(cat);
    setFlyTargetCol(zone.startCol);
    setFlyNonce(n => n + 1);
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
    const sources = selectedSources || new Set();
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

  // Group into category zones (fixed left→right order) so the dome shows
  // contiguous zones. Accents already cluster per category; zones also drive
  // the fly-to-zone navigation and the gate markers.
  const { zonedNews, zones } = useMemo(() => {
    const byCat = {};
    for (const cat of ZONE_ORDER) byCat[cat] = [];
    for (const n of sortedNews) {
      if (byCat[n.category]) byCat[n.category].push(n);
    }
    const zoned = [];
    const zs = [];
    for (const cat of ZONE_ORDER) {
      const group = byCat[cat];
      if (group.length === 0) continue;
      const startIndex = zoned.length;
      zoned.push(...group);
      const ac = CATEGORY_ACCENTS[cat] || DEFAULT_ACCENT;
      zs.push({ category: cat, startIndex, startCol: Math.floor(startIndex / 3), count: group.length, color: ac.color });
    }
    return { zonedNews: zoned, zones: zs };
  }, [sortedNews]);

  // Keep activeZone valid as the dataset changes; fall back to the first zone.
  useEffect(() => {
    if (zones.length === 0) return;
    if (!zones.some(z => z.category === activeZone)) {
      setActiveZone(zones[0].category);
    }
  }, [zones, activeZone]);

  // The pill highlight follows whatever zone is currently centred (reported by
  // PhantomDome on fly-arrival and on scroll), so pill + indicator always agree.
  useEffect(() => {
    if (windowInfo.zone) setActiveZone(windowInfo.zone);
  }, [windowInfo.zone]);

  // sortedNews feeds the sliding-window wall directly (PhantomDome windows it).

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
    ((selectedSources?.size ?? 0) > 0 ? 1 : 0) +
    (dayRange !== 3 ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0) +
    (selectedLanguage !== 'English' ? 1 : 0);

  function renderCard(item, idx) {
    const itemKey = item.link || item.title;
    const isSelected = selectedArticles.has(itemKey);
    const favicon = isFavicon(item.image);
    const hasRealImage = item.image && !favicon;
    const accent = accentFor(item);
    const Icon = accent.icon;
    // GitHub Trending items keep their per-language gradient; everything else uses the category accent.
    const stripeGradient = item.gradientClass || accent.gradient;
    return (
      <div
        className={`phantom-card group relative flex flex-col h-full ${isSelected ? 'ring-1 ring-blue-400/50' : ''}`}
        style={{ '--card-glow': accent.glow, '--card-tint': accent.tint }}
      >
        {/* Selection checkbox */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleArticleSelection(item); }}
          className="phantom-on-dark absolute top-3 left-3 z-20 p-1 rounded-md bg-black/80 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
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

        {/* Category accent stripe (always on) */}
        <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${stripeGradient} z-10`} />

        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            // Plain left-click opens the in-app reader; keep native new-tab for
            // middle-click and ⌘/Ctrl/Shift-click.
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            setReaderArticle(item);
          }}
          className="flex flex-col h-full"
          draggable="false"
        >
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
            {/* Category pill overlaid on image (bottom-left) — colored by category */}
            <span
              className="phantom-on-dark absolute bottom-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded text-[9px] tracking-wider uppercase font-medium text-white"
              style={{ background: accent.pill }}
            >
              <Icon size={9} />
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
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live · 15 min
          </div>
        </div>

        {/* Top-right: clock + controls */}
        <div className="flex items-start gap-4">
          <div className="hidden sm:flex flex-col items-end gap-1 mr-1">
            <span className="phantom-mono text-white/70">{clock}</span>
              <span className="phantom-mono-dim">
                {sortedNews.length} stories · {new Set(sortedNews.map(n => n.source)).size} sources
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
            <button onClick={() => fetchNews()} disabled={loading} aria-label="Refresh now" className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors">
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
            <button onClick={() => fetchNews()} className="phantom-pill active">Try again</button>
          </div>
        </div>
      )}

      {!loading && !error && sortedNews.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <span className="phantom-mono-dim">{searchQuery ? 'No articles match your search' : 'No news found'}</span>
        </div>
      )}

      {!loading && !error && zonedNews.length > 0 && (
        <PhantomDome
          items={zonedNews}
          zones={zones}
          renderItem={renderCard}
          resetKey={resetKey}
          flyNonce={flyNonce}
          flyTargetCol={flyTargetCol}
          cardWidth={320}
          cardHeight={320}
          radius={2100}
          anglePerColumn={13}
          maxArc={300}
          maxTilt={34}
          initialOffsetDeg={90}
          verticalDamping={0.25}
          onWindowChange={setWindowInfo}
        />
      )}

      {/* Window position indicator (current zone + how many stories are in view) */}
      {!loading && !error && zonedNews.length > 0 && windowInfo.total > 0 && (
        <div className="fixed bottom-[68px] left-1/2 -translate-x-1/2 z-40 phantom-news-left">
          {activeZone} · {windowInfo.from}–{windowInfo.to} of {windowInfo.total}
        </div>
      )}

      {/* Drag hint */}
      {!loading && !error && sortedNews.length > 0 && (
        <div className="phantom-drag-hint fixed bottom-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 phantom-mono-dim pointer-events-none">
          <MousePointer2 size={11} />
          Drag or scroll to explore
        </div>
      )}

      {/* ===== BOTTOM NAV (category zones — click to fly there) ===== */}
      {!loading && (
        <nav className="phantom-bottomnav">
          {ZONE_ORDER.map(cat => (
            <button
              key={cat}
              onClick={() => flyToZone(cat)}
              className={`phantom-nav-pill ${activeZone === cat ? 'active' : ''}`}
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
              <p className="phantom-mono-dim">Auto-refresh: every 15 min (server-controlled via Redis cache)</p>

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

      {/* ===== Article Reader (in-app popup) ===== */}
      {readerArticle && (
        <ArticleReader article={readerArticle} provider={chatProvider} onClose={() => setReaderArticle(null)} />
      )}
    </div>
  );
}
