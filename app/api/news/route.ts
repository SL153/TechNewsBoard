import { fetchFeedWithFallback } from '@/lib/rss-parser';
import { RSS_FEEDS } from '@/lib/news-sources';
import { fetchHackerNews } from '@/lib/hacker-news';
import { fetchGitHubTrending } from '@/lib/github-trending';
import { withCache, type CacheStatus } from '@/lib/cache';

// Refresh cadence is enforced server-side via the Redis TTL. News sources share
// a standardized 15-min interval; GitHub Trending is a daily list, so it is
// cached much longer to avoid needlessly re-scraping. The frontend cannot force
// an upstream refresh — Redis (with SWR) is the sole authority.
const TTL_RSS_SEC = 900;     // 15 min
const TTL_HN_SEC = 900;      // 15 min
const TTL_GH_SEC = 7200;     // 2 hours (GitHub Trending updates daily)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Determine which feeds to fetch — client passes enabled source names
  let feeds = RSS_FEEDS;
  const feedsParam = searchParams.get('feeds');
  if (feedsParam) {
    try {
      const sourceNames: string[] = JSON.parse(feedsParam);
      if (Array.isArray(sourceNames) && sourceNames.length > 0) {
        feeds = RSS_FEEDS.filter(f => sourceNames.includes(f.source));
        // Fallback to all feeds if filter yields nothing (safety net)
        if (feeds.length === 0) feeds = RSS_FEEDS;
      }
    } catch {
      // Invalid JSON — use all default feeds
    }
  }

  const [rssResults, hnResult, ghResult] = await Promise.all([
    Promise.all(
      feeds.map(f =>
        withCache(`feed:${f.url}`, TTL_RSS_SEC, () => fetchFeedWithFallback(f)),
      ),
    ),
    withCache('hn:top', TTL_HN_SEC, fetchHackerNews),
    withCache('gh:trending:daily', TTL_GH_SEC, fetchGitHubTrending),
  ]);

  const rssItems = rssResults.map(r => r.data).flat();
  let allItems = [...rssItems, ...hnResult.data, ...ghResult.data];

  // Summarise cache state across all sources for the X-Cache header.
  const statuses: CacheStatus[] = [
    ...rssResults.map(r => r.status),
    hnResult.status,
    ghResult.status,
  ];
  const cacheStatus: CacheStatus = statuses.every(s => s === 'HIT')
    ? 'HIT'
    : statuses.some(s => s === 'MISS')
      ? 'MISS'
      : 'STALE';

  // Server-side time filtering (max 90 days)
  const daysParam = searchParams.get('days');
  if (daysParam) {
    const maxDays = parseInt(daysParam, 10);
    if (!isNaN(maxDays)) {
      const clampedDays = Math.min(maxDays, 90);
      const cutoff = Date.now() - clampedDays * 86400000;
      allItems = allItems.filter(item => {
        if (!item.pubDate) return true;
        const parsed = new Date(item.pubDate).getTime();
        if (isNaN(parsed)) return true; // keep items with unparseable dates
        return parsed >= cutoff;
      });
    }
  }

  // Server-side category filtering
  const categoriesParam = searchParams.getAll('category');
  if (categoriesParam.length > 0) {
    allItems = allItems.filter(item => categoriesParam.includes(item.category));
  }

  // Server-side search query filtering
  const qParam = searchParams.get('q');
  if (qParam) {
    const qLower = decodeURIComponent(qParam).toLowerCase();
    allItems = allItems.filter(item =>
      item.title.toLowerCase().includes(qLower) || 
      (item.description && item.description.toLowerCase().includes(qLower))
    );
  }

  // Server-side language filtering
  const langParam = searchParams.get('lang');
  if (langParam !== null) {
    if (langParam === '') {
      allItems = allItems.filter(item => !item.language || !item.language.startsWith('zh'));
    } else {
      allItems = allItems.filter(item => item.language && item.language.startsWith('zh'));
    }
  }

  return Response.json(allItems, {
    headers: {
      'X-Cache': cacheStatus,
      // Response varies by query params (category/lang/feeds/q/days) so only the
      // end-user's browser may cache it, briefly, to cut redundant calls.
      'Cache-Control': 'private, max-age=60',
    },
  });
}
