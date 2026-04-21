'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Moon, Sun, ExternalLink, Clock, BookmarkCheck, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState([]);
  const [darkMode, setDarkMode] = useState(false);

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

  function removeBookmark(link) {
    const newBookmarks = bookmarks.filter(b => b.link !== link);
    setBookmarks(newBookmarks);
    saveBookmarks(newBookmarks);
  }

  function clearAll() {
    setBookmarks([]);
    saveBookmarks([]);
  }

  const sortedBookmarks = [...bookmarks].sort((a, b) => new Date(b.bookmarkedAt || 0) - new Date(a.bookmarkedAt || 0));

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-950 text-gray-100' : 'bg-gradient-to-br from-slate-50 to-blue-50 text-gray-900'} transition-colors duration-300`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 border-b backdrop-blur-xl ${darkMode ? 'bg-gray-950/80 border-gray-800' : 'bg-white/70 border-gray-200'}`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <ArrowLeft size={18} />
            <h1 className="text-xl font-bold tracking-tight">Bookmarks</h1>
          </Link>
          <div className="flex items-center gap-2">
            {bookmarks.length > 0 && (
              <button
                onClick={clearAll}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${darkMode ? 'bg-red-950/30 text-red-400 hover:bg-red-950/50' : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'}`}
              >
                Clear All ({bookmarks.length})
              </button>
            )}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
              title="Toggle theme"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-5">
        {sortedBookmarks.length === 0 && (
          <div className="text-center py-20 opacity-40">
            <BookmarkCheck size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm mb-1">No bookmarks yet</p>
            <Link href="/" className={`text-xs underline ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>Browse articles to bookmark them</Link>
          </div>
        )}

        <div className="grid gap-3">
          {sortedBookmarks.map((item, idx) => (
            <a
              key={idx}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`block p-4 rounded-xl border transition-all hover:shadow-md group ${
                darkMode
                  ? 'bg-gray-900/50 border-gray-800 hover:border-gray-700 hover:bg-gray-900'
                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-lg'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className={`flex items-center gap-2 mb-1.5 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    <span className={`px-2 py-0.5 rounded-full font-medium ${
                      darkMode ? 'bg-blue-950/50 text-blue-300' : 'bg-blue-50 text-blue-700 border border-blue-100'
                    }`}>{item.category}</span>
                    <span className={`w-1 h-1 rounded-full ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`} />
                    <span>{item.source}</span>
                  </div>
                  <h2 className="text-sm font-semibold leading-snug mb-1.5 group-hover:underline truncate">{item.title}</h2>
                  {item.description && (
                    <p className={`text-xs leading-relaxed ${darkMode ? 'text-gray-500' : 'text-gray-500'} line-clamp-2`}>
                      {item.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeBookmark(item.link); }}
                  className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${darkMode ? 'text-blue-400 hover:bg-gray-800' : 'text-blue-600 hover:bg-blue-50'}`}
                  title="Remove bookmark"
                >
                  <BookmarkCheck size={16} />
                </button>
              </div>
              <div className={`flex items-center gap-1 mt-2 text-xs ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                <Clock size={12} />
                {item.pubDate ? new Date(item.pubDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                <span className={`w-1 h-1 rounded-full ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`} />
                Bookmarked: {new Date(item.bookmarkedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </a>
          ))}
        </div>

        {sortedBookmarks.length > 0 && (
          <div className={`mt-6 text-center text-xs ${darkMode ? 'text-gray-700' : 'text-gray-400'}`}>
            {sortedBookmarks.length} bookmarked articles
          </div>
        )}
      </main>
    </div>
  );
}
