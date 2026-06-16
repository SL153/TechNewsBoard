import type { ParsedNewsItem } from './rss-parser';

const GITHUB_TRENDING_URL = 'https://github.com/trending/typescript?since=daily';
const GH_TIMEOUT = 15000;
const MAX_ITEMS = 20;
// Fallback: GitHub API for repos with high stars in TypeScript (used when HTML scraping fails)
const GITHUB_API_SEARCH_URL = 'https://api.github.com/search/repositories';

function truncate(str: string, len: number): string {
  if (!str || str.length <= len) return str;
  return str.slice(0, len) + '...';
}

const LANGUAGE_GRADIENTS: Record<string, string> = {
  TypeScript: 'from-blue-600 to-indigo-700',
  JavaScript: 'from-yellow-400 to-orange-500',
  Python: 'from-green-500 to-teal-600',
  Rust: 'from-red-600 to-orange-700',
  Go: 'from-cyan-500 to-blue-600',
  Java: 'from-purple-500 to-pink-600',
  C: 'from-gray-600 to-gray-800',
  'C++': 'from-gray-700 to-slate-800',
  HTML: 'from-orange-400 to-red-500',
  CSS: 'from-blue-400 to-purple-500',
  Shell: 'from-green-600 to-emerald-700',
  Vue: 'from-lime-500 to-green-600',
  Svelte: 'from-red-500 to-orange-600',
  Dart: 'from-cyan-400 to-blue-500',
};

function getLanguageGradient(lang: string | null): string {
  if (!lang) return 'from-slate-500 to-gray-700';
  const normalized = lang.trim();
  for (const [key, gradient] of Object.entries(LANGUAGE_GRADIENTS)) {
    if (normalized.toLowerCase().includes(key.toLowerCase())) return gradient;
  }
  return 'from-slate-500 to-gray-700';
}

function extractLanguage(html: string): string | null {
  const match = html.match(/<span[^>]*class="[^"]*language[^"]*"[^>]*>([\s\S]*?)<\/span>/);
  if (match) return match[1].trim();
  const fallbackMatch = html.match(/<span[^>]*class="[^"]*stretched-card[^"]*"[^>]*>[\s\S]*?<a[^>]*>[^<]+<\/a>[\s\S]*?<span[^>]*>([\w\s]+)/);
  if (fallbackMatch) return fallbackMatch[1].trim();
  const simpleMatch = html.match(/([\w\s]+)\s*$/m);
  if (simpleMatch) {
    const potentialLang = simpleMatch[1].trim();
    for (const key of Object.keys(LANGUAGE_GRADIENTS)) {
      if (potentialLang.toLowerCase().includes(key.toLowerCase())) return potentialLang;
    }
  }
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

// Fallback: fetch top TypeScript repos via GitHub API when HTML scraping fails
async function fetchGitHubApiFallback(): Promise<ParsedNewsItem[]> {
  const results: ParsedNewsItem[] = [];
  try {
    // GitHub API has rate limits; use a generous timeout
    const res = await fetchWithTimeout(
      `${GITHUB_API_SEARCH_URL}?q=language:typescript&sort=stars&order=desc&per_page=${MAX_ITEMS}`,
      GH_TIMEOUT,
    );
    if (!res.ok) return []; // API rate-limited or unavailable — silently degrade

    const data = await res.json();
    if (!data.items || !Array.isArray(data.items)) return [];

    for (const repo of data.items.slice(0, MAX_ITEMS)) {
      results.push({
        title: `${repo.owner.login}/${repo.name}`,
        link: repo.html_url,
        description: truncate(repo.description || `Stars: ${repo.stargazers_count.toLocaleString()}`, 200),
        image: null,
        language: repo.language,
        gradientClass: getLanguageGradient(repo.language),
        pubDate: new Date().toISOString(),
        category: 'Open Source',
        source: 'GitHub Trending (API fallback)',
      });
    }
  } catch {
    // API unavailable — return empty, caller will have no results
  }
  return results;
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

      const lang = extractLanguage(articleHtml);
      const gradient = getLanguageGradient(lang);

      results.push({
        title: repoName,
        link: fullLink,
        description: truncate(finalDesc, 200),
        image: null,
        language: lang,
        gradientClass: gradient,
        pubDate: new Date().toISOString(),
        category: 'Open Source',
        source: 'GitHub Trending',
      });

      count++;
    }
  } catch (err) {
    console.error('Failed to scrape GitHub Trending HTML:', err.message);
  }

  // If scraping returned nothing, fall back to GitHub API search
  if (results.length === 0) {
    const fallbackResults = await fetchGitHubApiFallback();
    if (fallbackResults.length > 0) {
      console.log('Using GitHub API fallback for trending repos');
      return fallbackResults;
    }
  }

  return results;
}
