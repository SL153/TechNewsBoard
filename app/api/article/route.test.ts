import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __setClientForTesting, __resetForTesting } from '@/lib/cache';

// A realistic-ish article HTML that Readability can extract.
const SAMPLE_HTML = `<!DOCTYPE html><html><head>
<title>How AI Is Reshaping Startups — Test News</title>
<meta property="og:image" content="https://example.com/cover.jpg">
</head><body>
<header><nav>Menu links that should be ignored</nav></header>
<main>
<article>
<h1>How AI Is Reshaping Startups</h1>
<p>By Jane Reporter</p>
<p>The pace of change in artificial intelligence has accelerated dramatically over the past year, and startups are feeling both the pressure and the opportunity. Founders interviewed for this story described a landscape where shipping speed matters more than ever.</p>
<p>Investors echo that view, noting that rounds are closing faster and at higher valuations for companies that can demonstrate a defensible AI wedge. "The bar has gone up," one partner said.</p>
<p>Still, not everyone is convinced the boom will last. Some veteran operators warn of fatigue and urge caution against building features that large model providers could absorb overnight.</p>
</article>
</main>
<footer>Copyright Test News. All rights reserved.</footer>
</body></html>`;

/** In-memory Redis double injected via cache test helper (keeps tests hermetic). */
function fakeRedis() {
  const store = new Map();
  return {
    store,
    async get(k: string) { return store.has(k) ? store.get(k)! : null; },
    async set(k: string, v: string) { store.set(k, v); },
    async del(k: string) { store.delete(k); },
    on() { return this; },
  };
}

beforeEach(() => {
  __setClientForTesting(fakeRedis());
  vi.stubGlobal('fetch', vi.fn());
});

describe('GET /api/article', () => {
  it('extracts the title and sanitized readable content', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      text: () => Promise.resolve(SAMPLE_HTML),
    } as Response);

    const { GET } = await import('./route');
    const res = await GET(new Request('http://localhost/api/article?url=https://example.com/news/ai-startups'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.error).toBeUndefined();
    expect(body.title).toMatch(/AI Is Reshaping Startups/);
    expect(body.html).toMatch(/accelerated dramatically/);
    // Footer/navigation noise should not be present in the extracted content.
    expect(body.html).not.toMatch(/Copyright Test News/);
    expect(body.leadImage).toBe('https://example.com/cover.jpg');
  });

  it('returns a 400 when url is missing', async () => {
    const { GET } = await import('./route');
    const res = await GET(new Request('http://localhost/api/article'));
    expect(res.status).toBe(400);
  });

  it('returns an error body (HTTP 200) for non-HTML content', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/pdf' }),
      text: () => Promise.resolve(''),
    } as Response);

    const { GET } = await import('./route');
    const res = await GET(new Request('http://localhost/api/article?url=https://example.com/doc.pdf'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.error).toBeDefined();
    expect(body.html).toBe('');
  });

  it('caches a successful extraction (second call is a HIT)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      text: () => Promise.resolve(SAMPLE_HTML),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('./route');
    const url = 'https://example.com/cached-article';
    await GET(new Request(`http://localhost/api/article?url=${url}`));
    await GET(new Request(`http://localhost/api/article?url=${url}`));

    // Upstream should only have been hit once thanks to the Redis cache.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
