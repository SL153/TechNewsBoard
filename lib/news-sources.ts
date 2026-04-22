export interface NewsSource {
  url: string;
  category: string;
  source: string;
  maxItems?: number;
  timeout?: number;
  fallbackUrls?: string[];
}

export const RSS_FEEDS: NewsSource[] = [
  { url: 'https://feeds.feedburner.com/TechCrunch/', category: 'Startups', source: 'TechCrunch', maxItems: 15, fallbackUrls: ['https://techcrunch.com/feed/'] },
  { url: 'https://www.theverge.com/rss/index.xml', category: 'Consumer Tech', source: 'The Verge', maxItems: 15, fallbackUrls: ['https://www.theverge.com/rss/rss-index.xml'] },
  { url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'Innovation', source: 'Ars Technica', maxItems: 15, fallbackUrls: ['https://arstechnica.com/feed/'] },
  { url: 'https://www.wired.com/feed/rss', category: 'Innovation', source: 'Wired', maxItems: 15, fallbackUrls: ['https://www.wired.com/feed/xml'] },
  { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', category: 'Consumer Tech', source: 'BBC Technology', maxItems: 15, fallbackUrls: [] },
  { url: 'https://www.reuters.com/newsfeeds/business/technology/?feedType=RSS&feedName=reutersWorldNews', category: 'Startups', source: 'Reuters Tech', maxItems: 15, fallbackUrls: ['https://api-rss.thomsonreuters.com/rss/Technology'] },
  { url: 'https://www.technologyreview.com/feed/', category: 'Innovation', source: 'MIT Technology Review', maxItems: 10, fallbackUrls: [] },
  { url: 'https://venturebeat.com/feed/', category: 'Startups', source: 'VentureBeat', maxItems: 15, fallbackUrls: [] },
  { url: 'https://www.fastcompany.com/feeds/technology.rss', category: 'Innovation', source: 'Fast Company', maxItems: 10, fallbackUrls: ['https://www.fastcompany.com/feed'] },
  { url: 'https://techcrunch.com/category/startups/feed/', category: 'Startups', source: 'The Information', maxItems: 8, fallbackUrls: ['https://techcrunch.com/feed/'] },
  { url: 'https://feeds.feedburner.com/TechCrunch/artificial-intelligence', category: 'AI', source: 'TechCrunch AI', maxItems: 15, fallbackUrls: ['https://techcrunch.com/category/artificial-intelligence/feed/'] },
  { url: 'https://news.google.com/rss/search?q=technology&hl=en-US&gl=US&ceid=US:en', category: 'Consumer Tech', source: 'Google News Tech', maxItems: 15, fallbackUrls: [] },
];

export const CATEGORY_MAP = [
  'All',
  'Startups',
  'Consumer Tech',
  'AI',
  'Innovation',
  'Open Source',
] as const;

export type Category = (typeof CATEGORY_MAP)[number];
