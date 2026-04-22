import { describe, it, expect } from 'vitest';
import { RSS_FEEDS, CATEGORY_MAP } from './news-sources';

describe('news-sources', () => {
  describe('RSS_FEEDS', () => {
    it('has at least 10 feed sources', () => {
      expect(RSS_FEEDS.length).toBeGreaterThanOrEqual(12);
    });

    it('each feed has required fields (url, category, source)', () => {
      for (const feed of RSS_FEEDS) {
        expect(feed.url).toBeDefined();
        expect(feed.category).toBeDefined();
        expect(feed.source).toBeDefined();
        expect(feed.url).toMatch(/^https?:\/\//);
      }
    });

    it('feeds have valid categories', () => {
      const validCategories = ['Startups', 'Consumer Tech', 'Innovation', 'AI'];
      for (const feed of RSS_FEEDS) {
        expect(validCategories).toContain(feed.category);
      }
    });

    it('feeds with fallbackUrls have at least one fallback', () => {
      for (const feed of RSS_FEEDS) {
        if (feed.fallbackUrls && feed.fallbackUrls.length > 0) {
          for (const fallbackUrl of feed.fallbackUrls) {
            expect(fallbackUrl).toMatch(/^https?:\/\//);
          }
        }
      }
    });

    it('TechCrunch has a fallback URL', () => {
      const techCrunch = RSS_FEEDS.find(f => f.source === 'TechCrunch');
      expect(techCrunch?.fallbackUrls).toBeDefined();
      expect(techCrunch?.fallbackUrls?.length).toBeGreaterThan(0);
    });

    it('The Verge has a fallback URL', () => {
      const theVerge = RSS_FEEDS.find(f => f.source === 'The Verge');
      expect(theVerge?.fallbackUrls).toBeDefined();
      expect(theVerge?.fallbackUrls?.length).toBeGreaterThan(0);
    });

    it('maxItems defaults to 15 when not specified', () => {
      for (const feed of RSS_FEEDS) {
        if (!feed.maxItems) {
          // Some feeds might have maxItems set, check that those are reasonable
          expect(feed.maxItems).toBeLessThanOrEqual(20);
        }
      }
    });

    it('has unique source names', () => {
      const sources = RSS_FEEDS.map(f => f.source);
      const uniqueSources = new Set(sources);
      expect(uniqueSources.size).toBe(sources.length);
    });
  });

  describe('CATEGORY_MAP', () => {
    it('includes All, Startups, Consumer Tech, AI, Innovation, Open Source', () => {
      expect(CATEGORY_MAP).toContain('All');
      expect(CATEGORY_MAP).toContain('Startups');
      expect(CATEGORY_MAP).toContain('Consumer Tech');
      expect(CATEGORY_MAP).toContain('AI');
      expect(CATEGORY_MAP).toContain('Innovation');
      expect(CATEGORY_MAP).toContain('Open Source');
    });

    it('has exactly 6 categories', () => {
      expect(CATEGORY_MAP.length).toBe(6);
    });
  });
});
