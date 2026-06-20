import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ORIG_KEY = process.env.SUMMARY_API_KEY;

beforeEach(() => {
  delete process.env.SUMMARY_API_KEY;
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  if (ORIG_KEY === undefined) delete process.env.SUMMARY_API_KEY;
  else process.env.SUMMARY_API_KEY = ORIG_KEY;
  vi.unstubAllGlobals();
});

describe('summarizeText', () => {
  it('throws SUMMARY_NOT_CONFIGURED when no key is set', async () => {
    const { summarizeText } = await import('./summarize');
    await expect(summarizeText('some article text')).rejects.toThrow('SUMMARY_NOT_CONFIGURED');
  });

  it('posts to the OpenAI-compatible endpoint and returns the summary', async () => {
    process.env.SUMMARY_API_KEY = 'groq-key';
    process.env.SUMMARY_BASE_URL = 'https://api.groq.com/openai/v1';
    process.env.SUMMARY_MODEL = 'llama-3.3-70b-versatile';

    const mock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '  - Bullet one\n- Bullet two  ' } }] }),
    } as Response);
    vi.stubGlobal('fetch', mock);

    const { summarizeText } = await import('./summarize');
    const out = await summarizeText('A long article body...');

    expect(out).toBe('- Bullet one\n- Bullet two');
    expect(mock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = mock.mock.calls[0];
    expect(calledUrl).toBe('https://api.groq.com/openai/v1/chat/completions');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe('llama-3.3-70b-versatile');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer groq-key' });
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].content).toBe('A long article body...');
  });

  it('surfaces a provider HTTP error', async () => {
    process.env.SUMMARY_API_KEY = 'groq-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'rate limited' } as Response),
    );
    const { summarizeText } = await import('./summarize');
    await expect(summarizeText('text')).rejects.toThrow(/HTTP 429/);
  });
});
