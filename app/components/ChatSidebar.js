'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Trash2, Loader2, Bot, User, AlertCircle, Copy, Check, ExternalLink, Sparkles, Columns2, PanelRightOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { buildNewsContext, buildSystemPrompt } from '@/lib/chat-providers';

const CHAT_HISTORY_KEY = 'technews-chat-history';

function loadChatHistory() {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(CHAT_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveChatHistory(messages) {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = messages.slice(-50);
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(trimmed));
  } catch { /* ignore quota errors */ }
}

function generateQuickPrompts(articles) {
  const defaults = [
    "Summarize today's top stories",
    "What are the key AI trends?",
    "Compare startup funding news"
  ];

  if (!articles || articles.length === 0) return defaults;

  const categories = {};
  articles.forEach(a => {
    if (a.category) {
      categories[a.category] = (categories[a.category] || 0) + 1;
    }
  });

  const topCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 2);
  const prompts = [];

  if (topCategories.length > 0) {
    const [cat] = topCategories[0];
    prompts.push(`What's new in ${cat}?`);
  }
  if (topCategories.length > 1) {
    const [cat2] = topCategories[1];
    prompts.push(`Compare ${topCategories[0][0]} and ${cat2} news`);
  }

  prompts.push("What should I pay attention to?");
  return prompts;
}

function ArticleLinkRenderer({ href, children }) {
  const openArticle = useCallback(() => {
    if (href) window.open(href, '_blank', 'noopener');
  }, [href]);

  return (
    <button
      onClick={openArticle}
      className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
    >
      {children}
      <ExternalLink size={10} className="inline-block flex-shrink-0" />
    </button>
  );
}

function CopyButton({ content }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-muted dark:hover:bg-muted/80 text-muted-foreground transition-colors"
      aria-label="Copy message"
    >
      {copied ? <Check size={12} className="text-green-600 dark:text-green-400" /> : <Copy size={12} />}
    </button>
  );
}

export default function ChatSidebar({ open, onClose, provider, articles, darkMode, focusArticle, compareArticles, layoutMode, onLayoutToggle }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);

  useEffect(() => {
    setMessages(loadChatHistory());
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  useEffect(() => {
    if (messages.length > 0) {
      saveChatHistory(messages);
    }
  }, [messages]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    localStorage.removeItem(CHAT_HISTORY_KEY);
  }, []);

  const cancelStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStreaming(false);
  }, []);

  const sendMessage = useCallback(async (textOverride, extraOptions) => {
    const text = (textOverride || input).trim();
    if (!text || streaming) return;
    if (!provider) {
      setError('No chat provider configured. Open Settings to configure one.');
      return;
    }

    setError(null);
    const userMsg = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setStreaming(true);

    const newsContext = buildNewsContext(articles || []);
    const systemPromptOptions = {
      responseLength: provider.responseLength,
      ...(extraOptions || {}),
    };
    const systemPrompt = buildSystemPrompt(newsContext, systemPromptOptions);

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...updatedMessages.map(m => ({ role: m.role, content: m.content })),
    ];

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, messages: apiMessages }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `Provider returned ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      let buffer = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              assistantText += parsed.text;
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: assistantText };
                return copy;
              });
            }
          } catch { /* skip malformed chunks */ }
        }
      }

      if (!assistantText) {
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: '(No response received from provider)' };
          return copy;
        });
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        return;
      }
      setError(err.message || 'Failed to get response');
      setMessages(prev => {
        if (prev.length > 0 && prev[prev.length - 1].role === 'assistant' && !prev[prev.length - 1].content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, streaming, provider, messages, articles]);

  // Keep a ref to the latest sendMessage to avoid stale closures in effects
  const sendMessageRef = useRef(sendMessage);
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  // Handle focusArticle prop — auto-send when it changes and chat is open
  useEffect(() => {
    if (!openRef.current || !focusArticle) return;
    const text = `Tell me more about: ${focusArticle.title}`;
    sendMessageRef.current(text, { focusArticle });
  }, [focusArticle]);

  // Handle compareArticles prop — auto-send when it changes and chat is open
  useEffect(() => {
    if (!openRef.current || !compareArticles || compareArticles.length < 2) return;
    const titles = compareArticles.map(a => a.title).join(', ');
    const text = `Compare these articles: ${titles}`;
    sendMessageRef.current(text, { compareArticles });
  }, [compareArticles]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const quickPrompts = generateQuickPrompts(articles);

  if (!open && layoutMode !== 'split') return null;

  const hasProvider = provider && (provider.apiKey || provider.type === 'ollama' || provider.type === 'lmstudio' || provider.type === 'custom' || provider.type === 'github');

  const asideClasses = layoutMode === 'split'
    ? 'w-[28rem] lg:w-[32rem] flex-shrink-0 flex flex-col border-l bg-card dark:bg-card border-border'
    : `fixed right-0 top-0 h-full z-50 w-[28rem] lg:w-[32rem] flex-shrink-0 flex flex-col border-l bg-card dark:bg-card border-border shadow-xl transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`;

  return (
    <aside className={asideClasses}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card dark:bg-card">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-blue-600 dark:text-blue-300" />
          <span className="text-sm font-semibold">News Chat</span>
          {provider && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-secondary dark:bg-accent text-muted-foreground">
              {provider.model}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onLayoutToggle && (
            <button
              onClick={onLayoutToggle}
              aria-label={layoutMode === 'split' ? 'Switch to overlay mode' : 'Switch to split view'}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-accent transition-colors"
            >
              {layoutMode === 'split' ? <PanelRightOpen size={14} /> : <Columns2 size={14} />}
            </button>
          )}
          <button
            onClick={clearChat}
            aria-label="Clear chat"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-accent transition-colors"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={onClose}
            aria-label="Close chat"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-accent transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-3">
            <Bot size={32} className="mx-auto text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">
              Ask questions about the {articles?.length || 0} articles currently in your feed.
            </p>
            {!streaming && (
              <div className="flex flex-wrap gap-1.5 justify-center pt-2">
                {quickPrompts.map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    className="px-2 py-0.5 rounded-full text-[11px] bg-secondary dark:bg-accent text-muted-foreground hover:bg-muted dark:hover:bg-muted/80 transition-colors flex items-center gap-1"
                  >
                    <Sparkles size={9} />
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-blue-100 dark:bg-blue-800/30">
                <Bot size={12} className="text-blue-600 dark:text-blue-300" />
              </div>
            )}
            <div className="relative group">
              <div
                className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 dark:bg-blue-700 text-white rounded-br-sm whitespace-pre-wrap'
                    : 'bg-secondary dark:bg-accent text-foreground rounded-bl-sm'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="chat-markdown">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ArticleLinkRenderer,
                      }}
                    >{msg.content}</ReactMarkdown>
                    {streaming && idx === messages.length - 1 && (
                      <span className="inline-block w-1.5 h-4 ml-0.5 bg-current opacity-60 animate-pulse" />
                    )}
                  </div>
                ) : (
                  msg.content
                )}
              </div>
              {msg.role === 'assistant' && (
                <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <CopyButton content={msg.content} />
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-muted dark:bg-accent">
                <User size={12} className="text-muted-foreground" />
              </div>
            )}
          </div>
        ))}

        {error && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 dark:bg-destructive/20 text-sm">
            <AlertCircle size={14} className="text-destructive flex-shrink-0 mt-0.5" />
            <span className="text-destructive text-xs">{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border px-4 py-3 bg-card dark:bg-card space-y-2">
        {!hasProvider ? (
          <div className="text-xs text-center text-muted-foreground py-2">
            Configure a chat provider in Settings to start chatting.
          </div>
        ) : (
          <>
            {!streaming && messages.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center pb-1">
                {quickPrompts.map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    className="px-2 py-0.5 rounded-full text-[11px] bg-secondary dark:bg-accent text-muted-foreground hover:bg-muted dark:hover:bg-muted/80 transition-colors flex items-center gap-1"
                  >
                    <Sparkles size={9} />
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about the news..."
                rows={1}
                className="flex-1 px-3 py-2 rounded-xl text-sm border resize-none bg-card dark:bg-card border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-blue-600/30 max-h-24 overflow-y-auto"
                style={{ minHeight: '2.5rem' }}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px';
                }}
              />
              {streaming ? (
                <button
                  onClick={cancelStream}
                  className="p-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors flex-shrink-0"
                  aria-label="Stop generating"
                >
                  <X size={16} />
                </button>
              ) : (
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim()}
                  className="p-2 rounded-xl bg-blue-600 dark:bg-blue-700 text-white hover:opacity-90 transition-opacity disabled:opacity-30 flex-shrink-0"
                  aria-label="Send message"
                >
                  <Send size={16} />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
