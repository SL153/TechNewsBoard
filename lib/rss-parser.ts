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
  language?: string | null;
  gradientClass?: string;
  tags?: string[];
}

function stripCDATA(str: string): string {
  if (!str) return str;
  return str.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');
}

function truncate(str: string, len: number): string {
  if (!str || str.length <= len) return str;
  return str.slice(0, len) + '...';
}

function normalizeImageUrl(url: string, link: string | null | undefined): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const articleLink = link || '';
  let domain: string | null = null;
  try {
    const urlObj = new URL(articleLink);
    domain = urlObj.hostname.replace(/^www\./, '');
  } catch {
    const match = articleLink.match(/:\/\/([^/]+)/);
    if (match) domain = match[1].replace(/^www\./, '');
  }
  if (domain) return `https://${domain}${url.startsWith('/') ? '' : '/'}${url}`;
  return url;
}

function extractImage(item: any): string | null {
  if (item.enclosure?.url) return normalizeImageUrl(item.enclosure.url, item.link);
  if (typeof item['media:thumbnail'] === 'string') return normalizeImageUrl(item['media:thumbnail'], item.link);
  if (item['media:thumbnail']?.url) return normalizeImageUrl(item['media:thumbnail'].url, item.link);
  if (typeof item.image === 'string') return normalizeImageUrl(item.image, item.link);
  const html = item.content || '';
  const match = html.match(/<img[^>]+src="([^"]+)"/);
  if (match) return normalizeImageUrl(match[1], item.link);
  let domain: string | null = null;
  try {
    const urlObj = new URL(item.link || '');
    domain = urlObj.hostname.replace(/^www\./, '');
  } catch {
    const match2 = (item.link || '').match(/:\/\/([^/]+)/);
    if (match2) domain = match2[1].replace(/^www\./, '');
  }
  if (domain) return `https://www.google.com/s2/favicons?sz=640&domain=${domain}`;
  return null;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function parseRSSXML(xmlText: string): Promise<any> {
  const items: any[] = [];

  // Extract channel-level language from RSS/Atom header
  const langMatch = xmlText.match(/<language>([\s\S]*?)<\/language>/);
  const dcLangMatch = xmlText.match(/xmlns:dc="[^"]*"[^>]*><language>([\s\S]*?)<\/language>/);

  // Try RSS 2.0 format first (<item> tags)
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemXml = match[1];

    const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
    const guidMatch = itemXml.match(/<guid>([\s\S]*?)<\/guid>/);
    const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/);
    const contentMatch = itemXml.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/);
    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const enclosureMatch = itemXml.match(/<enclosure url="([^"]+)"[^>]*type="([^"]*)"[^>]*\/?>/);

    const mediaThumbnailMatch = itemXml.match(/<media:thumbnail url="([^"]+)"/);
    const mediaContentMatches = [...itemXml.matchAll(/<media:content url="([^"]+)"/g)];

    items.push({
      title: stripCDATA(titleMatch?.[1]?.trim() || ''),
      link: stripCDATA(linkMatch?.[1]?.trim() || guidMatch?.[1]?.trim() || ''),
      guid: stripCDATA(guidMatch?.[1]?.trim() || ''),
      contentSnippet: stripCDATA(descMatch?.[1]?.trim() || ''),
      content: stripCDATA(contentMatch?.[1]?.trim() || descMatch?.[1]?.trim() || ''),
      pubDate: pubDateMatch?.[1]?.trim() || null,
      enclosure: enclosureMatch ? { url: enclosureMatch[1], type: enclosureMatch[2] } : null,
      'media:thumbnail': mediaThumbnailMatch?.[1] || null,
      'media:content': mediaContentMatches.length > 0 ? mediaContentMatches.map(m => ({ url: m[1] })) : null,
    });
  }

  // If no RSS items found, try Atom format (<entry> tags)
  if (items.length === 0) {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    while ((match = entryRegex.exec(xmlText)) !== null) {
      const entryXml = match[1];

      const titleMatch = entryXml.match(/<title[^>]*>([\s\S]*?)<\/title>/);
      // Atom uses <link rel="alternate" href="..."/> (self-closing) or <link href="..."/>
      const linkMatch = entryXml.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/);
      const linkFallback = entryXml.match(/<link[^>]*href="([^"]+)"/);
      const idMatch = entryXml.match(/<id>([\s\S]*?)<\/id>/);
      const summaryMatch = entryXml.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
      const contentMatch = entryXml.match(/<content[^>]*>([\s\S]*?)<\/content>/);
      const publishedMatch = entryXml.match(/<published>([\s\S]*?)<\/published>/);
      const updatedMatch = entryXml.match(/<updated>([\s\S]*?)<\/updated>/);

      const mediaThumbnailMatch = entryXml.match(/<media:thumbnail url="([^"]+)"/);

      items.push({
        title: stripCDATA(titleMatch?.[1]?.trim() || ''),
        link: stripCDATA(linkMatch?.[1]?.trim() || linkFallback?.[1]?.trim() || idMatch?.[1]?.trim() || ''),
        guid: stripCDATA(idMatch?.[1]?.trim() || ''),
        contentSnippet: stripCDATA(summaryMatch?.[1]?.trim() || ''),
        content: stripCDATA(contentMatch?.[1]?.trim() || summaryMatch?.[1]?.trim() || ''),
        pubDate: publishedMatch?.[1]?.trim() || updatedMatch?.[1]?.trim() || null,
        enclosure: null,
        'media:thumbnail': mediaThumbnailMatch?.[1] || null,
        'media:content': null,
      });
    }
  }

  return { items, language: langMatch ? stripCDATA(langMatch[1]) : undefined };
}

async function fetchRSSFeed(url: string, timeoutMs: number): Promise<any> {
  const response = await fetchWithTimeout(url, timeoutMs);
  if (!response.ok) throw new Error(`RSS feed returned ${response.status}`);
  const xmlText = await response.text();
  return parseRSSXML(xmlText);
}

async function fetchWithRetry(url: string, maxRetries: number = MAX_RETRIES): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fetchRSSFeed(url, DEFAULT_TIMEOUT);
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
  const maxItems = feed.maxItems || 15;
  const results: ParsedNewsItem[] = [];

  // Try primary URL first
  try {
    const feedResult = await fetchWithRetry(feed.url);
    const items = (feedResult.items || []).slice(0, maxItems).map((item: any) => ({
      title: item.title || '',
      link: item.link || item.guid || '',
      description: truncate(item.contentSnippet || item.content || '', 200),
      image: extractImage(item),
      pubDate: item.pubDate || null,
      category: feed.category,
      source: feed.source,
      language: feed.language || (feedResult.language ? stripCDATA(feedResult.language) : undefined),
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
        const feedResult = await fetchWithRetry(fallbackUrl);
        const items = (feedResult.items || []).slice(0, maxItems).map((item: any) => ({
          title: item.title || '',
          link: item.link || item.guid || '',
          description: truncate(item.contentSnippet || item.content || '', 200),
          image: extractImage(item),
          pubDate: item.pubDate || null,
          category: feed.category,
          source: feed.source,
          language: feed.language || (feedResult.language ? stripCDATA(feedResult.language) : undefined),
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
