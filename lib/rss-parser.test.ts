import { describe, it, expect, vi } from 'vitest';

describe('fetchFeedWithFallback', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalFetch) {
      vi.stubGlobal('fetch', originalFetch);
    }
  });

  it('returns items from primary URL on success', async () => {
    const mockXML = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item><title>Item 1</title><link>https://example.com/1</link><description>Description one</description></item>
    <item><title>Item 2</title><link>https://example.com/2</link><description>Description two</description></item>
  </channel>
</rss>`;

    vi.mocked(global.fetch).mockResolvedValue({ ok: true, text: () => Promise.resolve(mockXML) });

    const { fetchFeedWithFallback } = await import('./rss-parser');

    const result = await fetchFeedWithFallback({
      url: 'https://primary.example.com/feed.xml',
      category: 'Startups',
      source: 'Test Source',
      maxItems: 10,
    });

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Item 1');
    expect(result[0].category).toBe('Startups');
    expect(result[0].source).toBe('Test Source');
    expect(result[0].description).toBe('Description one');
  });

  it('truncates long descriptions', async () => {
    const mockXML = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item><title>Item 1</title><link>https://example.com/1</link><description>${'A'.repeat(300)}</description></item>
  </channel>
</rss>`;

    vi.mocked(global.fetch).mockResolvedValue({ ok: true, text: () => Promise.resolve(mockXML) });

    const { fetchFeedWithFallback } = await import('./rss-parser');

    const result = await fetchFeedWithFallback({
      url: 'https://primary.example.com/feed.xml',
      category: 'Innovation',
      source: 'Test Source',
    });

    expect(result[0].description).toHaveLength(203); // 200 + '...'
  });

  it('tries fallback URL when primary fails (first fallback succeeds)', async () => {
    vi.mocked(global.fetch)
      .mockRejectedValueOnce(new Error('Primary failed'))
      .mockResolvedValue({ ok: true, text: () => Promise.resolve(`<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item><title>Fallback Item</title><link>https://fallback.com/1</link><description>From fallback</description></item>
  </channel>
</rss>`)});

    const { fetchFeedWithFallback } = await import('./rss-parser');

    const result = await fetchFeedWithFallback({
      url: 'https://primary.example.com/feed.xml',
      category: 'Consumer Tech',
      source: 'Test Source',
      maxItems: 15,
      fallbackUrls: ['https://fallback.example.com/feed.xml'],
    });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Fallback Item');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('returns empty array when all URLs fail', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('All sources down'));

    const { fetchFeedWithFallback } = await import('./rss-parser');

    const result = await fetchFeedWithFallback({
      url: 'https://primary.example.com/feed.xml',
      category: 'Startups',
      source: 'Test Source',
      fallbackUrls: ['https://fallback.example.com/feed.xml'],
    });

    expect(result).toHaveLength(0);
  }, 15000);

  it('respects maxItems limit', async () => {
    const mockXML = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
${Array.from({ length: 50 }, (_, i) => `<item><title>Item ${i + 1}</title><link>https://example.com/${i + 1}</link><description>Desc ${i + 1}</description></item>`).join('\n')}
  </channel>
</rss>`;

    vi.mocked(global.fetch).mockResolvedValue({ ok: true, text: () => Promise.resolve(mockXML) });

    const { fetchFeedWithFallback } = await import('./rss-parser');

    const result = await fetchFeedWithFallback({
      url: 'https://primary.example.com/feed.xml',
      category: 'Innovation',
      source: 'Test Source',
      maxItems: 5,
    });

    expect(result).toHaveLength(5);
  });

  it('handles items without description gracefully', async () => {
    const mockXML = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item><title>No Content</title><link>https://example.com/1</link></item>
  </channel>
</rss>`;

    vi.mocked(global.fetch).mockResolvedValue({ ok: true, text: () => Promise.resolve(mockXML) });

    const { fetchFeedWithFallback } = await import('./rss-parser');

    const result = await fetchFeedWithFallback({
      url: 'https://primary.example.com/feed.xml',
      category: 'Startups',
      source: 'Test Source',
    });

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('');
  });

  it('extracts image from enclosure', async () => {
    const mockXML = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item><title>With Image</title><link>https://example.com/1</link><enclosure url="https://cdn.example.com/image.jpg" type="image/jpeg"/></item>
  </channel>
</rss>`;

    vi.mocked(global.fetch).mockResolvedValue({ ok: true, text: () => Promise.resolve(mockXML) });

    const { fetchFeedWithFallback } = await import('./rss-parser');

    const result = await fetchFeedWithFallback({
      url: 'https://primary.example.com/feed.xml',
      category: 'Startups',
      source: 'Test Source',
    });

    expect(result[0].image).toBe('https://cdn.example.com/image.jpg');
  });

  it('extracts favicon when no image found', async () => {
    const mockXML = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item><title>No Image</title><link>https://example.com/1</link></item>
  </channel>
</rss>`;

    vi.mocked(global.fetch).mockResolvedValue({ ok: true, text: () => Promise.resolve(mockXML) });

    const { fetchFeedWithFallback } = await import('./rss-parser');

    const result = await fetchFeedWithFallback({
      url: 'https://primary.example.com/feed.xml',
      category: 'Startups',
      source: 'Test Source',
    });

    expect(result[0].image).toBe('https://www.google.com/s2/favicons?sz=640&domain=example.com');
  });
});
