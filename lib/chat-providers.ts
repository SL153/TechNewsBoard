export type ProviderType = 'openai' | 'claude' | 'github' | 'ollama' | 'lmstudio' | 'custom';

export interface ChatProvider {
  type: ProviderType;
  endpoint: string;
  apiKey?: string;
  model: string;
  requestFormat?: 'openai' | 'anthropic';
  authType?: 'none' | 'bearer';
}

export interface ProviderPreset {
  label: string;
  type: ProviderType;
  endpoint: string;
  defaultModel: string;
  models: string[];
  requiresKey: boolean;
  authType: 'api-key' | 'oauth' | 'none' | 'selectable';
}

export const PROVIDER_PRESETS: Record<ProviderType, ProviderPreset> = {
  openai: {
    label: 'OpenAI',
    type: 'openai',
    endpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o4-mini'],
    requiresKey: true,
    authType: 'api-key',
  },
  claude: {
    label: 'Claude',
    type: 'claude',
    endpoint: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-20250514',
    models: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414', 'claude-opus-4-20250514'],
    requiresKey: true,
    authType: 'api-key',
  },
  github: {
    label: 'GitHub',
    type: 'github',
    endpoint: 'https://models.inference.ai.azure.com',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'Meta-Llama-3.1-405B-Instruct', 'Mistral-large-2411'],
    requiresKey: true,
    authType: 'oauth',
  },
  ollama: {
    label: 'Ollama',
    type: 'ollama',
    endpoint: 'http://localhost:11434',
    defaultModel: 'llama3',
    models: ['llama3', 'llama3.1', 'mistral', 'codellama', 'gemma2', 'phi3'],
    requiresKey: false,
    authType: 'none',
  },
  lmstudio: {
    label: 'LM Studio',
    type: 'lmstudio',
    endpoint: 'http://localhost:1234/v1',
    defaultModel: 'default',
    models: ['default'],
    requiresKey: false,
    authType: 'none',
  },
  custom: {
    label: 'Custom API',
    type: 'custom',
    endpoint: '',
    defaultModel: '',
    models: [],
    requiresKey: false,
    authType: 'selectable',
  },
};

// Format the API request body based on provider type
export function formatRequestBody(
  provider: ChatProvider,
  messages: { role: string; content: string }[],
) {
  if (provider.type === 'claude' || (provider.type === 'custom' && provider.requestFormat === 'anthropic')) {
    // Anthropic Messages API format
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');
    return {
      model: provider.model,
      max_tokens: 4096,
      stream: true,
      system: systemMsg?.content || '',
      messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
    };
  }

  // OpenAI-compatible format (OpenAI, GitHub Models, Ollama, LM Studio)
  return {
    model: provider.model,
    max_tokens: 4096,
    stream: true,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  };
}

// Get the chat completions URL for a provider
export function getChatUrl(provider: ChatProvider): string {
  if (provider.type === 'claude') {
    return `${provider.endpoint}/messages`;
  }
  if (provider.type === 'ollama') {
    return `${provider.endpoint}/v1/chat/completions`;
  }
  // Custom API with configurable request format
  if (provider.type === 'custom') {
    if (provider.requestFormat === 'anthropic') {
      return `${provider.endpoint}/messages`;
    }
    return `${provider.endpoint}/v1/chat/completions`;
  }
  // OpenAI, GitHub Models, LM Studio
  return `${provider.endpoint}/chat/completions`;
}

// Get request headers for a provider
export function getHeaders(provider: ChatProvider): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (provider.type === 'claude') {
    if (provider.apiKey) headers['x-api-key'] = provider.apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }

  // Custom API with selectable auth
  if (provider.type === 'custom' && provider.authType === 'bearer' && provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }

  return headers;
}

// Parse a single SSE data chunk to extract the text delta
export function parseStreamChunk(provider: ChatProvider, data: string): string | null {
  if (data === '[DONE]') return null;

  try {
    const parsed = JSON.parse(data);

    if (provider.type === 'claude') {
      // Anthropic streaming events
      if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
        return parsed.delta.text;
      }
      return null;
    }

    // OpenAI-compatible streaming
    const delta = parsed.choices?.[0]?.delta;
    if (delta?.content) return delta.content;
    return null;
  } catch {
    return null;
  }
}

// Build the news context string from articles with smart prioritization
// Limits to ~3000 chars (roughly 750 tokens) instead of 6000 to reduce wasted LLM tokens
export function buildNewsContext(
  articles: { title: string; source: string; category: string; pubDate?: string; description?: string }[],
  maxChars: number = 3000,
): string {
  if (!articles || articles.length === 0) return '';

  // Sort by recency (most recent first), then by category diversity
  const sorted = [...articles].sort((a, b) => {
    const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return dateB - dateA;
  });

  // Deduplicate by source — keep only the most recent article per source
  const seenSources = new Set<string>();
  const deduplicated = sorted.filter(a => {
    if (seenSources.has(a.source)) return false;
    seenSources.add(a.source);
    return true;
  });

  let context = '';
  let count = 0;

  for (const article of deduplicated) {
    // Compact entry format to save chars
    const entry = `[${article.source}] ${article.title} (${article.category})\n${article.description || 'No description'}\n\n`;

    if (context.length + entry.length > maxChars) break;
    context += entry;
    count++;
  }

  return `The following ${count} news articles are currently displayed:\n\n${context}`;
}

// Build the system prompt
export function buildSystemPrompt(
  newsContext: string,
  options?: {
    responseLength?: 'brief' | 'detailed';
    focusArticle?: { title: string; source: string; description?: string; link: string };
    compareArticles?: { title: string; source: string; category: string; description?: string; link: string }[];
  },
): string {
  const lengthInstruction = options?.responseLength === 'brief'
    ? '- Keep responses concise (2–4 sentences). Get to the point quickly.'
    : options?.responseLength === 'detailed'
      ? '- Provide detailed, comprehensive analysis. Include examples and context where helpful.'
      : '- Keep responses well-structured but reasonably concise.';

  let extraContext = '';

  if (options?.focusArticle) {
    const a = options.focusArticle;
    extraContext += `\n\nThe user is specifically asking about this article:\n**[${a.title}](${a.link})** — ${a.source}${a.description ? '\n' + a.description : ''}`;
  }

  if (options?.compareArticles && options.compareArticles.length >= 2) {
    const articles = options.compareArticles.map((a, i) =>
      `${i + 1}. **[${a.title}](${a.link})** — ${a.source} (${a.category})${a.description ? '\n   ' + a.description : ''}`,
    ).join('\n');
    extraContext += `\n\nThe user wants to compare these articles:\n${articles}\nProvide a structured comparison covering: key differences, similarities, and your analysis.`;
  }

  return `You are a helpful news assistant for a tech news dashboard. You help users understand, analyze, and ask questions about the current news articles they're viewing.

${newsContext}
${extraContext}

Instructions:
- Answer questions based on the articles above.
- When mentioning an article, ALWAYS include a markdown link using its URL from the context (e.g., [Article Title](https://example.com/article)).
- You can summarize, compare, find trends, or explain technical concepts mentioned in the articles.
- If asked about something not covered by the articles, say so clearly.
${lengthInstruction}
- Use markdown formatting when helpful (headings, lists, bold text).
- When referencing an article, mention its source name.`;
}
