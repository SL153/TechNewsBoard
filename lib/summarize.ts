/**
 * Stable, self-contained AI summarizer.
 *
 * Does NOT depend on the (POC) chat-provider system. It talks directly to any
 * OpenAI-compatible endpoint configured via server env vars — defaulting to
 * Groq's free tier. The key lives in the container env, not the client.
 *
 * Env:
 *   SUMMARY_API_KEY   — required to enable summaries (free Groq key: console.groq.com)
 *   SUMMARY_BASE_URL  — default https://api.groq.com/openai/v1
 *   SUMMARY_MODEL     — default llama-3.3-70b-versatile
 */

export interface SummaryConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export const SUMMARY_NOT_CONFIGURED = 'SUMMARY_NOT_CONFIGURED';

export function getSummaryConfig(): SummaryConfig | null {
  const apiKey = process.env.SUMMARY_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (process.env.SUMMARY_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, ''),
    model: (process.env.SUMMARY_MODEL || 'llama-3.3-70b-versatile').trim(),
  };
}

const SUMMARY_TIMEOUT_MS = 60000;
export const MAX_INPUT_CHARS = 12000;

/** Hard timeout via Promise.race — guarantees termination even if the upstream
 *  connection hangs (AbortController alone isn't reliable for stalled streams). */
export function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(msg)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer!));
}

export const SUMMARY_SYSTEM_PROMPT =
  'You are a concise tech-news summarizer. The user gives you the extracted text of a single article. ' +
  'Think as much as you need, but output ONLY your final summary wrapped in <summary></summary> tags — ' +
  'NO reasoning, planning, or commentary outside those tags. ' +
  'Inside the tags: a short intro line, then 3–5 markdown bullet points of the key facts, then a one-line takeaway. ' +
  'Do not invent facts not present in the text. ' +
  'If the text is clearly not an article (nav junk, error page, too little content), put only this inside the tags: "Could not summarize this article."';

/**
 * Extract the model's final summary. Reasoning models (e.g. Nemotron) often
 * dump chain-of-thought into the content, so we keep only what's inside
 * <summary>…</summary>; falls back to stripping <think> blocks, then to raw.
 */
export function cleanSummary(raw: string): string {
  if (!raw) return '';
  const openIdx = raw.search(/<summary\s*>/i);
  if (openIdx >= 0) {
    const after = raw.slice(raw.indexOf('>', openIdx) + 1);
    const closeIdx = after.search(/<\/summary\s*>/i);
    const inner = closeIdx >= 0 ? after.slice(0, closeIdx) : after;
    const trimmed = inner.trim();
    if (trimmed) return trimmed;
  }
  const noThink = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  return noThink || raw.trim();
}

/**
 * Summarize plain article text via the configured OpenAI-compatible provider.
 * Throws SUMMARY_NOT_CONFIGURED if no key is set; other errors throw normally.
 */
export async function summarizeText(text: string): Promise<string> {
  const cfg = getSummaryConfig();
  if (!cfg) throw new Error(SUMMARY_NOT_CONFIGURED);

  const trimmed = text.slice(0, MAX_INPUT_CHARS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUMMARY_TIMEOUT_MS);

  const run = (async () => {
    let res: Response;
    try {
      res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          temperature: 0.3,
          max_tokens: 2500,
          messages: [
            { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
            { role: 'user', content: trimmed },
          ],
        }),
      });
    } catch (err) {
      throw new Error(`Summary request failed (${(err as Error).message}).`);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Summary provider returned HTTP ${res.status}. ${detail.slice(0, 200)}`);
    }

    const data = await res.json().catch(() => null);
    const raw: string | undefined = data?.choices?.[0]?.message?.content?.trim();
    if (!raw) throw new Error('Summary provider returned an empty response.');
    return cleanSummary(raw);
  })();

  return withTimeout(run, SUMMARY_TIMEOUT_MS, 'Summary provider timed out.').finally(() =>
    clearTimeout(timer),
  );
}
