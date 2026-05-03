import type { ParsedNewsItem } from './rss-parser';

const HN_API_BASE = 'https://hacker-news.firebaseio.com/v0';
const MAX_STORIES = 15;
const HN_TIMEOUT = 15000;

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

export async function fetchHackerNews(): Promise<ParsedNewsItem[]> {
  const results: ParsedNewsItem[] = [];

  try {
    const topRes = await fetchWithTimeout(`${HN_API_BASE}/topstories.json`, HN_TIMEOUT);
    if (!topRes.ok) throw new Error(`Hacker News API returned ${topRes.status}`);
    const topIds: number[] = await topRes.json();

    const storyPromises = topIds.slice(0, MAX_STORIES).map(id =>
      fetchWithTimeout(`${HN_API_BASE}/item/${id}.json`, HN_TIMEOUT).then(r => r.json())
    );
    const stories = await Promise.all(storyPromises);

    for (const story of stories) {
      if (story && story.title && story.url) {
        results.push({
          title: story.title,
          link: story.url,
          description: truncate((story.desc as string) || '', 200),
          image: null,
          pubDate: new Date(story.time * 1000).toISOString(),
          category: 'Innovation',
          source: 'Hacker News',
        });
      }
    }
  } catch (err) {
    console.error('Failed to fetch Hacker News:', err.message);
  }

  return results;
}
