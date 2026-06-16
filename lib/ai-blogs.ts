import type { ParsedNewsItem } from './rss-parser';

const ANTHROPIC_URL = 'https://www.anthropic.com/research';
const KIMI_URL = 'https://www.kimi.com/blog';
const GH_TIMEOUT = 15000;
const MAX_ITEMS = 20;

function truncate(str: string, len: number): string {
  if (!str || str.length <= len) return str;
  return str.slice(0, len) + '...';
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

export async function fetchAnthropicResearch(): Promise<ParsedNewsItem[]> {
  const results: ParsedNewsItem[] = [];

  try {
    const res = await fetchWithTimeout(ANTHROPIC_URL, GH_TIMEOUT);
    if (!res.ok) throw new Error(`Anthropic Research returned ${res.status}`);
    const html = await res.text();

    // Pattern 1: FeaturedGrid featured item (main hero article)
    const featuredRegex = /<a[^>]*href="([^"]+)"[^>]*class="FeaturedGrid-module-scss-module__W1FydW__content"[^>]*>([\s\S]*?)<\/a>/g;
    let match;

    while ((match = featuredRegex.exec(html)) !== null && results.length < MAX_ITEMS) {
      const href = match[1];
      const contentHtml = match[2];

      // Extract title from h2 headline-4
      const titleMatch = contentHtml.match(/<h2[^>]*class="headline-4"[^>]*>([\s\S]*?)<\/h2>/);
      if (!titleMatch) continue;
      const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();

      // Extract date from time element
      const dateMatch = contentHtml.match(/<time[^>]*class="FeaturedGrid-module-scss-module__W1FydW__date"[^>]*>([\s\S]*?)<\/time>/);
      let pubDate: string | null = null;
      if (dateMatch) {
        const dateStr = dateMatch[1].trim();
        try {
          pubDate = new Date(dateStr).toISOString();
        } catch {
          pubDate = null;
        }
      }

      // Extract body text for description
      const bodyMatch = contentHtml.match(/<p[^>]*class="body-3 serif FeaturedGrid-module-scss-module__W1FydW__body"[^>]*>([\s\S]*?)<\/p>/);
      let description: string | null = null;
      if (bodyMatch) {
        description = bodyMatch[1].replace(/<[^>]+>/g, '').trim();
      }

      // Extract cover image from figure/mediaWrapper/img block
      const imgMatch = contentHtml.match(/<img[^>]*src="([^"]+)"/);
      let image: string | null = null;
      if (imgMatch) {
        image = imgMatch[1];
      }

      // Extract research team tag from caption bold span above title
      const teamMatch = contentHtml.match(/<span[^>]*class="caption bold"[^>]*>([\s\S]*?)<\/span>/);
      let tags: string[] | undefined;
      if (teamMatch) {
        const teamName = teamMatch[1].replace(/<[^>]+>/g, '').trim();
        if (teamName) {
          tags = [teamName];
        }
      }

      results.push({
        title,
        link: `https://www.anthropic.com${href}`,
        description: truncate(description || '', 200),
        image,
        pubDate,
        category: 'AI Blogs',
        source: 'Anthropic Blog',
        tags,
      });
    }

    // Pattern 2: FeaturedGrid side items (secondary articles)
    const sideRegex = /<a[^>]*href="([^"]+)"[^>]*class="FeaturedGrid-module-scss-module__W1FydW__sideLink"[^>]*>([\s\S]*?)<\/a>/g;

    while ((match = sideRegex.exec(html)) !== null && results.length < MAX_ITEMS) {
      const href = match[1];
      const contentHtml = match[2];

      // Extract title from h4 headline-6
      const titleMatch = contentHtml.match(/<h4[^>]*class="headline-6"[^>]*>([\s\S]*?)<\/h4>/);
      if (!titleMatch) continue;
      const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();

      // Extract date from time element
      const dateMatch = contentHtml.match(/<time[^>]*class="FeaturedGrid-module-scss-module__W1FydW__date"[^>]*>([\s\S]*?)<\/time>/);
      let pubDate: string | null = null;
      if (dateMatch) {
        const dateStr = dateMatch[1].trim();
        try {
          pubDate = new Date(dateStr).toISOString();
        } catch {
          pubDate = null;
        }
      }

      // Extract body text for description
      const bodyMatch = contentHtml.match(/<p[^>]*class="body-3 serif FeaturedGrid-module-scss-module__W1FydW__body"[^>]*>([\s\S]*?)<\/p>/);
      let description: string | null = null;
      if (bodyMatch) {
        description = bodyMatch[1].replace(/<[^>]+>/g, '').trim();
      }

      // Extract cover image from figure/mediaWrapper/img block
      const imgMatch = contentHtml.match(/<img[^>]*src="([^"]+)"/);
      let image: string | null = null;
      if (imgMatch) {
        image = imgMatch[1];
      }

      // Extract research team tag from caption bold span above title
      const teamMatch = contentHtml.match(/<span[^>]*class="caption bold"[^>]*>([\s\S]*?)<\/span>/);
      let tags: string[] | undefined;
      if (teamMatch) {
        const teamName = teamMatch[1].replace(/<[^>]+>/g, '').trim();
        if (teamName) {
          tags = [teamName];
        }
      }

      results.push({
        title,
        link: `https://www.anthropic.com${href}`,
        description: truncate(description || '', 200),
        image,
        pubDate,
        category: 'AI Blogs',
        source: 'Anthropic Blog',
        tags,
      });
    }

  } catch (err) {
    console.error('Failed to fetch Anthropic Research:', err.message);
  }

  return results;
}

export async function fetchKimiBlog(): Promise<ParsedNewsItem[]> {
  const results: ParsedNewsItem[] = [];

  try {
    const res = await fetchWithTimeout(KIMI_URL, GH_TIMEOUT);
    if (!res.ok) throw new Error(`Kimi Blog returned ${res.status}`);
    const html = await res.text();

    // Parse menu-card items from Kimi/Moonshot VitePress blog HTML
    const cardRegex = /<a[^>]*href="([^"]+)"[^>]*class="menu-card"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    let count = 0;

    while ((match = cardRegex.exec(html)) !== null && count < MAX_ITEMS) {
      const href = match[1];
      const cardHtml = match[2];

      // Extract title from h4 element
      const titleMatch = cardHtml.match(/<h4[^>]*class="card-title"[^>]*>([\s\S]*?)<\/h4>/);
      if (!titleMatch) continue;

      const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();

      // Extract description from p.card-desc element (may be empty/<!---->)
      const descMatch = cardHtml.match(/<p[^>]*class="card-desc"[^>]*>([\s\S]*?)<\/p>/);
      let description: string | null = null;
      if (descMatch) {
        const rawDesc = descMatch[1].replace(/<[^>]+>/g, '').trim();
        if (rawDesc && rawDesc !== '') {
          description = rawDesc;
        }
      }

      // Extract date from p.card-date element
      const dateMatch = cardHtml.match(/<p[^>]*class="card-date"[^>]*>([\s\S]*?)<\/p>/);
      let pubDate: string | null = null;
      if (dateMatch) {
        const dateStr = dateMatch[1].trim();
        // Parse "2026/04/20" format
        try {
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            pubDate = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`).toISOString();
          }
        } catch {
          pubDate = null;
        }
      }

      // Extract cover image from card-media/img block
      const imgMatch = cardHtml.match(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]+)"/);
      let image: string | null = null;
      if (imgMatch) {
        image = imgMatch[2];
      }

      results.push({
        title,
        link: `https://www.kimi.com${href}`,
        description: truncate(description || '', 200),
        image,
        pubDate,
        category: 'AI Blogs',
        source: 'Kimi/Moonshot Blog',
      });

      count++;
    }
  } catch (err) {
    console.error('Failed to fetch Kimi Blog:', err.message);
  }

  return results;
}
