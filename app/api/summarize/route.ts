import { withCache } from '@/lib/cache';
import { extractArticle } from '@/lib/article';
import { summarizeText, getSummaryConfig, SUMMARY_SYSTEM_PROMPT, MAX_INPUT_CHARS, withTimeout, cleanSummary } from '@/lib/summarize';
import { formatRequestBody, getChatUrl, getHeaders } from '@/lib/chat-providers';
import type { ChatProvider } from '@/lib/chat-providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ARTICLE_TTL = 86400; // 24h (shared with /api/article)
const SUMMARY_TTL = 604800; // 7 days — summaries don't change
const PROVIDER_TIMEOUT_MS = 75000;

const KEYLESS_TYPES = new Set(['ollama', 'lmstudio']);

/**
 * Validate + normalize a client-supplied chat provider. Returns null when the
 * user hasn't actually configured a usable one (e.g. a keyed provider with no
 * key), so the caller can fall back to the server env provider.
 */
function normalizeProvider(p: any): ChatProvider | null {
  if (!p || !p.type || !p.endpoint || !p.model) return null;
  const type = p.type as ChatProvider['type'];
  const apiKey = (p.apiKey || '').trim();
  const endpoint = p.endpoint;
  const model = p.model;

  if (KEYLESS_TYPES.has(type)) {
    return { type, endpoint, apiKey, model };
  }
  if (type === 'custom') {
    const authType = (p.customAuthType || p.authType || 'none') as 'none' | 'bearer';
    const requestFormat = (p.requestFormat || 'openai') as 'openai' | 'anthropic';
    if (authType === 'bearer' && !apiKey) return null;
    return { type, endpoint, apiKey, model, requestFormat, authType };
  }
  // openai, claude, github — require a key/token
  if (!apiKey) return null;
  return { type, endpoint, apiKey, model };
}

function extractProviderContent(provider: ChatProvider, data: any): string {
  const isAnthropic =
    provider.type === 'claude' ||
    (provider.type === 'custom' && provider.requestFormat === 'anthropic');
  if (isAnthropic) {
    const blocks = data?.content;
    if (Array.isArray(blocks)) return blocks.map((b: any) => b?.text || '').join('').trim();
    return '';
  }
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

/** Summarize using the user's connected LLM (non-streaming). Not cached. */
async function summarizeWithProvider(provider: ChatProvider, text: string): Promise<string> {
  const url = getChatUrl(provider);
  const headers = getHeaders(provider);
  const body = formatRequestBody(provider, [
    { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
    { role: 'user', content: text.slice(0, MAX_INPUT_CHARS) },
  ]) as Record<string, unknown>;
  body.stream = false; // non-streaming for simplicity + stability
  body.max_tokens = 2500;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  const run = (async () => {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Your connected model returned HTTP ${res.status}. ${detail.slice(0, 200)}`);
    }
    const data = await res.json().catch(() => null);
    const out = cleanSummary(extractProviderContent(provider, data));
    if (!out) throw new Error('Your connected model returned an empty response.');
    return out;
  })();

  try {
    return await withTimeout(run, PROVIDER_TIMEOUT_MS, 'Your connected model timed out.');
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  let payload: { url?: string; provider?: any };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const rawUrl = payload.url;
  if (!rawUrl) return Response.json({ error: 'Missing "url" parameter.' }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return Response.json({ error: 'Invalid URL.' }, { status: 400 });
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    return Response.json({ error: 'Only http/https URLs are supported.' }, { status: 400 });
  }

  const provider = normalizeProvider(payload.provider);
  const envConfigured = !!getSummaryConfig();

  if (!provider && !envConfigured) {
    return Response.json({
      error: 'No AI model available. Connect one in Settings, or set SUMMARY_API_KEY on the server (a free Groq key works).',
    });
  }

  // Get the article text (cached extraction, shared with /api/article).
  let text: string;
  try {
    const { data: art } = await withCache(`article:${rawUrl}`, ARTICLE_TTL, () =>
      extractArticle(rawUrl),
    );
    if (!art.text || art.text.trim().length < 200) {
      return Response.json({
        error: 'Not enough readable text was extracted from this article to summarize.',
      });
    }
    text = art.text;
  } catch (err) {
    return Response.json({ error: (err as Error).message || 'Article extraction failed.' });
  }

  try {
    if (provider) {
      const summary = await summarizeWithProvider(provider, text);
      return Response.json({ summary, source: 'connected' });
    }
    // Server env provider — cache for 7 days.
    const { data } = await withCache(`summary:${rawUrl}`, SUMMARY_TTL, () =>
      summarizeText(text),
    );
    return Response.json({ summary: data, source: 'server' });
  } catch (err) {
    return Response.json({ error: (err as Error).message || 'Failed to summarize.' });
  }
}
