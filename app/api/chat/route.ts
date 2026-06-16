import {
  formatRequestBody,
  getChatUrl,
  getHeaders,
  parseStreamChunk,
} from '@/lib/chat-providers';
import type { ChatProvider } from '@/lib/chat-providers';
import { checkRateLimit } from '@/lib/rate-limiter';

export const runtime = 'nodejs';

const CHAT_TIMEOUT_MS = 60_000; // 60-second timeout for upstream LLM requests

export async function POST(request: Request) {
  // Rate limit check — prevent chat spam
  if (!checkRateLimit('/api/chat')) {
    return new Response(
      JSON.stringify({ error: 'Rate limited. Try again in a minute.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const body = await request.json();
    const { messages, provider } = body as {
      messages: { role: string; content: string }[];
      provider: ChatProvider;
    };

    if (!messages || !provider) {
      return new Response(JSON.stringify({ error: 'Missing messages or provider' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = getChatUrl(provider);
    const headers = getHeaders(provider);
    const requestBody = formatRequestBody(provider, messages);

    // AbortController to prevent hanging upstream requests from exhausting resources
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), CHAT_TIMEOUT_MS);

    let upstream: Response;
    try {
      upstream = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!upstream.ok) {
      const errorText = await upstream.text();
      return new Response(
        JSON.stringify({ error: `Provider returned ${upstream.status}: ${errorText}` }),
        { status: upstream.status, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (!upstream.body) {
      return new Response(JSON.stringify({ error: 'No response body from provider' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create a TransformStream to parse SSE and forward clean text chunks
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let buffer = '';

    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body!.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(':')) continue;

              if (trimmed.startsWith('data: ')) {
                const data = trimmed.slice(6);
                if (data === '[DONE]') {
                  controller.close();
                  return;
                }

                const text = parseStreamChunk(provider, data);
                if (text) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                }
              } else if (provider.type === 'claude') {
                // Anthropic sends event: type before data: lines
                // Also sends raw JSON events without data: prefix in some modes
                if (trimmed.startsWith('event:')) continue;
                try {
                  const text = parseStreamChunk(provider, trimmed);
                  if (text) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                  }
                } catch {
                  // ignore non-JSON lines
                }
              }
            }
          }
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
