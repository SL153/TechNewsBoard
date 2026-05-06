import { fetchFeedWithFallback } from '@/lib/rss-parser';
import { RSS_FEEDS } from '@/lib/news-sources';
import { fetchHackerNews } from '@/lib/hacker-news';
import { fetchGitHubTrending } from '@/lib/github-trending';

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

  const [rssItems, hnItems, ghItems] = await Promise.all([
    Promise.all(feeds.map(f => fetchFeedWithFallback(f))).then(results => results.flat()),
    fetchHackerNews(),
    fetchGitHubTrending(),
  ]);

  let allItems = [...rssItems, ...hnItems, ...ghItems];

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

  return Response.json(allItems);
}
