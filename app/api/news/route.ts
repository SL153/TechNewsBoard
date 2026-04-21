import { fetchFeedWithFallback } from '@/lib/rss-parser';
import { RSS_FEEDS } from '@/lib/news-sources';
import { fetchHackerNews } from '@/lib/hacker-news';
import { fetchGitHubTrending } from '@/lib/github-trending';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get('refresh') === 'true';

  if (refresh) {
    request.headers.set('Cache-Control', 'no-store');
  }

  const [rssItems, hnItems, ghItems] = await Promise.all([
    Promise.all(RSS_FEEDS.map(f => fetchFeedWithFallback(f))).then(results => results.flat()),
    fetchHackerNews(),
    fetchGitHubTrending(),
  ]);

  const allItems = [...rssItems, ...hnItems, ...ghItems];

  return Response.json(allItems);
}
