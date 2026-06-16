import type { ParsedNewsItem } from './rss-parser';

const FIRECRAWL_BASE = 'http://localhost:5002/v1';
const FC_TIMEOUT = 20000;
const MAX_ITEMS_PER_URL = 10;

const CATEGORY_GRADIENTS: Record<string, string> = {
  'AI Blogs': 'from-violet-500 to-purple-600',
  'AI': 'from-cyan-500 to-blue-600',
  'Open Source': 'from-emerald-500 to-teal-600',
  'Startups': 'from-amber-500 to-orange-600',
  'Consumer Tech': 'from-pink-500 to-rose-600',
  'Innovation': 'from-indigo-500 to-blue-600',
};

export interface FirecrawlSource {
  url: string;
  category: string;
  source: string;
  maxItems?: number;
  /** Regex pattern to filter article links from the page */
  linkPattern?: RegExp;
}

// AI blogs that work well with Firecrawl scraping (tested and verified)
const DEFAULT_SOURCES: FirecrawlSource[] = [
  { url: 'https://www.anthropic.com/news', category: 'AI Blogs', source: 'Anthropic News', maxItems: 10, linkPattern: /\/news\// },
  { url: 'https://openai.com/blog', category: 'AI Blogs', source: 'OpenAI Blog', maxItems: 10, linkPattern: /openai\.com\/blog/ },
  { url: 'https://deepmind.google/blog/', category: 'AI Blogs', source: 'DeepMind Blog', maxItems: 10, linkPattern: /deepmind\.google\/blog\// },
  { url: 'https://ai.meta.com/blog/', category: 'AI Blogs', source: 'Meta AI Blog', maxItems: 8, linkPattern: /ai\.meta\.com\/blog\// },
  { url: 'https://huggingface.co/blog', category: 'Open Source', source: 'Hugging Face Blog', maxItems: 10, linkPattern: /huggingface\.co\/blog\// },
  { url: 'https://blogs.nvidia.com/blog/category/deep-learning/', category: 'AI Blogs', source: 'NVIDIA Deep Learning', maxItems: 8, linkPattern: /blogs\.nvidia\.com\/blog\// },
  { url: 'https://scale.com/blog', category: 'AI', source: 'Scale AI Blog', maxItems: 8, linkPattern: /scale\.com\/blog/ },
  { url: 'https://x.ai/news', category: 'AI Blogs', source: 'xAI News', maxItems: 10, linkPattern: /x\.ai\/news/ },
];

function truncate(str: string, len: number): string {
  if (!str || str.length <= len) return str;
  return str.slice(0, len) + '...';
}

async function fetchWithTimeout(url: string, timeoutMs: number, body?: Record<string, unknown>): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extract link text from markdown: [text](url) -> { url, text }
 */
function extractMarkdownLinks(markdown: string): Array<{ url: string; text: string }> {
  const results: Array<{ url: string; text: string }> = [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    results.push({ url: match[2].trim(), text: match[1].trim() });
  }
  return results;
}

/**
 * Scrape an individual article page to extract its publication date.
 * Tries multiple strategies: og:date, article:published_time, lastModified, <time> element.
 */
async function extractArticleDate(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`${FIRECRAWL_BASE}/scrape`, FC_TIMEOUT, {
      url,
      formats: ['html'],
      onlyMainContent: false,
    });

    if (!res.ok) return null;
    const data = await res.json();

    if (!data.success || !data.data) return null;

    // Strategy 1: Check metadata fields (og:date, lastModified, etc.)
    const meta = data.data.metadata || {};
    const dateFields = [
      'ogDate',
      'og:date',
      'article:published_time',
      'date',
      'lastModified',
      'originalSource',
    ];
    for (const field of dateFields) {
      if (meta[field]) {
        const d = new Date(meta[field]);
        if (!isNaN(d.getTime())) return d.toISOString();
      }
    }

    // Strategy 2: Parse HTML for <time> element with datetime attribute
    const html = data.data.html || '';
    const timeMatch = html.match(/<time[^>]*datetime=["']([^"']+)["'][^>]*>/i);
    if (timeMatch) {
      const d = new Date(timeMatch[1]);
      if (!isNaN(d.getTime())) return d.toISOString();
    }

    // Strategy 3: Parse HTML for og:date meta tag
    const ogDateMatch = html.match(/<meta[^>]*property=["']og:date["'][^>]*content=["']([^"']+)["']/i);
    if (ogDateMatch) {
      const d = new Date(ogDateMatch[1]);
      if (!isNaN(d.getTime())) return d.toISOString();
    }

    // Strategy 4: Parse HTML for article:published_time meta tag
    const pubTimeMatch = html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i);
    if (pubTimeMatch) {
      const d = new Date(pubTimeMatch[1]);
      if (!isNaN(d.getTime())) return d.toISOString();
    }

    // Strategy 5: Parse HTML for <meta name="date">
    const dateMetaMatch = html.match(/<meta[^>]*name=["']date["'][^>]*content=["']([^"']+)["']/i);
    if (dateMetaMatch) {
      const d = new Date(dateMetaMatch[1]);
      if (!isNaN(d.getTime())) return d.toISOString();
    }

  } catch {
    // Silently fail — we'll fall back to null
  }

  return null;
}

/**
 * Scrape a single URL with Firecrawl and extract articles.
 */
async function scrapeUrl(source: FirecrawlSource): Promise<ParsedNewsItem[]> {
  const results: ParsedNewsItem[] = [];
  const maxItems = source.maxItems ?? MAX_ITEMS_PER_URL;

  try {
    const res = await fetchWithTimeout(`${FIRECRAWL_BASE}/scrape`, FC_TIMEOUT, {
      url: source.url,
      formats: ['markdown', 'links'],
      onlyMainContent: true,
    });

    if (!res.ok) throw new Error(`Firecrawl scrape returned ${res.status}`);
    const data = await res.json();

    if (!data.success || !data.data) {
      console.warn(`Firecrawl scrape failed for ${source.url}: response not successful`);
      return results;
    }

    const markdown = data.data.markdown || '';
    const pageLinks: string[] = data.data.links || [];
    const metadata = data.data.metadata || {};

    // Build a map of url -> link text from markdown for better titles
    const mdLinks = extractMarkdownLinks(markdown);
    const linkTextMap = new Map<string, string>();
    for (const { url, text } of mdLinks) {
      if (!linkTextMap.has(url)) {
        linkTextMap.set(url, text);
      }
    }

    // Filter article links using the source's linkPattern
    const navigationTexts = new Set([
      'skip to content', 'skip to main content', 'home', 'menu', 'search', 'sign in', 'log in', 'subscribe',
      'contact', 'about', 'privacy', 'terms', 'support', 'help', 'careers', 'back to top',
    ]);
    const articleLinks = pageLinks.filter(link => {
      if (!link.includes('http')) return false;
      // Skip non-article URLs
      if (/\/(twitter|facebook|instagram|linkedin|github)\//.test(link)) return false;
      if (/(\.(png|jpg|jpeg|gif|svg|css|js|ico))/i.test(link)) return false;
      if (link.startsWith('mailto:')) return false;
      // Apply source-specific pattern
      if (source.linkPattern && !source.linkPattern.test(link)) return false;
      // Skip the base URL itself
      if (link === source.url || link === source.url + '/') return false;
      // Skip navigation links by checking link text
      const linkText = linkTextMap.get(link)?.toLowerCase() || '';
      if (navigationTexts.has(linkText)) return false;
      return true;
    });

    for (const link of articleLinks.slice(0, maxItems)) {
      // Get title: prefer markdown link text, then extract from URL path
      let title = linkTextMap.get(link) || '';

      if (!title || title.length < 3) {
        // Extract meaningful part from URL path
        const pathMatch = link.match(/\/([^/?#]+)$/);
        if (pathMatch) {
          title = pathMatch[1]
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase())
            .trim();
        }
      }

      // Strip markdown formatting prefix (####, ##, *, -, >, etc.)
      title = title.replace(/^(#{1,6}\s*|\*+\s*|-+\s*|>\s*)+/, '').trim();
      // Remove trailing markdown formatting
      title = title.replace(/\s*#{1,6}\s*$/, '').trim();
      // Remove inline markdown markers (**bold**, *italic*, `code`)
      title = title.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/`(.*?)`/g, '$1').trim();
      // Remove markdown horizontal rules (---, ***, ___) anywhere in text
      title = title.replace(/\s?-{3,}\s?/g, ' ').replace(/\s?\*{3,}\s?/g, ' ').replace(/\s?_{3,}\s?/g, ' ').trim();
      // Remove markdown escape backslashes
      title = title.replace(/\\([\\_`*\[\]()~])/g, '$1').trim();
      // Remove markdown soft breaks (\-)
      title = title.replace(/\\-?\s*/g, ' ').trim();
      // Collapse multiple spaces
      title = title.replace(/\s+/g, ' ').trim();
      // Insert space before month names abbreviated or full that are directly attached to preceding words
      title = title.replace(/([a-z])(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/gi, '$1 $2');
      // Remove category labels followed by dates (e.g., "Product Apr 16, 2026", "Research May 2026")
      title = title.replace(/\b(Product|Research|News|Blog|Press|Update|Announcement)\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s*\.?\s*\d{4}\s*/gi, '').trim();
      // Clean up date suffixes: "May 14, 2026", "16 Apr 2026", etc. (full and abbreviated months)
      title = title.replace(/\s*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s*\.?\s*\d{4}\s*/gi, '').trim();
      title = title.replace(/\s*\d{1,2}(st|nd|rd|th)?\s*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*\d{4}\s*/gi, '').trim();
      // Clean up standalone "Month Year" patterns (e.g., "April 2026", "Apr 2026")
      title = title.replace(/\s*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}\s*/gi, '').trim();
      // Final cleanup: collapse any double spaces from removals above
      title = title.replace(/\s{2,}/g, ' ').trim();

      if (!title || title.length < 5) continue;
      // Skip single-word titles (likely navigation)
      if (title.split(' ').length < 2) continue;
      // Skip navigation-like titles
      const lowerTitle = title.toLowerCase();
      if (/^(skip to|read more|learn more|back to|home|menu|search|sign\s|log\s|subscribe|contact|about us|privacy|terms|support|help|careers)/.test(lowerTitle)) continue;

      // Extract actual publication date from the article page
      const pubDate = await extractArticleDate(link);

      results.push({
          title: truncate(title, 100),
          link,
          description: null,
          image: null,
          pubDate,
          category: source.category,
          source: source.source,
          gradientClass: CATEGORY_GRADIENTS[source.category] || 'from-gray-400 to-gray-500',
        });
    }
  } catch (err) {
    console.error(`Firecrawl scrape failed for ${source.url}:`, typeof err === 'object' && err instanceof Error ? err.message : String(err));
  }

  return results;
}

/**
 * Search for recent content using Firecrawl search endpoint.
 */
export async function firecrawlSearch(query: string, category: string, maxItems: number = 10): Promise<ParsedNewsItem[]> {
  const results: ParsedNewsItem[] = [];

  try {
    const res = await fetchWithTimeout(`${FIRECRAWL_BASE}/search`, FC_TIMEOUT, {
      query,
      limit: maxItems,
    });

    if (!res.ok) throw new Error(`Firecrawl search returned ${res.status}`);
    const data = await res.json();

    if (!data.success || !Array.isArray(data.data)) return results;

    for (const item of data.data.slice(0, maxItems)) {
      const link = item.url || '';
      // Extract actual publication date from the article page
      const pubDate = await extractArticleDate(link);

      results.push({
        title: truncate(item.title || '', 100),
        link,
        description: truncate(item.description || '', 200),
        image: null,
        pubDate,
        category,
        source: 'Firecrawl Search',
      });
    }
  } catch (err) {
    console.error(`Firecrawl search failed for "${query}":`, typeof err === 'object' && err instanceof Error ? err.message : String(err));
  }

  return results;
}

/**
 * Main entry point — scrape all configured Firecrawl sources.
 */
export async function fetchFirecrawl(sources?: FirecrawlSource[]): Promise<ParsedNewsItem[]> {
  const toScrape = sources ?? DEFAULT_SOURCES;

  if (toScrape.length === 0) {
    console.log('No Firecrawl sources configured — skipping');
    return [];
  }

  console.log(`Firecrawl: scraping ${toScrape.length} sources`);
  const allResults = await Promise.all(toScrape.map(s => scrapeUrl(s)));
  const flat = allResults.flat();
  console.log(`Firecrawl: got ${flat.length} articles from ${toScrape.length} sources`);
  return flat;
}
