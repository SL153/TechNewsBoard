'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Moon, Sun, ExternalLink, Filter, Clock, Zap, Search, Bookmark, BookmarkCheck, ChevronUp, ChevronDown, X } from 'lucide-react';
import Link from 'next/link';

const CATEGORIES = ['All', 'Startups', 'Consumer Tech', 'Innovation'];
const AUTO_REFRESH_INTERVAL = 300000;
const BOOKMARKS_KEY = 'technews-bookmarks';

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

const CATEGORY_COLORS = {
  Startups: { bg: 'bg-blue-950/50', text: 'text-blue-300', border: 'border-blue-100', lightBg: 'bg-blue-50', darkText: 'text-blue-700' },
  'Consumer Tech': { bg: 'bg-purple-950/50', text: 'text-purple-300', border: 'border-purple-100', lightBg: 'bg-purple-50', darkText: 'text-purple-700' },
  Innovation: { bg: 'bg-emerald-950/50', text: 'text-emerald-300', border: 'border-emerald-100', lightBg: 'bg-emerald-50', darkText: 'text-emerald-700' },
};

const SOURCE_GRADIENTS = [
  'from-blue-600 to-indigo-700',
  'from-purple-600 to-pink-700',
  'from-emerald-600 to-teal-700',
  'from-orange-600 to-red-700',
  'from-cyan-600 to-blue-700',
  'from-yellow-500 to-orange-600',
  'from-gray-600 to-gray-800',
];

function getGradient(source) {
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = source.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SOURCE_GRADIENTS[Math.abs(hash) % SOURCE_GRADIENTS.length];
}

export default function Home() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('All');
  const [darkMode, setDarkMode] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [bookmarks, setBookmarks] = useState([]);
  const [sortOrder, setSortOrder] = useState('newest');

  useEffect(() => {
    fetchNews();
  }, []);

  useEffect(() => {
    setBookmarks(loadBookmarks());
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    if (!autoRefresh || loading) return;
    const interval = setInterval(async () => {
      await fetchNews(true);
    }, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [autoRefresh, loading]);

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

  const filteredNews = news.filter(n => {
    const matchesCategory = category === 'All' || n.category === category;
    if (!searchQuery.trim()) return matchesCategory;
    const q = searchQuery.toLowerCase();
    return matchesCategory && (n.title.toLowerCase().includes(q) || (n.description && n.description.toLowerCase().includes(q)));
  });

  const sortedNews = [...filteredNews].sort((a, b) => {
    if (!a.pubDate && !b.pubDate) return 0;
    if (!a.pubDate) return 1;
    if (!b.pubDate) return -1;
    const dateA = new Date(a.pubDate).getTime();
    const dateB = new Date(b.pubDate).getTime();
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  function isBookmarked(link) {
    return bookmarks.some(b => b.link === link);
  }

  const summaryItems = sortedNews.slice(0, 5);
  const mainItems = sortedNews.slice(5);

  function formatDate(dateStr) {
    if (!dateStr) return 'Unknown date';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const now = new Date();
    const then = new Date(dateStr);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return formatDate(dateStr);
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-950 text-gray-100' : 'bg-gradient-to-br from-slate-50 to-blue-50 text-gray-900'} transition-colors duration-300`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 border-b backdrop-blur-xl ${darkMode ? 'bg-gray-950/80 border-gray-800' : 'bg-white/70 border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">Tech News Dashboard</h1>
            {autoRefresh && (
              <span className={`hidden sm:inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-green-950/50 text-green-400' : 'bg-green-100 text-green-700'}`}>
                <Zap size={10} className="animate-pulse" /> Auto-refresh ON
              </span>
            )}
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/bookmarks" className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'} relative`} title="Bookmarks">
              <Bookmark size={18} />
              {bookmarks.length > 0 && (
                <span className={`absolute -top-0.5 -right-0.5 text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold ${darkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'}`}>
                  {bookmarks.length}
                </span>
              )}
            </Link>
            <button onClick={() => setAutoRefresh(!autoRefresh)} className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'} ${autoRefresh ? (darkMode ? 'text-green-400' : 'text-green-600') : ''}`} title="Toggle auto-refresh">
              <Zap size={18} className={autoRefresh ? 'animate-pulse' : ''} />
            </button>
            <button onClick={() => fetchNews(true)} disabled={loading} className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`} title="Refresh now">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`} title="Toggle theme">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-5">
        {/* Search Bar */}
        <div className="mb-4">
          <div className={`relative`}>
            <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search articles by title or description..."
              className={`w-full pl-9 pr-12 py-3 rounded-xl text-sm border transition-colors ${
                darkMode ? 'bg-gray-900 border-gray-800 text-gray-100 placeholder:text-gray-600 focus:border-blue-700' : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-gray-400'
              } outline-none`}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md ${darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
                <X size={16} />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className={`mt-2 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {sortedNews.length} result{sortedNews.length !== 1 ? 's' : ''} found for &ldquo;{searchQuery}&rdquo;
            </p>
          )}
        </div>

        {/* Category Filter + Sort */}
        <div className={`flex items-center justify-between flex-wrap gap-3 mb-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          <div className="flex items-center gap-2">
            <Filter size={16} />
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                category === cat ? darkMode ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'bg-gray-900 text-white shadow-lg shadow-gray-900/20' : darkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-400' : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200'
              }`}>
                {cat}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Clock size={14} />
            <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Sort:</span>
            <button onClick={() => setSortOrder('newest')} className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
              sortOrder === 'newest' ? darkMode ? 'bg-blue-600/50 text-blue-200' : 'bg-gray-900/90 text-white shadow-sm' : darkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-400' : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200'
            }`}>
              <ChevronUp size={12} /> Newest
            </button>
            <button onClick={() => setSortOrder('oldest')} className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
              sortOrder === 'oldest' ? darkMode ? 'bg-blue-600/50 text-blue-200' : 'bg-gray-900/90 text-white shadow-sm' : darkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-400' : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200'
            }`}>
              <ChevronDown size={12} /> Oldest
            </button>
          </div>
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
            <button onClick={() => fetchNews(true)} className={`mt-2 text-sm underline ${darkMode ? 'text-red-400' : 'text-red-600'}`}>Try again</button>
          </div>
        )}

        {/* Executive Summary */}
        {!loading && !error && summaryItems.length > 0 && (
          <section className="mb-8">
            <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              <Zap size={18} className={darkMode ? 'text-yellow-400' : 'text-blue-600'} /> Today&rsquo;s Top Stories
            </h2>
            <div className={`rounded-xl border p-5 ${darkMode ? 'bg-gray-900/30 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {summaryItems.map((item, idx) => (
                  <a key={`summary-${idx}`} href={item.link} target="_blank" rel="noopener noreferrer" className={`group flex flex-col ${darkMode ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'} rounded-lg p-3 transition-colors`}>
                    <div className={`flex items-center gap-2 mb-1.5 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      <span className={`px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[item.category]?.bg || darkMode ? 'bg-blue-950/50' : 'bg-blue-50'} ${CATEGORY_COLORS[item.category]?.text || (darkMode ? 'text-blue-300' : 'text-blue-700')} border ${(CATEGORY_COLORS[item.category]?.border || 'border-blue-100')}`}>
                        {item.category}
                      </span>
                      <span>{item.source}</span>
                    </div>
                    <h3 className={`text-sm font-semibold leading-snug mb-1 group-hover:underline line-clamp-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className={`text-xs leading-relaxed line-clamp-2 mb-1.5 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        {item.description}
                      </p>
                    )}
                    <div className={`flex items-center gap-1 mt-auto text-xs ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                      <Clock size={12} />
                      {formatTimeAgo(item.pubDate)}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* News Cards */}
        {!loading && !error && sortedNews.length === 0 && (
          <div className="text-center py-16 opacity-40">
            <p>{searchQuery ? 'No articles match your search.' : 'No news found for this category.'}</p>
          </div>
        )}

        <div className={`grid gap-5 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
          {mainItems.map((item, idx) => (
            <a key={`main-${idx}`} href={item.link} target="_blank" rel="noopener noreferrer" className={`block rounded-2xl border transition-all hover:shadow-lg group overflow-hidden ${
              darkMode ? 'bg-gray-900/50 border-gray-800 hover:border-gray-700' : 'bg-white border-gray-200 hover:border-gray-300'
            }`}>
              {/* Image */}
              <div className="relative h-48 overflow-hidden">
                {item.image ? (
                  <img src={item.image} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                ) : null}
                <div className={`hidden absolute inset-0 bg-gradient-to-br ${getGradient(item.source)} opacity-80`} />
              </div>

              {/* Content */}
              <div className="p-5">
                <div className={`flex items-center gap-2 mb-2 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  <span className={`px-2.5 py-1 rounded-full font-medium ${CATEGORY_COLORS[item.category]?.bg || darkMode ? 'bg-blue-950/50' : 'bg-blue-50'} ${CATEGORY_COLORS[item.category]?.text || (darkMode ? 'text-blue-300' : 'text-blue-700')} border ${(CATEGORY_COLORS[item.category]?.border || 'border-blue-100')}`}>
                    {item.category}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`} />
                  <span>{item.source}</span>
                </div>

                <h2 className={`text-base font-bold leading-snug mb-2 group-hover:underline line-clamp-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  {item.title}
                </h2>

                {item.description && (
                  <p className={`text-sm leading-relaxed mb-3 line-clamp-3 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {item.description}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-1.5 text-xs ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                    <Clock size={12} />
                    {formatDate(item.pubDate)}
                  </div>

                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleBookmark(item); }} className={`p-1.5 rounded-lg transition-colors ${
                      isBookmarked(item.link || item.title) ? (darkMode ? 'text-blue-400 hover:bg-gray-800' : 'text-blue-600 hover:bg-blue-50') : (darkMode ? 'text-gray-700 hover:text-gray-400 hover:bg-gray-800' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100')
                    }`} title={isBookmarked(item.link || item.title) ? 'Remove bookmark' : 'Bookmark article'}>
                      {isBookmarked(item.link || item.title) ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                    </button>
                    <ExternalLink size={14} className={`opacity-0 group-hover:opacity-30 transition-opacity`} />
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Footer */}
        {!loading && sortedNews.length > 0 && (
          <div className={`mt-8 text-center text-xs ${darkMode ? 'text-gray-700' : 'text-gray-400'}`}>
            {sortedNews.length} articles from {new Set(sortedNews.map(n => n.source)).size} sources · 
            Last updated: {lastFetchTime?.toLocaleTimeString() || new Date().toLocaleTimeString()}
          </div>
        )}
      </main>
    </div>
  );
}
