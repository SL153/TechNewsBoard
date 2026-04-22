import { describe, it, expect, vi } from 'vitest';

describe('fetchGitHubTrending', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    if (originalFetch) {
      vi.stubGlobal('fetch', originalFetch);
    }
  });

  const mockHTML = `
    <html>
      <body>
        <article class="Box-row">
          <h2><a href="/microsoft/azure">microsoft/azure</a></h2>
          <p class="col-9 mt-1 pr-3">Cloud computing platform and services</p>
          <span class="d-inline-block col-10 ml-2"><svg>...</svg> 85,421 stars today</span>
        </article>
        <article class="Box-row">
          <h2><a href="/vercel/next.js">vercel/next.js</a></h2>
          <p class="col-9 mt-1 pr-3">The React Framework for production</p>
          <span class="d-inline-block col-10 ml-2"><svg>...</svg> 42,890 stars today</span>
        </article>
        <article class="Box-row">
          <h2><a href="/anthropics/claude-sdk">anthropics/claude-sdk</a></h2>
          <p class="col-9 mt-1 pr-3">Official SDK for Claude API</p>
        </article>
      </body>
    </html>
  `;

  it('parses trending repos from HTML', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(mockHTML) }));

    const { fetchGitHubTrending } = await import('./github-trending');

    const result = await fetchGitHubTrending();

    expect(result).toHaveLength(3);
    expect(result[0].title).toBe('microsoft/azure');
    expect(result[0].link).toBe('https://github.com/microsoft/azure');
    expect(result[0].source).toBe('GitHub Trending');
  });

  it('extracts star information from HTML', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(mockHTML) }));

    const { fetchGitHubTrending } = await import('./github-trending');

    const result = await fetchGitHubTrending();

    expect(result[0].description).toContain('Stars:');
  });

  it('handles repos without star info', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(mockHTML) }));

    const { fetchGitHubTrending } = await import('./github-trending');

    const result = await fetchGitHubTrending();

    expect(result[2].description).toBeDefined();
    expect(result[2].title).toBe('anthropics/claude-sdk');
  });

  it('truncates long descriptions', async () => {
    const htmlWithLongDesc = `
      <html>
        <body>
          <article class="Box-row">
            <h2><a href="/big/big-repo">big/big-repo</a></h2>
            <p class="col-9 mt-1 pr-3">${'A'.repeat(300)}</p>
            <span class="d-inline-block col-10 ml-2"><svg>...</svg> 1,000 stars today</span>
          </article>
        </body>
      </html>
    `;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(htmlWithLongDesc) }));

    const { fetchGitHubTrending } = await import('./github-trending');

    const result = await fetchGitHubTrending();

    expect(result[0].description).toHaveLength(203); // 200 + '...'
  });

  it('returns empty array when API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const { fetchGitHubTrending } = await import('./github-trending');

    const result = await fetchGitHubTrending();

    expect(result).toHaveLength(0);
  });

  it('returns empty array when HTML has no articles', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('<html><body></body></html>') }));

    const { fetchGitHubTrending } = await import('./github-trending');

    const result = await fetchGitHubTrending();

    expect(result).toHaveLength(0);
  });

  it('respects MAX_ITEMS limit (20)', async () => {
    const htmlWithManyArticles = Array.from({ length: 30 }, (_, i) => `
      <article class="Box-row">
        <h2><a href="/user/repo-${i}">user/repo-${i}</a></h2>
        <p class="col-9 mt-1 pr-3">Description ${i}</p>
      </article>
    `).join('\n');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(`<html><body>${htmlWithManyArticles}</body></html>`)}));

    const { fetchGitHubTrending } = await import('./github-trending');

    const result = await fetchGitHubTrending();

    expect(result).toHaveLength(20);
  });

  it('handles malformed HTML gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('<html><body>no articles here</body></html>') }));

    const { fetchGitHubTrending } = await import('./github-trending');

    const result = await fetchGitHubTrending();

    expect(result).toHaveLength(0);
  });
});
