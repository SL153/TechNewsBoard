export interface NewsSource {
  url: string;
  category: string;
  source: string;
  language?: string;
  maxItems?: number;
  timeout?: number;
  fallbackUrls?: string[];
}

// Default feeds matching current RSS_FEEDS in news-sources.ts
const DEFAULT_SOURCES: NewsSource[] = [
  // --- Startups ---
  { url: 'https://feeds.feedburner.com/TechCrunch/', category: 'Startups', source: 'TechCrunch', maxItems: 15, fallbackUrls: ['https://techcrunch.com/feed/'] },
  { url: 'https://venturebeat.com/feed/', category: 'Startups', source: 'VentureBeat', maxItems: 15, fallbackUrls: [] },
  { url: 'https://www.techmeme.com/feed.xml', category: 'Startups', source: 'TechMeme', maxItems: 15, fallbackUrls: [] },
  { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910', category: 'Startups', source: 'CNBC Technology', maxItems: 15, fallbackUrls: [] },

  // --- Consumer Tech ---
  { url: 'https://www.theverge.com/rss/index.xml', category: 'Consumer Tech', source: 'The Verge', maxItems: 15, fallbackUrls: ['https://www.theverge.com/rss/rss-index.xml'] },
  { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', category: 'Consumer Tech', source: 'BBC Technology', maxItems: 15, fallbackUrls: [] },
  { url: 'https://news.google.com/rss/search?q=technology&hl=en-US&gl=US&ceid=US:en', category: 'Consumer Tech', source: 'Google News Tech', maxItems: 15, fallbackUrls: [] },
  { url: 'https://www.engadget.com/rss.xml', category: 'Consumer Tech', source: 'Engadget', maxItems: 15, fallbackUrls: [] },
  { url: 'https://9to5mac.com/feed/', category: 'Consumer Tech', source: '9to5Mac', maxItems: 15, fallbackUrls: [] },

  // --- AI ---
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', category: 'AI', source: 'TechCrunch AI', maxItems: 15, fallbackUrls: [] },
  { url: 'https://blog.google/technology/ai/rss/', category: 'AI', source: 'Google AI Blog', maxItems: 15, fallbackUrls: [] },
  { url: 'https://openai.com/blog/rss.xml', category: 'AI', source: 'OpenAI Blog', maxItems: 15, fallbackUrls: ['https://openai.com/news/rss'] },
  { url: 'https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss', category: 'AI', source: 'IEEE Spectrum AI', maxItems: 15, fallbackUrls: [] },

  // --- Innovation ---
  { url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'Innovation', source: 'Ars Technica', maxItems: 15, fallbackUrls: ['https://arstechnica.com/feed/'] },
  { url: 'https://www.wired.com/feed/rss', category: 'Innovation', source: 'Wired', maxItems: 15, fallbackUrls: ['https://www.wired.com/feed/xml'] },
  { url: 'https://www.technologyreview.com/feed/', category: 'Innovation', source: 'MIT Technology Review', maxItems: 10, fallbackUrls: [] },
  { url: 'https://www.fastcompany.com/feeds/technology.rss', category: 'Innovation', source: 'Fast Company', maxItems: 10, fallbackUrls: ['https://www.fastcompany.com/feed'] },
  { url: 'https://www.theregister.com/headlines.atom', category: 'Innovation', source: 'The Register', maxItems: 15, fallbackUrls: [] },

  // --- Open Source ---
  { url: 'https://www.opensourceforu.com/feed/', category: 'Open Source', source: 'Open Source For U', maxItems: 10, fallbackUrls: [] },
  { url: 'https://huggingface.co/blog/feed.xml', category: 'Open Source', source: 'Hugging Face Blog', maxItems: 15, fallbackUrls: [] },

  // --- Traditional Chinese (繁體中文) ---
  { url: 'https://www.hkepc.com/rss', category: 'Consumer Tech', source: 'HKEPC Hardware', language: 'zh-HK', maxItems: 15, fallbackUrls: [] },
  { url: 'https://unwire.hk/feed/', category: 'Startups', source: 'Unwire HK', language: 'zh-HK', maxItems: 15, fallbackUrls: [] },
  { url: 'https://technews.tw/feed/', category: 'AI', source: 'TechNews 科技新報', language: 'zh-TW', maxItems: 15, fallbackUrls: [] },
];

export const RSS_FEEDS = DEFAULT_SOURCES;

// Get dynamic feeds from user-configurable store (server-safe)
const FEEDS_KEY = 'technews-feeds';

function loadUserFeeds() {
  try {
    // globalThis.localStorage works on client, is undefined on server (no error)
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(FEEDS_KEY) : null;
    if (!stored) return DEFAULT_SOURCES;
    
    const data = JSON.parse(stored);
    if (!data.sources || !Array.isArray(data.sources)) return DEFAULT_SOURCES;
    
    // Map StoredFeed to NewsSource format with fallback URLs and language from defaults
    const sourceMap = new Map(DEFAULT_SOURCES.map(s => [s.source, s]));
    return (
      data.sources
        .filter((f: any) => f.enabled !== false)
        .map(({ url, category, source, maxItems, language }) => ({
          url,
          category,
          source,
          language: language || sourceMap.get(source)?.language,
          maxItems: maxItems || 15,
          fallbackUrls: sourceMap.get(source)?.fallbackUrls || [],
        }))
    );
  } catch {
    return DEFAULT_SOURCES;
  }
}

export function getDynamicFeeds(): NewsSource[] {
  return loadUserFeeds();
}

export const CATEGORY_MAP = [
  'All',
  'Startups',
  'Consumer Tech',
  'AI',
  'Innovation',
  'Open Source',
] as const;

export type Category = (typeof CATEGORY_MAP)[number];
