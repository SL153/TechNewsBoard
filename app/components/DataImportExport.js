'use client';

import { useState } from 'react';
import { Download, Upload, FileUp, Check, AlertTriangle, ChevronDown, X } from 'lucide-react';
import * as ExportLib from '@/lib/export';
import * as ImportLib from '@/lib/import';

export default function DataImportExport({ darkMode }) {
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [importMode, setImportMode] = useState('skip');

  function handleExportAll() {
    ExportLib.exportAllData();
  }

  function handleExportBookmarks() {
    ExportLib.exportBookmarks();
  }

  function handleExportSettings() {
    ExportLib.exportSettings();
  }

  function handleExportFeeds() {
    ExportLib.exportFeeds();
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImportStatus('loading');
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        const parsed = JSON.parse(text);
        
        if (parsed.version !== 1) {
          setImportStatus({ type: 'error', message: `Unsupported schema version ${parsed.version}` });
          return;
        }

        let preview = {};
        if (parsed.bookmarks && Array.isArray(parsed.bookmarks)) {
          const existingBookmarks = loadBookmarks();
          const newCount = parsed.bookmarks.filter(b => !(b.link || b.title)).length;
          preview.bookmarks = { total: parsed.bookmarks.length, newOnly: newCount };
        }
        if (parsed.settings !== undefined) {
          preview.settings = true;
        }
        if (parsed.feeds && Array.isArray(parsed.feeds)) {
          const existingFeeds = loadFeeds();
          const existingUrls = new Set(existingFeeds.map(f => f.url));
          const newCount = parsed.feeds.filter(f => !existingUrls.has(f.url)).length;
          preview.feeds = { total: parsed.feeds.length, newOnly: newCount };
        }
        if (parsed.chatProvider !== undefined) {
          preview.chatProvider = true;
        }

        setImportPreview(preview);
        setImportStatus(null);
      } catch {
        setImportStatus({ type: 'error', message: 'Invalid JSON file' });
      }
    };
    reader.readAsText(file);
  }

  function confirmImport() {
    const input = document.getElementById('import-file-input');
    if (!input?.files?.[0]) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        const result = ImportLib.importAllData(text, importMode);
        
        setImportStatus({ type: 'ok', result });
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        setImportStatus({ type: 'error', message: err.message });
      }
    };
    reader.readAsText(input.files[0]);
  }

  function loadBookmarks() {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('technews-bookmarks');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  }

  function loadFeeds() {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('technews-feeds');
      if (!stored) return [];
      const data = JSON.parse(stored);
      return data.sources || [];
    } catch { return []; }
  }

  function resetAll() {
    localStorage.removeItem('technews-bookmarks');
    localStorage.removeItem('technews-settings');
    localStorage.removeItem('technews-feeds');
    localStorage.removeItem('technews-chat-provider');
    window.location.reload();
  }

  const hasPreview = !!importPreview && Object.keys(importPreview).length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Data Management</span>
      </div>

      {/* Export buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handleExportAll}
          title="Export all data"
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-800 flex items-center gap-1.5"
        >
          <Download size={12} /> Export All Data
        </button>

        <div className="flex gap-1">
          <button
            onClick={handleExportBookmarks}
            title="Export bookmarks"
            className="px-2 py-1.5 rounded-lg text-xs border border-border bg-secondary hover:bg-muted dark:bg-accent dark:hover:bg-muted/80 text-muted-foreground flex items-center gap-1"
          >
            <Download size={12} /> Bookmarks
          </button>
          <button
            onClick={handleExportSettings}
            title="Export settings"
            className="px-2 py-1.5 rounded-lg text-xs border border-border bg-secondary hover:bg-muted dark:bg-accent dark:hover:bg-muted/80 text-muted-foreground flex items-center gap-1"
          >
            <Download size={12} /> Settings
          </button>
          <button
            onClick={handleExportFeeds}
            title="Export feeds"
            className="px-2 py-1.5 rounded-lg text-xs border border-border bg-secondary hover:bg-muted dark:bg-accent dark:hover:bg-muted/80 text-muted-foreground flex items-center gap-1"
          >
            <Download size={12} /> Feeds
          </button>
        </div>

        {/* Import button */}
        <label
          title="Import data"
          className="px-2 py-1.5 rounded-lg text-xs border border-border bg-secondary hover:bg-muted dark:bg-accent dark:hover:bg-muted/80 text-muted-foreground cursor-pointer flex items-center gap-1"
        >
          <Upload size={12} /> Import
          <input
            id="import-file-input"
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />
        </label>

        {/* Reset button */}
        <button
          onClick={resetAll}
          title="Reset all data to defaults"
          className="px-2 py-1.5 rounded-lg text-xs border border-border bg-secondary hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-600 flex items-center gap-1"
        >
          <FileUp size={12} /> Reset All
        </button>
      </div>

      {/* Import preview modal */}
      {showImportModal && hasPreview && (
        <div className="p-3 rounded-lg border border-border bg-card space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Import Preview</span>
            <button onClick={() => setShowImportModal(false)} className="p-1 hover:bg-muted rounded">
              <X size={12} />
            </button>
          </div>

          {/* Import mode selector */}
          <div className="flex gap-1.5">
            <button
              onClick={() => setImportMode('skip')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                importMode === 'skip' ? 'bg-blue-600 text-white dark:bg-blue-700' : 'bg-secondary hover:bg-muted text-muted-foreground'
              }`}
            >
              Skip duplicates (Recommended)
            </button>
            <button
              onClick={() => setImportMode('replace')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                importMode === 'replace' ? 'bg-blue-600 text-white dark:bg-blue-700' : 'bg-secondary hover:bg-muted text-muted-foreground'
              }`}
            >
              Replace all data
            </button>
          </div>

          {/* Preview details */}
          <div className="space-y-1">
            {importPreview.bookmarks && (
              <div className="flex items-center gap-2 text-xs">
                {importMode === 'replace' ? (
                  <>
                    <Check size={12} className="text-green-600" />
                    <span>Bookmarks: {importPreview.bookmarks.total}</span>
                  </>
                ) : (
                  <>
                    <ChevronDown size={12} className="text-muted-foreground" />
                    <span>Bookmarks: {importPreview.bookmarks.newOnly} new</span>
                  </>
                )}
              </div>
            )}

            {importPreview.settings && (
              <div className="flex items-center gap-2 text-xs">
                <Check size={12} className="text-green-600" />
                <span>Settings will be merged</span>
              </div>
            )}

            {importPreview.feeds && (
              <div className="flex items-center gap-2 text-xs">
                {importMode === 'replace' ? (
                  <>
                    <Check size={12} className="text-green-600" />
                    <span>Feeds: {importPreview.feeds.total}</span>
                  </>
                ) : (
                  <>
                    <ChevronDown size={12} className="text-muted-foreground" />
                    <span>Feeds: {importPreview.feeds.newOnly} new</span>
                  </>
                )}
              </div>
            )}

            {importPreview.chatProvider && (
              <div className="flex items-center gap-2 text-xs">
                <Check size={12} className="text-green-600" />
                <span>Chat provider will be merged</span>
              </div>
            )}
          </div>

          {/* Confirm button */}
          <button
            onClick={confirmImport}
            className={`w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              importMode === 'replace' ? 'bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800' : 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-800'
            }`}
          >
            {importMode === 'replace' ? 'Replace All Data' : 'Import Data'}
          </button>

          {/* Warning for replace mode */}
          {importMode === 'replace' && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle size={12} />
              <span>Warning: This will replace all existing data</span>
            </div>
          )}
        </div>
      )}

      {/* Import status */}
      {importStatus && (
        <div className={`p-3 rounded-lg border text-xs ${
          importStatus.type === 'ok' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-100' :
          importStatus.type === 'error' ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-100' :
          'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-100 animate-pulse'
        }`}>
          {importStatus.type === 'loading' && (
            <span>Importing...</span>
          )}
          {importStatus.type === 'error' && (
            <>
              <AlertTriangle size={12} className="inline mr-1" />
              <span>{importStatus.message}</span>
            </>
          )}
          {importStatus.type === 'ok' && importStatus.result && (
            <>
              <Check size={12} className="inline mr-1" />
              <span>Import complete: {importStatus.result.bookmarksCount} bookmarks, {importStatus.result.feedsAdded} feeds added</span>
            </>
          )}
        </div>
      )}

      {/* Show preview modal when file is loaded */}
      {importPreview && !showImportModal && (
        <button
          onClick={() => setShowImportModal(true)}
          className="w-full px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:bg-blue-700/20 dark:hover:bg-blue-700/30 dark:text-blue-300 flex items-center justify-center gap-1.5"
        >
          <ChevronDown size={12} /> Review import preview
        </button>
      )}
    </div>
  );
}
