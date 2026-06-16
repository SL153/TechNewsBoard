const NOTIFICATIONS_KEY = 'technews-notifications';

export type Category = 'All' | 'Startups' | 'Consumer Tech' | 'AI' | 'AI Blogs' | 'Innovation' | 'Open Source';

export interface NotificationConfig {
  enabled: boolean;
  filters: Record<Category, string[]>;
}

export interface NotificationResult {
  matchedArticles: Array<{ title: string; category: string; source: string; link?: string }>;
}

const DEFAULT_CONFIG: NotificationConfig = {
  enabled: false,
  filters: {
    'All': [],
    'Startups': [],
    'Consumer Tech': [],
    'AI': [],
    'AI Blogs': [],
    'Innovation': [],
    'Open Source': [],
  },
};

export function loadNotificationConfig(): NotificationConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY);
    if (!stored) return DEFAULT_CONFIG;
    const data = JSON.parse(stored);
    
    // Ensure all categories exist in filters
    const mergedFilters = { ...DEFAULT_CONFIG.filters };
    if (data.filters && typeof data.filters === 'object') {
      for (const cat of Object.keys(mergedFilters)) {
        if (Array.isArray(data.filters[cat])) {
          mergedFilters[cat] = data.filters[cat];
        }
      }
    }
    
    return {
      enabled: data.enabled !== false,
      filters: mergedFilters,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveNotificationConfig(config: NotificationConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(config));
}

export function updateCategoryKeywords(category: Category, keywords: string[]): NotificationConfig {
  const config = loadNotificationConfig();
  config.filters[category] = keywords.map(k => k.trim().toLowerCase()).filter(k => k.length > 0);
  saveNotificationConfig(config);
  return config;
}

export function toggleNotifications(): NotificationConfig {
  const config = loadNotificationConfig();
  config.enabled = !config.enabled;
  saveNotificationConfig(config);
  return config;
}

// Check articles against notification keywords and return matches
export function checkArticleMatches(articles: Array<{ title: string; description?: string; category: string; source: string; link?: string }>): NotificationResult {
  const config = loadNotificationConfig();
  if (!config.enabled) return { matchedArticles: [] };

  const matchedArticles = [];
  
  for (const article of articles) {
    const textToCheck = `${article.title} ${article.description || ''}`.toLowerCase();
    
    // Check against category-specific keywords first
    const catKeywords = config.filters[article.category as Category] || [];
    let matchesKeyword = false;
    
    for (const keyword of catKeywords) {
      if (textToCheck.includes(keyword)) {
        matchesKeyword = true;
        break;
      }
    }
    
    // Also check against 'All' keywords
    const allKeywords = config.filters['All'] || [];
    for (const keyword of allKeywords) {
      if (textToCheck.includes(keyword)) {
        matchesKeyword = true;
        break;
      }
    }
    
    if (matchesKeyword) {
      matchedArticles.push(article);
    }
  }

  return { matchedArticles };
}

// Show browser notification for matched articles
export function showNotifications(matchedArticles: Array<{ title: string; category: string; source: string; link?: string }>): void {
  if (typeof window === 'undefined') return;
  
  // Check permission
  if (!('Notification' in window)) return;
  if (window.Notification.permission !== 'granted') return;

  // Deduplicate by title
  const uniqueArticles = [];
  const seenTitles = new Set();
  for (const article of matchedArticles) {
    if (!seenTitles.has(article.title)) {
      seenTitles.add(article.title);
      uniqueArticles.push(article);
    }
  }

  // Show notification with first match or summary
  if (uniqueArticles.length === 0) return;

  const title = uniqueArticles.length > 1 
    ? `${uniqueArticles.length} new articles matched your keywords`
    : `New article: ${uniqueArticles[0].title}`;

  const body = uniqueArticles.length > 1
    ? `${uniqueArticles.slice(0, 3).map(a => a.title).join(' · ')}${uniqueArticles.length > 3 ? '...' : ''}`
    : `${uniqueArticles[0].source} (${uniqueArticles[0].category})`;

  try {
    const notification = new Notification(title, { body });
    
    if (uniqueArticles[0]?.link) {
      notification.onclick = () => {
        window.open(uniqueArticles[0].link, '_blank');
      };
    }
  } catch {
    // Silently fail if notification creation fails
  }
}
