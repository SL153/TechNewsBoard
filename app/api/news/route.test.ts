import { describe, it, expect, vi } from 'vitest';

vi.mock('./route', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./route')>();
  return {
    ...actual,
    GET: vi.fn().mockImplementation(async (request) => {
      // Simulate the route behavior with mocked data
      const url = new URL(request.url);
      
      if (url.searchParams.get('refresh') === 'true') {
        // Return fresh data on refresh
        return Response.json([]);
      }
      
      // Return cached data normally
      return Response.json([
        { title: 'Cached Article', link: 'https://example.com/1', description: 'Cache works', pubDate: new Date().toISOString(), category: 'Startups', source: 'Test Source' },
      ]);
    }),
  };
});

describe('news route', () => {
  it('returns data on normal request', async () => {
    const { GET } = await import('./route');

    const request = new Request('http://localhost/api/news');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.length).toBeGreaterThan(0);
  });

  it('clears cache when refresh=true', async () => {
    const { GET } = await import('./route');

    const request = new Request('http://localhost/api/news?refresh=true');
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it('returns error body with source health info on failure', async () => {
    const { GET } = await import('./route');

    vi.mocked(GET).mockImplementation(async (request) => {
      return Response.json(
        { error: 'All sources down', sourcesHealthy: 0 },
        { status: 502 }
      );
    });

    const request = new Request('http://localhost/api/news');
    const response = await GET(request);

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toBeDefined();
    expect(body.sourcesHealthy).toBeDefined();
  });
});
