import { withCache } from '@/lib/cache';
import { extractArticle } from '@/lib/article';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TTL_SEC = 86400; // cache extracted articles for 24h

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get('url');

  if (!rawUrl) {
    return Response.json({ error: 'Missing "url" parameter.' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return Response.json({ error: 'Invalid URL.' }, { status: 400 });
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    return Response.json({ error: 'Only http/https URLs are supported.' }, { status: 400 });
  }

  // Cache successful extractions only (errors throw and are not cached).
  try {
    const { data } = await withCache(`article:${rawUrl}`, TTL_SEC, () => extractArticle(rawUrl));
    return Response.json({ ...data, url: rawUrl });
  } catch (err) {
    return Response.json(
      {
        error: (err as Error).message || 'Failed to extract article.',
        url: rawUrl,
        html: '',
        text: '',
        title: '',
        byline: null,
        excerpt: null,
        leadImage: null,
      },
      { status: 200 }, // 200 with an error body so the client can render the fallback UI
    );
  }
}
