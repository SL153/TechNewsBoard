import type { ParsedNewsItem } from './rss-parser';

const GITHUB_TRENDING_URL = 'https://github.com/trending/typescript?since=daily';
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

export async function fetchGitHubTrending(): Promise<ParsedNewsItem[]> {
  const results: ParsedNewsItem[] = [];

  try {
    const res = await fetchWithTimeout(GITHUB_TRENDING_URL, GH_TIMEOUT);
    if (!res.ok) throw new Error(`GitHub Trending returned ${res.status}`);
    const html = await res.text();

    // Parse article rows from GitHub Trending HTML
    const rowRegex = /<article[^>]*>([\s\S]*?)<\/article>/g;
    let match;
    let count = 0;

    while ((match = rowRegex.exec(html)) !== null && count < MAX_ITEMS) {
      const articleHtml = match[1];

      // Extract repo name (e.g., "user/repo")
      const repoMatch = articleHtml.match(/<h2[^>]*>\s*<a[^>]*href="\/([^"]+)"[^>]*>/);
      if (!repoMatch) continue;

      const repoName = repoMatch[1];
      const fullLink = `https://github.com/${repoName}`;

      // Extract description
      const descMatch = articleHtml.match(/<p[^>]*class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/);
      const description = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : null;

      // Extract stars from span text
      const starsMatch = articleHtml.match(/<span[^>]*class="[^"]*d-inline-block[^"]*col-10[^"]*"[^>]*>([\s\S]*?)<\/span>/);
      let starInfo: string | null = null;
      if (starsMatch) {
        const starsText = starsMatch[1].replace(/<[^>]+>/g, '').trim();
        if (starsText) starInfo = `Stars: ${starsText}`;
      }

      // Build description with star info
      let finalDesc = '';
      if (description && starInfo) {
        finalDesc = `${description} (${starInfo})`;
      } else if (description) {
        finalDesc = description;
      } else if (starInfo) {
        finalDesc = starInfo;
      }

      results.push({
        title: repoName,
        link: fullLink,
        description: truncate(finalDesc, 200),
        image: null,
        pubDate: new Date().toISOString(),
        category: 'Innovation',
        source: 'GitHub Trending',
      });

      count++;
    }
  } catch (err) {
    console.error('Failed to fetch GitHub Trending:', err.message);
  }

  return results;
}
