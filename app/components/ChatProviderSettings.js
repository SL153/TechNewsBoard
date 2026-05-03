'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, ExternalLink, Loader2, KeyRound, Eye, EyeOff } from 'lucide-react';

const PROVIDER_TYPES = ['openai', 'claude', 'github', 'ollama', 'lmstudio', 'custom'];

const PRESETS = {
  openai: {
    label: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-5.4-mini',
    models: ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'o3', 'o4-mini'],
    requiresKey: true,
    authType: 'api-key',
  },
  claude: {
    label: 'Claude',
    endpoint: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-20250514',
    models: ['claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'claude-haiku-4-20250414'],
    requiresKey: true,
    authType: 'api-key',
  },
  github: {
    label: 'GitHub',
    endpoint: 'https://models.inference.ai.azure.com',
    defaultModel: 'gpt-5.4-mini',
    models: ['gpt-5.4-mini', 'gpt-4o', 'Meta-Llama-3.3-70B-Instruct', 'Mistral-Small-24b', 'Phi-4-mini-instruct'],
    requiresKey: true,
    authType: 'oauth',
  },
  ollama: {
    label: 'Ollama',
    endpoint: 'http://localhost:11434',
    defaultModel: 'qwen3.6',
    models: ['qwen3.6', 'gemma4', 'granite4.1', 'deepseek-v4-flash', 'mistral-medium-3.5'],
    requiresKey: false,
    authType: 'none',
  },
  lmstudio: {
    label: 'LM Studio',
    endpoint: 'http://localhost:1234/v1',
    defaultModel: 'default',
    models: ['default'],
    requiresKey: false,
    authType: 'none',
  },
  custom: {
    label: 'Custom API',
    endpoint: '',
    defaultModel: '',
    models: [],
    requiresKey: false,
    authType: 'selectable',
  },
};

const STORAGE_KEY = 'technews-chat-providers';
const GITHUB_TOKEN_KEY = 'technews-github-token';
const GITHUB_CLIENT_ID_KEY = 'technews-github-client-id';

function loadAllConfigs() {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}

function saveConfigForType(type, config) {
  if (typeof window === 'undefined') return;
  const all = loadAllConfigs();
  all[type] = config;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function migrateLegacyConfig() {
  if (typeof window === 'undefined') return null;
  try {
    const legacy = localStorage.getItem('technews-chat-provider');
    if (!legacy) return null;
    const parsed = JSON.parse(legacy);
    if (parsed.type && !parsed.openai) {
      saveConfigForType(parsed.type, {
        endpoint: parsed.endpoint,
        apiKey: parsed.apiKey || '',
        model: parsed.model,
        requestFormat: parsed.requestFormat,
        customAuthType: parsed.customAuthType,
      });
      localStorage.removeItem('technews-chat-provider');
    }
  } catch {}
  return null;
}

export default function ChatProviderSettings({ darkMode, onProviderChange }) {
  const [providerType, setProviderType] = useState('openai');
  const [endpoint, setEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // 'ok' | 'error' | null
  const [responseLength, setResponseLength] = useState('balanced');

  // GitHub OAuth state
  const [githubClientId, setGithubClientId] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [githubDeviceCode, setGithubDeviceCode] = useState(null);
  const [githubUserCode, setGithubUserCode] = useState('');
  const [githubVerifyUrl, setGithubVerifyUrl] = useState('');
  const [githubPolling, setGithubPolling] = useState(false);
  const pollIntervalRef = useRef(null);

  // Custom API state
  const [requestFormat, setRequestFormat] = useState('openai');
  const [customAuthType, setCustomAuthType] = useState('none');

  function loadConfigForType(type) {
    const all = loadAllConfigs();
    return all[type] || null;
  }

  // Load saved config on mount
  useEffect(() => {
    migrateLegacyConfig();
    const all = loadAllConfigs();
    const activeType = Object.keys(all).length > 0 ? 'openai' : 'openai';
    const saved = all[activeType];
    if (saved) {
      setProviderType(activeType);
      setEndpoint(saved.endpoint || PRESETS[activeType].endpoint);
      setApiKey(saved.apiKey || '');
      setModel(saved.model || PRESETS[activeType].defaultModel);
      if (saved.requestFormat) setRequestFormat(saved.requestFormat);
      if (saved.customAuthType) setCustomAuthType(saved.customAuthType);
      if (saved.responseLength) setResponseLength(saved.responseLength);
    } else {
      setEndpoint(PRESETS.openai.endpoint);
      setModel(PRESETS.openai.defaultModel);
    }

    // Load GitHub-specific state
    const savedToken = typeof window !== 'undefined' ? localStorage.getItem(GITHUB_TOKEN_KEY) : null;
    const savedClientId = typeof window !== 'undefined' ? localStorage.getItem(GITHUB_CLIENT_ID_KEY) : null;
    if (savedToken) setGithubToken(savedToken);
    if (savedClientId) setGithubClientId(savedClientId);
  }, []);

  // Save and notify parent whenever config changes
  useEffect(() => {
    const preset = PRESETS[providerType];
    const resolvedKey = providerType === 'github' ? githubToken : apiKey;
    const config = {
      endpoint: endpoint || preset.endpoint,
      apiKey: resolvedKey || '',
      model: model || preset.defaultModel,
      requestFormat: providerType === 'custom' ? requestFormat : undefined,
      customAuthType: providerType === 'custom' ? customAuthType : undefined,
      responseLength,
    };
    saveConfigForType(providerType, config);
    if (onProviderChange) onProviderChange({ type: providerType, ...config });
  }, [providerType, endpoint, apiKey, model, githubToken, requestFormat, customAuthType, responseLength]);

  function switchProvider(type) {
    const preset = PRESETS[type];
    const saved = loadConfigForType(type);
    setProviderType(type);
    if (saved) {
      setEndpoint(saved.endpoint || preset.endpoint);
      setApiKey(saved.apiKey || '');
      setModel(saved.model || preset.defaultModel);
      if (saved.requestFormat) setRequestFormat(saved.requestFormat);
      if (saved.customAuthType) setCustomAuthType(saved.customAuthType);
      if (saved.responseLength) setResponseLength(saved.responseLength);
    } else {
      setEndpoint(preset.endpoint);
      setApiKey('');
      setModel(preset.defaultModel);
      if (type === 'custom') {
        setRequestFormat('openai');
        setCustomAuthType('none');
      }
    }
    setTestResult(null);
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const preset = PRESETS[providerType];
      const resolvedKey = providerType === 'github' ? githubToken : apiKey;
      const provider = {
        type: providerType,
        endpoint: endpoint || preset.endpoint,
        apiKey: resolvedKey || '',
        model: model || preset.defaultModel,
        requestFormat: providerType === 'custom' ? requestFormat : undefined,
        authType: providerType === 'custom' ? customAuthType : undefined,
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          messages: [
            { role: 'system', content: 'You are a test assistant. Reply with "OK" only.' },
            { role: 'user', content: 'Test' },
          ],
        }),
      });

      if (res.ok) {
        setTestResult('ok');
      } else {
        setTestResult('error');
      }
    } catch {
      setTestResult('error');
    }
    setTesting(false);
  }

  // --- GitHub OAuth Device Flow ---
  async function startGithubAuth() {
    if (!githubClientId.trim()) return;
    localStorage.setItem(GITHUB_CLIENT_ID_KEY, githubClientId.trim());

    try {
      const res = await fetch('/api/auth/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: githubClientId.trim() }),
      });
      const data = await res.json();

      if (data.user_code && data.device_code) {
        setGithubDeviceCode(data.device_code);
        setGithubUserCode(data.user_code);
        setGithubVerifyUrl(data.verification_uri || 'https://github.com/login/device');
        setGithubPolling(true);
        startPolling(data.device_code, data.interval || 5);
      }
    } catch (err) {
      console.error('GitHub auth error:', err);
    }
  }

  function startPolling(deviceCode, interval) {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/auth/github', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: githubClientId.trim(), deviceCode }),
        });
        const data = await res.json();

        if (data.access_token) {
          setGithubToken(data.access_token);
          localStorage.setItem(GITHUB_TOKEN_KEY, data.access_token);
          setGithubPolling(false);
          setGithubDeviceCode(null);
          setGithubUserCode('');
          clearInterval(pollIntervalRef.current);
        } else if (data.error && data.error !== 'authorization_pending') {
          // Token expired or denied
          setGithubPolling(false);
          clearInterval(pollIntervalRef.current);
        }
      } catch {
        // continue polling
      }
    }, (interval + 1) * 1000);
  }

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const preset = PRESETS[providerType];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Chat Provider</span>
      </div>

      {/* Provider toggle buttons */}
      <div className="flex flex-wrap gap-1.5">
        {PROVIDER_TYPES.map(type => (
          <button
            key={type}
            onClick={() => switchProvider(type)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              providerType === type
                ? 'bg-blue-600 text-white dark:bg-blue-700'
                : 'bg-secondary hover:bg-muted text-muted-foreground dark:bg-accent dark:hover:bg-muted/80'
            }`}
          >
            {PRESETS[type].label}
          </button>
        ))}
      </div>

      {/* Provider-specific config */}
      <div className="space-y-2">
        {/* GitHub OAuth flow */}
        {providerType === 'github' && (
          <div className="space-y-2">
            {!githubToken ? (
              <>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">GitHub OAuth App Client ID</label>
                  <input
                    type="text"
                    value={githubClientId}
                    onChange={(e) => setGithubClientId(e.target.value)}
                    placeholder="Ov23li..."
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs border bg-card border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                {!githubPolling ? (
                  <button
                    onClick={startGithubAuth}
                    disabled={!githubClientId.trim()}
                    className="w-full px-3 py-1.5 rounded-lg text-xs font-medium bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    Sign in with GitHub
                  </button>
                ) : (
                  <div className="p-3 rounded-lg border border-border bg-card text-xs space-y-2">
                    <div className="flex items-center gap-2">
                      <Loader2 size={12} className="animate-spin text-muted-foreground" />
                      <span className="text-muted-foreground">Waiting for authorization...</span>
                    </div>
                    <div>
                      Enter code <span className="font-mono font-bold text-foreground">{githubUserCode}</span> at
                    </div>
                    <a
                      href={githubVerifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 dark:text-blue-300 hover:underline"
                    >
                      {githubVerifyUrl} <ExternalLink size={10} />
                    </a>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <Check size={12} className="text-green-600 dark:text-green-400" />
                <span className="text-muted-foreground">Connected to GitHub</span>
                <button
                  onClick={() => {
                    setGithubToken('');
                    localStorage.removeItem(GITHUB_TOKEN_KEY);
                  }}
                  className="ml-auto text-xs text-destructive hover:underline"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        )}

        {/* API Key input (for OpenAI, Claude) */}
        {preset.authType === 'api-key' && (
          <div>
            <label className="text-xs text-muted-foreground block mb-1">API Key</label>
            <div className="relative">
              <KeyRound size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={providerType === 'claude' ? 'sk-ant-...' : 'sk-...'}
                className="w-full pl-7 pr-8 py-1.5 rounded-lg text-xs border bg-card border-border text-foreground placeholder:text-muted-foreground"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 opacity-70">Key is sent to this server to proxy requests. Use only on trusted/local deployments.</p>
          </div>
        )}

        {/* Endpoint */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Endpoint</label>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder={providerType === 'custom' ? (requestFormat === 'anthropic' ? 'https://api.example.com' : 'https://api.example.com/v1') : preset.endpoint}
            className="w-full px-2.5 py-1.5 rounded-lg text-xs border bg-card border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Custom API options */}
        {providerType === 'custom' && (
          <div className="space-y-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Request Format</label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setRequestFormat('openai')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    requestFormat === 'openai'
                      ? 'bg-blue-600 text-white dark:bg-blue-700'
                      : 'bg-secondary hover:bg-muted text-muted-foreground dark:bg-accent dark:hover:bg-muted/80'
                  }`}
                >
                  OpenAI-compatible
                </button>
                <button
                  type="button"
                  onClick={() => setRequestFormat('anthropic')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    requestFormat === 'anthropic'
                      ? 'bg-blue-600 text-white dark:bg-blue-700'
                      : 'bg-secondary hover:bg-muted text-muted-foreground dark:bg-accent dark:hover:bg-muted/80'
                  }`}
                >
                  Anthropic-compatible
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Auth Type</label>
              <select
                value={customAuthType}
                onChange={(e) => setCustomAuthType(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg text-xs border bg-card border-border text-foreground"
              >
                <option value="none">None</option>
                <option value="bearer">Bearer Token</option>
              </select>
            </div>

            {customAuthType === 'bearer' && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">API Key</label>
                <div className="relative">
                  <KeyRound size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full pl-7 pr-8 py-1.5 rounded-lg text-xs border bg-card border-border text-foreground placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 opacity-70">Key is sent to this server to proxy requests. Use only on trusted/local deployments.</p>
              </div>
            )}
          </div>
        )}

        {/* Model selector */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Model</label>
          {preset.models.length === 0 ? (
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Enter model name..."
              className="w-full px-2.5 py-1.5 rounded-lg text-xs border bg-card border-border text-foreground placeholder:text-muted-foreground"
            />
          ) : (
            <>
              <select
                value={preset.models.includes(model) ? model : '__custom__'}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setModel('');
                  } else {
                    setModel(e.target.value);
                  }
                }}
                className="w-full px-2.5 py-1.5 rounded-lg text-xs border bg-card border-border text-foreground appearance-none"
              >
                {preset.models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
                <option value="__custom__">Custom...</option>
              </select>
              {!preset.models.includes(model) && model !== '' && (
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Enter model name..."
                  className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg text-xs border bg-card border-border text-foreground placeholder:text-muted-foreground"
                />
              )}
            </>
          )}
        </div>

        {/* Response length */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Response Length</label>
          <div className="flex gap-1.5">
            {[
              { value: 'brief', label: 'Brief' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'detailed', label: 'Detailed' }
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setResponseLength(opt.value)}
                className={`flex-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                  responseLength === opt.value
                    ? 'bg-blue-600 text-white dark:bg-blue-700'
                    : 'bg-secondary hover:bg-muted text-muted-foreground dark:bg-accent dark:hover:bg-muted/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Test connection */}
        <button
          onClick={testConnection}
          disabled={testing || (preset.requiresKey && !apiKey && providerType !== 'github') || (providerType === 'github' && !githubToken)}
          className={`w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
            testResult === 'ok'
              ? 'bg-green-100 dark:bg-green-800/30 text-green-800 dark:text-green-100'
              : testResult === 'error'
                ? 'bg-destructive/10 dark:bg-destructive/20 text-destructive'
                : 'bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:bg-blue-700/20 dark:hover:bg-blue-700/30 dark:text-blue-300'
          } disabled:opacity-40`}
        >
          {testing ? (
            <><Loader2 size={12} className="animate-spin" /> Testing...</>
          ) : testResult === 'ok' ? (
            <><Check size={12} /> Connected</>
          ) : testResult === 'error' ? (
            'Connection failed — check settings'
          ) : (
            'Test Connection'
          )}
        </button>

        <p className="text-[10px] text-muted-foreground/60 italic">Settings are saved locally in your browser</p>
      </div>
    </div>
  );
}
