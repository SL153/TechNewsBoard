'use client';

import { useState, useEffect } from 'react';
import { Loader2, Check, X, Plus, Trash2, ExternalLink, Eye, EyeOff, Rss, Edit2 } from 'lucide-react';
import { loadFeeds, saveFeeds, addFeed, updateFeed, removeFeed, toggleFeed } from '@/lib/feed-store';
import FeedImportExport from './FeedImportExport';

const CATEGORIES = ['Startups', 'Consumer Tech', 'AI', 'Innovation', 'Open Source'];
const FEEDS_KEY = 'technews-feeds';

export default function FeedManager({ darkMode, onFeedsChange }) {
  const [feeds, setFeeds] = useState([]);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedSource, setNewFeedSource] = useState('');
  const [newFeedCategory, setNewFeedCategory] = useState('Startups');
  const [editingUrl, setEditingUrl] = useState(null);
  const [editSource, setEditSource] = useState('');
  const [testing, setTesting] = useState(null);
  const [testResults, setTestResults] = useState({});

  useEffect(() => {
    setFeeds(loadFeeds());
  }, []);

  function handleAddFeed() {
    if (!newFeedUrl.trim() || !newFeedSource.trim()) return;
    const feed = {
      url: newFeedUrl.trim(),
      source: newFeedSource.trim(),
      category: newFeedCategory,
      maxItems: 15,
      enabled: true,
    };
    const updated = addFeed(feed);
    setFeeds(updated);
    setNewFeedUrl('');
    setNewFeedSource('');
    if (onFeedsChange) onFeedsChange(updated);
  }

  function handleUpdateFeed(url) {
    if (!editSource.trim()) return;
    const updated = updateFeed(url, { source: editSource.trim() });
    setFeeds(updated);
    setEditingUrl(null);
    setEditSource('');
    if (onFeedsChange) onFeedsChange(updated);
  }

  function handleDeleteFeed(url) {
    const updated = removeFeed(url);
    setFeeds(updated);
    if (onFeedsChange) onFeedsChange(updated);
  }

  function handleToggleFeed(url) {
    const updated = toggleFeed(url);
    setFeeds(updated);
    if (onFeedsChange) onFeedsChange(updated);
  }

  async function testFeedUrl(url) {
    setTesting(url);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      setTestResults(prev => ({ ...prev, [url]: res.ok ? 'ok' : 'error' }));
    } catch {
      setTestResults(prev => ({ ...prev, [url]: 'error' }));
    }
    setTesting(null);
  }

  function startEdit(feed) {
    setEditingUrl(feed.url);
    setEditSource(feed.source);
  }

  const groupedFeeds = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = feeds.filter(f => f.category === cat);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">RSS Sources</span>
        <FeedImportExport darkMode={darkMode} />
      </div>

      {/* Add new feed form */}
      <div className="p-2.5 rounded-lg border border-border bg-card dark:bg-accent/50 space-y-2">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newFeedSource}
            onChange={(e) => setNewFeedSource(e.target.value)}
            placeholder="Source name..."
            className="flex-1 px-2 py-1 rounded text-xs border bg-background dark:bg-card border-border text-foreground placeholder:text-muted-foreground"
          />
          <select
            value={newFeedCategory}
            onChange={(e) => setNewFeedCategory(e.target.value)}
            className="px-2 py-1 rounded text-xs border bg-background dark:bg-card border-border text-foreground"
          >
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newFeedUrl}
            onChange={(e) => setNewFeedUrl(e.target.value)}
            placeholder="https://example.com/feed.xml"
            className="flex-1 px-2 py-1 rounded text-xs border bg-background dark:bg-card border-border text-foreground placeholder:text-muted-foreground"
          />
          <button
            onClick={testFeedUrl}
            disabled={!newFeedUrl.trim() || testing}
            className="px-2 py-1 rounded text-xs border border-border bg-secondary hover:bg-muted dark:bg-accent dark:hover:bg-muted/80 disabled:opacity-40"
          >
            {testing === newFeedUrl ? <Loader2 size={12} className="animate-spin" /> : 'Test'}
          </button>
          <button
            onClick={handleAddFeed}
            disabled={!newFeedUrl.trim() || !newFeedSource.trim()}
            className="px-2 py-1 rounded text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-800 disabled:opacity-40"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Feed list by category */}
      {CATEGORIES.map(cat => (
        groupedFeeds[cat].length > 0 && (
          <div key={cat}>
            <div className="text-xs text-muted-foreground mb-1">{cat}</div>
            <div className="space-y-1">
              {groupedFeeds[cat].map(feed => (
                <div
                  key={feed.url}
                  className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${!feed.enabled ? 'opacity-50' : ''}`}
                >
                  {/* Enable toggle */}
                  <button
                    onClick={() => handleToggleFeed(feed.url)}
                    className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                      feed.enabled
                        ? 'bg-blue-600 border-blue-600'
                        : 'bg-transparent border-muted dark:border-accent/50'
                    }`}
                  >
                    {feed.enabled && <Check size={8} className="text-white" />}
                  </button>

                  {/* Source name / edit field */}
                  {editingUrl === feed.url ? (
                    <input
                      type="text"
                      value={editSource}
                      onChange={(e) => setEditSource(e.target.value)}
                      onBlur={() => handleUpdateFeed(feed.url)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdateFeed(feed.url)}
                      autoFocus
                      className="flex-1 px-1 py-0.5 rounded text-xs border bg-background dark:bg-card border-border text-foreground"
                    />
                  ) : (
                    <span className={`flex-1 truncate ${!feed.enabled ? 'line-through' : ''}`}>
                      {feed.source}
                    </span>
                  )}

                  {/* Test button */}
                  <button
                    onClick={() => testFeedUrl(feed.url)}
                    disabled={testing === feed.url || !feed.enabled}
                    className="px-1.5 py-0.5 rounded text-xs border border-border bg-secondary hover:bg-muted dark:bg-accent dark:hover:bg-muted/80 disabled:opacity-40"
                  >
                    {testing === feed.url ? <Loader2 size={10} className="animate-spin" /> : testResults[feed.url] === 'ok' ? <Check size={10} className="text-green-600" /> : testResults[feed.url] === 'error' ? <X size={10} className="text-red-500" /> : 'Test'}
                  </button>

                  {/* Edit button */}
                  <button
                    onClick={() => startEdit(feed)}
                    disabled={editingUrl !== null}
                    className="p-1 rounded hover:bg-muted dark:hover:bg-accent text-muted-foreground disabled:opacity-40"
                  >
                    <Edit2 size={10} />
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDeleteFeed(feed.url)}
                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-600"
                  >
                    <Trash2 size={10} />
                  </button>

                  {/* Link */}
                  <a
                    href={feed.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded hover:bg-muted dark:hover:bg-accent text-muted-foreground flex-shrink-0"
                  >
                    <ExternalLink size={10} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )
      ))}

      {/* Empty state */}
      {feeds.length === 0 && (
        <div className="text-xs text-muted-foreground text-center py-4">
          No feeds configured. Add one above.
        </div>
      )}
    </div>
  );
}