'use client';

import { useState, useRef } from 'react';
import { Download, Upload, FileUp } from 'lucide-react';
import { loadFeeds, saveFeeds, FEEDS_KEY } from '@/lib/feed-store';

export default function FeedImportExport({ darkMode }) {
  const [importStatus, setImportStatus] = useState(null);
  const fileInputRef = useRef();

  function exportFeeds() {
    const data = localStorage.getItem(FEEDS_KEY);
    if (!data) return;
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'technews-feeds.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus('loading');
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        const parsed = JSON.parse(text);
        if (!parsed.sources || !Array.isArray(parsed.sources)) {
          setImportStatus('error');
          return;
        }
        saveFeeds(parsed.sources);
        setImportStatus('ok');
        window.location.reload();
      } catch {
        setImportStatus('error');
      }
    };
    reader.readAsText(file);
  }

  function resetToDefaults() {
    localStorage.removeItem(FEEDS_KEY);
    window.location.reload();
  }

  return (
    <div className="flex items-center gap-2">
      {/* Export */}
      <button
        onClick={exportFeeds}
        title="Export feeds"
        className="p-1.5 rounded-lg hover:bg-muted dark:hover:bg-accent text-muted-foreground"
      >
        <Download size={14} />
      </button>

      {/* Import */}
      <label
        title="Import feeds"
        className="p-1.5 rounded-lg hover:bg-muted dark:hover:bg-accent text-muted-foreground cursor-pointer"
      >
        <Upload size={14} />
        <input
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
      </label>

      {/* Reset */}
      <button
        onClick={resetToDefaults}
        title="Reset to default feeds"
        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-600"
      >
        <FileUp size={14} />
      </button>

      {/* Status indicator */}
      {importStatus === 'loading' && (
        <span className="text-xs text-muted-foreground animate-pulse">Importing...</span>
      )}
      {importStatus === 'error' && (
        <span className="text-xs text-red-500">Invalid file</span>
      )}
    </div>
  );
}