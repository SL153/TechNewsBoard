import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import sanitizeHtml from 'sanitize-html';

export interface ArticleResult {
  title: string;
  byline: string | null;
  excerpt: string | null;
  html: string;
  text: string; // plain text (truncated) — used for AI summaries
  leadImage: string | null;
}

const FETCH_TIMEOUT_MS = 12000;
const MAX_HTML_CHARS = 2_000_000;
export const MAX_TEXT_CHARS = 16000; // truncate extracted text for downstream use

/**
 * Fetch a URL and extract a clean, readable article via Readability.
 * Throws on failure (caller decides how to surface the error).
 */
export async function extractArticle(url: string): Promise<ArticleResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // Realistic browser headers reduce 429/bot-blocking by publishers.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
  } catch (err) {
    throw new Error(`Could not reach the article (${(err as Error).message}).`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new Error(`The source responded with HTTP ${res.status}.`);

  const contentType = res.headers.get('content-type') || '';
  if (!/text\/html|application\/xhtml/i.test(contentType)) {
    throw new Error('This link is not an HTML article (e.g. a PDF or media file).');
  }

  const raw = await res.text();
  if (!raw || raw.length > MAX_HTML_CHARS) {
    throw new Error('The page was empty or too large to process.');
  }

  let dom: JSDOM;
  try {
    dom = new JSDOM(raw, { url });
  } catch {
    throw new Error('Failed to parse the page HTML.');
  }
  const doc = dom.window.document;

  // Capture metadata before Readability mutates the document.
  const leadImage =
    doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || null;

  let article;
  try {
    article = new Readability(doc).parse();
  } catch {
    article = null;
  }

  const content = article?.content || '';
  const fullText = article?.textContent || '';
  if (!article || (!content && fullText.trim().length < 200)) {
    throw new Error(
      'Could not extract a readable article (the page may be paywalled or fully JavaScript-rendered).',
    );
  }

  const sanitized = sanitizeHtml(content, {
    allowedTags: [
      'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em',
      'b', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
      'img', 'figure', 'figcaption', 'picture', 'source',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption',
      'span', 'div',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'loading'],
      source: ['srcset', 'type'],
      '*': [],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'data'],
    transformTags: {
      a: (_tag, attribs) => ({
        tagName: 'a',
        attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer nofollow' },
      }),
    },
  });

  return {
    title: article.title || doc.title || '',
    byline: article.byline || null,
    excerpt: article.excerpt || null,
    html: sanitized,
    text: fullText.slice(0, MAX_TEXT_CHARS),
    leadImage,
  };
}
