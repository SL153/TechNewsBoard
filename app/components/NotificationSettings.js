'use client';

import { useState, useEffect } from 'react';
import { Bell, ChevronDown, Check, X } from 'lucide-react';
import * as NotificationStore from '@/lib/notification-store';

const CATEGORIES = ['All', 'Startups', 'Consumer Tech', 'AI', 'Innovation', 'Open Source'];

export default function NotificationSettings({ darkMode }) {
  const [config, setConfig] = useState(NotificationStore.loadNotificationConfig());
  const [openCategories, setOpenCategories] = useState(new Set(['All']));
  const [keywordInputs, setKeywordInputs] = useState({});
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPermissionGranted(NotificationStore.loadNotificationConfig().enabled && 
        ('Notification' in window) && window.Notification.permission === 'granted');
    }
  }, []);

  function handleToggleEnable() {
    const newConfig = NotificationStore.toggleNotifications();
    setConfig(newConfig);
    
    // Request permission if enabling and not already granted
    if (newConfig.enabled && !permissionGranted) {
      requestPermission();
    }
  }

  async function requestPermission() {
    if (typeof window === 'undefined') return;
    try {
      const result = await Notification.requestPermission();
      setPermissionGranted(result === 'granted');
    } catch {
      // Permission denied or failed
    }
  }

  function toggleCategory(cat) {
    const newOpen = new Set(openCategories);
    if (newOpen.has(cat)) {
      newOpen.delete(cat);
    } else {
      newOpen.add(cat);
    }
    setOpenCategories(newOpen);
  }

  function handleKeywordChange(category, value) {
    setKeywordInputs(prev => ({ ...prev, [category]: value }));
  }

  function saveKeywords(category) {
    const input = keywordInputs[category] || '';
    const keywords = input.split(',').map(k => k.trim()).filter(k => k.length > 0);
    NotificationStore.updateCategoryKeywords(category, keywords);
    
    setConfig(prev => ({
      ...prev,
      filters: { ...prev.filters, [category]: keywords },
    }));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Bell size={12} /> Notifications
        </span>
        {permissionGranted && (
          <Check size={10} className="text-green-600" />
        )}
      </div>

      {/* Global toggle */}
      <button
        onClick={handleToggleEnable}
        className={`w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${
          config.enabled ? 'bg-blue-600 text-white dark:bg-blue-700' : 'bg-secondary hover:bg-muted text-muted-foreground border-border dark:bg-accent dark:hover:bg-muted/80 dark:text-muted-foreground dark:border-border'
        }`}
      >
        <span>{config.enabled ? 'Notifications Enabled' : 'Enable Notifications'}</span>
        {config.enabled ? (
          <Check size={12} className="mr-1" />
        ) : (
          <ChevronDown size={12} />
        )}
      </button>

      {/* Permission info */}
      {!permissionGranted && config.enabled && (
        <div className="text-xs text-muted-foreground">
          Browser permission needed. Click "Allow" when prompted.
        </div>
      )}

      {/* Keyword categories - only show if enabled */}
      {config.enabled && (
        <div className="space-y-1">
          {CATEGORIES.map(cat => (
            openCategories.has(cat) && (
              <div key={cat}>
                <div className="text-xs text-muted-foreground mb-1">{cat}</div>
                <input
                  type="text"
                  value={keywordInputs[cat] || config.filters[cat]?.join(', ') || ''}
                  onChange={(e) => handleKeywordChange(cat, e.target.value)}
                  onBlur={() => saveKeywords(cat)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveKeywords(cat);
                  }}
                  placeholder="AI, startup, GPT..."
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs border bg-card border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
            )
          ))}

          {/* Expand/collapse all */}
          <button
            onClick={() => {
              if (openCategories.size === CATEGORIES.length) {
                setOpenCategories(new Set(['All']));
              } else {
                setOpenCategories(new Set(CATEGORIES));
              }
            }}
            className="w-full px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground"
          >
            {openCategories.size === CATEGORIES.length ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      )}

      {/* Disabled state message */}
      {!config.enabled && (
        <div className="text-xs text-muted-foreground text-center py-2">
          Enable notifications to receive alerts for keyword matches.
        </div>
      )}
    </div>
  );
}
