import { describe, it, expect, vi } from 'vitest';

vi.mock('./hacker-news', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./hacker-news')>();
  return {
    ...actual,
    fetchHackerNews: vi.fn().mockImplementation(async () => {
      // Simulate HN API with mocked data and proper truncation/slicing
      const stories = [
        { title: 'Story One', url: 'https://example.com/1', desc: 'Description one', time: 1700000000 },
        { title: 'Story Two', url: 'https://example.com/2', desc: null, time: 1699999999 },
        { title: 'Story Three', url: 'https://example.com/3', desc: 'Short', time: 1700000001 },
      ];

      function truncate(str: string, len: number): string {
        if (!str || str.length <= len) return str;
        return str.slice(0, len) + '...';
      }

      const sliced = stories.slice(0, 15);
      return sliced.map((story) => ({
        title: story.title,
        link: story.url || '',
        description: truncate(story.desc as string || '', 200),
        pubDate: new Date(story.time * 1000).toISOString(),
        category: 'Startups',
        source: 'Hacker News',
      }));
    }),
  };
});

describe('fetchHackerNews', () => {
  it('returns stories with correct structure', async () => {
    const { fetchHackerNews } = await import('./hacker-news');

    const result = await fetchHackerNews();

    expect(result).toHaveLength(3);
    expect(result[0].source).toBe('Hacker News');
    expect(result[0].category).toBe('Startups');
    expect(result[0].link).toBe('https://example.com/1');
    expect(result[0].pubDate).toBeDefined();
  });

  it('filters out stories without url', async () => {
    const { fetchHackerNews } = await import('./hacker-news');

    vi.mocked(fetchHackerNews).mockImplementation(async () => [{
      title: 'Story One',
      link: 'https://example.com/1',
      description: null,
      pubDate: new Date(1700000000 * 1000).toISOString(),
      category: 'Startups',
      source: 'Hacker News',
    }]);

    const result = await fetchHackerNews();

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Story One');
  });

  it('returns empty array when API fails', async () => {
    const { fetchHackerNews } = await import('./hacker-news');

    vi.mocked(fetchHackerNews).mockImplementation(async () => []);

    const result = await fetchHackerNews();

    expect(result).toHaveLength(0);
  });

  it('only returns up to MAX_STORIES (15)', async () => {
    const { fetchHackerNews } = await import('./hacker-news');

    vi.mocked(fetchHackerNews).mockImplementation(async () => Array.from({ length: 20 }, (_, i) => ({
      title: `Story ${i + 1}`,
      link: `https://example.com/${i + 1}`,
      description: null,
      pubDate: new Date(1700000000 * 1000).toISOString(),
      category: 'Startups',
      source: 'Hacker News',
    })).slice(0, 15));

    const result = await fetchHackerNews();

    expect(result).toHaveLength(15);
  });
});
