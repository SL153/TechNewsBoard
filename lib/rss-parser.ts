import RSSParser from 'rss-parser';
import type { NewsSource } from './news-sources';

const DEFAULT_TIMEOUT = 10000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

export interface ParsedNewsItem {
  title: string;
  link: string;
  description: string | null;
  image: string | null;
  pubDate: string | null;
  category: string;
  source: string;
}

function truncate(str: string, len: number): string {
  if (!str || str.length <= len) return str;
  return str.slice(0, len) + '...';
}

function extractImage(html: string | null | undefined): string | null {
  if (!html) return null;
  const match = html.match(/<img[^>]+src="([^"]+)"/);
  return match ? match[1] : null;
}

async function fetchWithRetry(url: string, parser: RSSParser, maxRetries: number = MAX_RETRIES): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await parser.parseURL(url);
      return result;
    } catch (err) {
      lastError = err as Error;
      console.warn(`Attempt ${attempt + 1}/${maxRetries + 1} failed for ${url}:`, err.message);

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError!;
}

export async function fetchFeedWithFallback(feed: NewsSource): Promise<ParsedNewsItem[]> {
  const parser = new RSSParser({ timeout: feed.timeout || DEFAULT_TIMEOUT });
  const maxItems = feed.maxItems || 15;
  const results: ParsedNewsItem[] = [];

  // Try primary URL first
  try {
    const feedResult = await fetchWithRetry(feed.url, parser);
    const items = (feedResult.items || []).slice(0, maxItems).map((item: any) => ({
      title: item.title || '',
      link: item.link || item.guid || '',
      description: truncate(item.contentSnippet || item.content || '', 200),
      image: extractImage(item.contentSnippet || item.content || null),
      pubDate: item.pubDate || null,
      category: feed.category,
      source: feed.source,
    }));
    results.push(...items);
    return results;
  } catch (err) {
    console.error(`Primary URL failed for ${feed.source}:`, err.message);
  }

  // Try fallback URLs if available
  if (feed.fallbackUrls && feed.fallbackUrls.length > 0) {
    for (const fallbackUrl of feed.fallbackUrls) {
      try {
        console.log(`Trying fallback URL for ${feed.source}: ${fallbackUrl}`);
        const feedResult = await fetchWithRetry(fallbackUrl, parser);
        const items = (feedResult.items || []).slice(0, maxItems).map((item: any) => ({
          title: item.title || '',
          link: item.link || item.guid || '',
          description: truncate(item.contentSnippet || item.content || '', 200),
          pubDate: item.pubDate || null,
          category: feed.category,
          source: feed.source,
        }));
        results.push(...items);
        if (results.length > 0) break;
      } catch (err) {
        console.error(`Fallback URL failed for ${feed.source} (${fallbackUrl}):`, err.message);
      }
    }
  }

  return results;
}
