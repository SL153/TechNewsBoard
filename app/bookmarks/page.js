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
    <div className="min-h-screen bg-background text-foreground transition-[background-color,color] duration-300" style={{ backgroundImage: darkMode ? undefined : 'linear-gradient(135deg, #f9fafb, #ebf5ff)' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b backdrop-blur-xl bg-card/70 dark:bg-background/80 border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <ArrowLeft size={18} />
            <h1 className="text-xl font-bold tracking-tight">Bookmarks</h1>
          </Link>
          <div className="flex items-center gap-2">
            {bookmarks.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors bg-destructive/10 dark:bg-destructive/20 text-destructive hover:bg-destructive/20 dark:hover:bg-destructive/30 border-border dark:border-destructive/60"
              >
                Clear All ({bookmarks.length})
              </button>
            )}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg transition-colors hover:bg-muted dark:hover:bg-accent"
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
            <Link href="/" className="text-xs underline dark:text-blue-300 text-blue-600">Browse articles to bookmark them</Link>
          </div>
        )}

        <div className="grid gap-3">
          {sortedBookmarks.map((item, idx) => (
            <a
              key={idx}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 rounded-xl border transition-all hover:shadow-md group bg-card dark:bg-card border-border dark:border-border hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 text-xs text-muted-foreground">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${darkMode ? 'bg-blue-700/15 text-blue-300' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>{item.category}</span>
                    <span className="w-1 h-1 rounded-full bg-muted dark:bg-accent" />
                    <span>{item.source}</span>
                  </div>
                  <h2 className="text-sm font-semibold leading-snug mb-1.5 group-hover:underline truncate">{item.title}</h2>
                  {item.description && (
                    <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeBookmark(item.link); }}
                  className="p-1.5 rounded-lg transition-colors flex-shrink-0 dark:text-blue-300 dark:hover:bg-accent text-blue-600 hover:bg-blue-50"
                  title="Remove bookmark"
                >
                  <BookmarkCheck size={16} />
                </button>
              </div>
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Clock size={12} />
                {item.pubDate ? new Date(item.pubDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                <span className="w-1 h-1 rounded-full bg-muted dark:bg-accent" />
                Bookmarked: {new Date(item.bookmarkedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </a>
          ))}
        </div>

        {sortedBookmarks.length > 0 && (
          <div className="mt-6 text-center text-xs text-muted-foreground">
            {sortedBookmarks.length} bookmarked articles
          </div>
        )}
      </main>
    </div>
  );
}
