import { NewsSource } from './news-sources';

const FEEDS_KEY = 'technews-feeds';

export interface StoredFeed {
  url: string;
  category: string;
  source: string;
  maxItems?: number;
  enabled: boolean;
}

export interface FeedStoreData {
  version: number;
  sources: StoredFeed[];
}

// Default feeds matching current RSS_FEEDS in news-sources.ts
const DEFAULT_SOURCES: StoredFeed[] = [
  { url: 'https://feeds.feedburner.com/TechCrunch/', category: 'Startups', source: 'TechCrunch', maxItems: 15, enabled: true },
  { url: 'https://venturebeat.com/feed/', category: 'Startups', source: 'VentureBeat', maxItems: 15, enabled: true },
  { url: 'https://www.techmeme.com/feed.xml', category: 'Startups', source: 'TechMeme', maxItems: 15, enabled: true },
  { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910', category: 'Startups', source: 'CNBC Technology', maxItems: 15, enabled: true },

  { url: 'https://www.theverge.com/rss/index.xml', category: 'Consumer Tech', source: 'The Verge', maxItems: 15, enabled: true },
  { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', category: 'Consumer Tech', source: 'BBC Technology', maxItems: 15, enabled: true },
  { url: 'https://news.google.com/rss/search?q=technology&hl=en-US&gl=US&ceid=US:en', category: 'Consumer Tech', source: 'Google News Tech', maxItems: 15, enabled: true },
  { url: 'https://www.engadget.com/rss.xml', category: 'Consumer Tech', source: 'Engadget', maxItems: 15, enabled: true },
  { url: 'https://9to5mac.com/feed/', category: 'Consumer Tech', source: '9to5Mac', maxItems: 15, enabled: true },

  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', category: 'AI', source: 'TechCrunch AI', maxItems: 15, enabled: true },
  { url: 'https://blog.google/technology/ai/rss/', category: 'AI', source: 'Google AI Blog', maxItems: 15, enabled: true },
  { url: 'https://openai.com/blog/rss.xml', category: 'AI', source: 'OpenAI Blog', maxItems: 15, enabled: true },
  { url: 'https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss', category: 'AI', source: 'IEEE Spectrum AI', maxItems: 15, enabled: true },

  { url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'Innovation', source: 'Ars Technica', maxItems: 15, enabled: true },
  { url: 'https://www.wired.com/feed/rss', category: 'Innovation', source: 'Wired', maxItems: 15, enabled: true },
  { url: 'https://www.technologyreview.com/feed/', category: 'Innovation', source: 'MIT Technology Review', maxItems: 10, enabled: true },
  { url: 'https://www.fastcompany.com/feeds/technology.rss', category: 'Innovation', source: 'Fast Company', maxItems: 10, enabled: true },
  { url: 'https://www.theregister.com/headlines.atom', category: 'Innovation', source: 'The Register', maxItems: 15, enabled: true },

  { url: 'https://www.opensourceforu.com/feed/', category: 'Open Source', source: 'Open Source For U', maxItems: 10, enabled: true },
  { url: 'https://huggingface.co/blog/feed.xml', category: 'Open Source', source: 'Hugging Face Blog', maxItems: 15, enabled: true },
];

export function loadFeeds(): StoredFeed[] {
  if (typeof window === 'undefined') return DEFAULT_SOURCES;
  try {
    const stored = localStorage.getItem(FEEDS_KEY);
    if (!stored) return DEFAULT_SOURCES;
    const data = JSON.parse(stored) as FeedStoreData;
    if (!data.sources || !Array.isArray(data.sources)) return DEFAULT_SOURCES;
    return data.sources;
  } catch {
    return DEFAULT_SOURCES;
  }
}

export function saveFeeds(sources: StoredFeed[]): void {
  if (typeof window === 'undefined') return;
  const data: FeedStoreData = { version: 1, sources };
  localStorage.setItem(FEEDS_KEY, JSON.stringify(data));
}

export function addFeed(feed: StoredFeed): StoredFeed[] {
  const feeds = loadFeeds();
  const updated = [...feeds, feed];
  saveFeeds(updated);
  return updated;
}

export function updateFeed(url: string, updates: Partial<StoredFeed>): StoredFeed[] {
  const feeds = loadFeeds();
  const updated = feeds.map(f => f.url === url ? { ...f, ...updates } : f);
  saveFeeds(updated);
  return updated;
}

export function removeFeed(url: string): StoredFeed[] {
  const feeds = loadFeeds();
  const updated = feeds.filter(f => f.url !== url);
  saveFeeds(updated);
  return updated;
}

export function toggleFeed(url: string): StoredFeed[] {
  const feeds = loadFeeds();
  const updated = feeds.map(f => f.url === url ? { ...f, enabled: !f.enabled } : f);
  saveFeeds(updated);
  return updated;
}

// Get only enabled sources as NewsSource array for RSS parser
export function getEnabledSources(): NewsSource[] {
  return loadFeeds()
    .filter(f => f.enabled)
    .map(({ url, category, source, maxItems }) => ({
      url,
      category,
      source,
      maxItems: maxItems || 15,
    }));
}

export { FEEDS_KEY };