'use client';

import { useState, useEffect } from 'react';
import { X, ExternalLink, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * ArticleReader — modal that renders an article's extracted content in-app
 * (server-side reader extraction via /api/article) with an on-demand AI
 * summary (server-side, via /api/summarize) instead of opening a new tab.
 */
export default function ArticleReader({ article, onClose, provider }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Summary state machine
  const [sumState, setSumState] = useState('idle'); // idle | loading | done | error
  const [summary, setSummary] = useState(null);
  const [sumError, setSumError] = useState(null);

  useEffect(() => {
    if (!article?.link) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    // reset summary for each article
    setSumState('idle');
    setSummary(null);
    setSumError(null);

    fetch(`/api/article?url=${encodeURIComponent(article.link)}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        setData(d);
        if (d.error) setError(d.error);
      })
      .catch(e => {
        if (!cancelled) setError(e.message || 'Network error.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [article]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function runSummary() {
    if (sumState === 'loading') return;
    setSumState('loading');
    setSumError(null);
    // Prefer the user's connected LLM (sent in the body); server falls back to
    // its own configured provider when none is supplied.
    fetch(`/api/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: article.link, provider: provider || undefined }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.summary) { setSummary(d.summary); setSumState('done'); }
        else { setSumError(d.error || 'Could not generate a summary.'); setSumState('error'); }
      })
      .catch(e => { setSumError(e.message || 'Network error.'); setSumState('error'); });
  }

  if (!article) return null;

  const title = data?.title || article.title;

  return (
    <div className="phantom-overlay" onClick={onClose}>
      <div className="phantom-panel phantom-reader-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div className="phantom-mono-dim truncate pr-4">
            {article.source}
            {data?.byline ? ` · ${data.byline}` : ''}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white flex-shrink-0"
            aria-label="Close reader"
          >
            <X size={16} />
          </button>
        </div>

        <h1 className="text-xl font-semibold leading-snug mb-3 pr-6">{title}</h1>

        {/* AI summary action */}
        {!loading && !error && (
          <div className="mb-4">
            {sumState !== 'done' && (
              <button
                onClick={runSummary}
                disabled={sumState === 'loading'}
                className="phantom-pill inline-flex items-center gap-1.5"
              >
                  {sumState === 'loading'
                    ? <><Loader2 size={12} className="animate-spin" /> Summarizing…</>
                    : <><Sparkles size={12} /> Summarize with AI</>}
              </button>
            )}
            {(sumState === 'loading' || sumState === 'done' || sumState === 'error') && (
              <div className="reader-summary">
                <div className="reader-summary-label">
                  <Sparkles size={11} /> AI Summary
                </div>
                {sumState === 'loading' && <div className="phantom-mono-dim py-2">Generating…</div>}
                {sumState === 'done' && (
                  <div className="chat-markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
                  </div>
                )}
                {sumState === 'error' && (
                  <div className="flex items-start gap-2 text-white/70 text-sm">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{sumError}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {data?.leadImage && (
          <img
            src={data.leadImage}
            alt=""
            className="w-full max-h-[260px] object-cover rounded-lg mb-4"
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        )}

        {loading && (
          <div className="flex items-center gap-2 phantom-mono-dim py-10">
            <Loader2 size={14} className="animate-spin" /> Extracting article…
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center text-center py-10 gap-3">
            <AlertCircle size={22} className="text-white/40" />
            <p className="text-sm text-white/60 max-w-sm">{error}</p>
          </div>
        )}

        {!loading && !error && data?.html && (
          <div className="reader-prose" dangerouslySetInnerHTML={{ __html: data.html }} />
        )}

        {/* Footer: always-available original link */}
        <div className="flex-shrink-0 mt-5 pt-4 border-t border-white/10">
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="phantom-pill active inline-flex items-center gap-1.5"
          >
            <ExternalLink size={12} /> Open original
          </a>
        </div>
      </div>
    </div>
  );
}
