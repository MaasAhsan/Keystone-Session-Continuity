/* Keystone site registry. Loaded in content, popup, and background. */
(() => {
  const K = (globalThis.Keystone = globalThis.Keystone || {});

  K.SITES = [
    {
      id: 'chatgpt',
      label: 'ChatGPT',
      windowTokens: 128000,
      newChatUrl: 'https://chatgpt.com/',
      hosts: ['chatgpt.com', 'www.chatgpt.com', 'chat.openai.com'],
    },
    {
      id: 'claude',
      label: 'Claude',
      windowTokens: 200000,
      newChatUrl: 'https://claude.ai/new',
      hosts: ['claude.ai'],
    },
    {
      id: 'gemini',
      label: 'Gemini',
      windowTokens: 128000,
      newChatUrl: 'https://gemini.google.com/app',
      hosts: ['gemini.google.com'],
    },
    {
      id: 'grok',
      label: 'Grok',
      windowTokens: 128000,
      newChatUrl: 'https://grok.com/',
      hosts: ['grok.com', 'grok.x.ai'],
      pathIncludes: ['/i/grok'],
    },
    {
      id: 'perplexity',
      label: 'Perplexity',
      windowTokens: 128000,
      newChatUrl: 'https://www.perplexity.ai/',
      hosts: ['www.perplexity.ai', 'perplexity.ai'],
    },
    {
      id: 'deepseek',
      label: 'DeepSeek',
      windowTokens: 128000,
      newChatUrl: 'https://chat.deepseek.com/',
      hosts: ['chat.deepseek.com'],
    },
    {
      id: 'mistral',
      label: 'Mistral',
      windowTokens: 128000,
      newChatUrl: 'https://chat.mistral.ai/chat',
      hosts: ['chat.mistral.ai', 'vibe.mistral.ai'],
    },
    {
      id: 'copilot',
      label: 'Copilot',
      windowTokens: 128000,
      newChatUrl: 'https://copilot.microsoft.com/',
      hosts: ['copilot.microsoft.com'],
    },
  ];

  K.detectSite = function detectSite(href) {
    let url;
    try {
      url = new URL(href);
    } catch {
      return null;
    }
    const host = url.hostname.replace(/^www\./, '');
    for (const site of K.SITES) {
      const hosts = site.hosts.map((h) => h.replace(/^www\./, ''));
      if (hosts.includes(host) || hosts.includes(url.hostname)) return site;
      if (site.pathIncludes && host === 'x.com' && site.pathIncludes.some((p) => url.pathname.startsWith(p))) {
        return site;
      }
    }
    return null;
  };

  K.siteById = function siteById(id) {
    return K.SITES.find((s) => s.id === id) || null;
  };
})();
