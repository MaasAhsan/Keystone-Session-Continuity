/* Keystone page agent: scrape, chip, banner, inject. */
(() => {
  if (globalThis.__KEYSTONE_LOADED) return;
  globalThis.__KEYSTONE_LOADED = true;
  const api = globalThis.browser ?? globalThis.chrome;
  const K = globalThis.Keystone;
  if (!K) return;

  const HOST_ID = 'keystone-root';
  const THRESHOLD = 0.85;
  let lastUrl = location.href;
  let naggedFor = '';
  let lastMessages = [];
  let lastEstimate = { tokens: 0, window: 128000, ratio: 0, percent: 0 };

  function textOf(el) {
    if (!el) return '';
    const raw = (el.innerText || el.textContent || '').replace(/\s+\n/g, '\n').trim();
    return raw;
  }

  function roleFromText(s) {
    const t = s.toLowerCase();
    if (/^(you|user|human)\b/.test(t)) return 'user';
    if (/^(assistant|chatgpt|claude|gemini|grok|perplexity|deepseek|mistral|copilot|bot)\b/.test(t)) return 'assistant';
    return null;
  }

  function scrapeByRoleAttr() {
    const nodes = document.querySelectorAll(
      '[data-message-author-role], [data-role], [data-author-role], [data-testid="conversation-turn"]',
    );
    const out = [];
    for (const node of nodes) {
      const roleAttr = (
        node.getAttribute('data-message-author-role') ||
        node.getAttribute('data-role') ||
        node.getAttribute('data-author-role') ||
        ''
      ).toLowerCase();
      let role = null;
      if (roleAttr.includes('user') || roleAttr.includes('human')) role = 'user';
      else if (roleAttr.includes('assistant') || roleAttr.includes('bot') || roleAttr.includes('model')) role = 'assistant';
      if (!role) {
        const testid = (node.getAttribute('data-testid') || '').toLowerCase();
        if (testid.includes('user')) role = 'user';
        else if (testid.includes('assistant') || testid.includes('bot')) role = 'assistant';
      }
      const body =
        node.querySelector('.markdown, .prose, [data-message-content], .message-content') || node;
      const text = textOf(body);
      if (!text || text.length < 2) continue;
      if (!role) role = out.length % 2 === 0 ? 'user' : 'assistant';
      const attachmentsNoted = !!(node.querySelector('img, video, a[download], [data-testid*="file"], [class*="attachment"]'));
      out.push({ role, text, attachmentsNoted });
    }
    return out;
  }

  function scrapeLabeledTurns() {
    const candidates = document.querySelectorAll('article, [class*="message"], [class*="Message"], [class*="turn"]');
    const out = [];
    for (const node of candidates) {
      if (node.querySelector('article, [class*="message"]')) continue;
      const heading = textOf(node.querySelector('h1, h2, h3, header, [class*="author"], [class*="sender"]')).slice(0, 40);
      const role = roleFromText(heading) || (out.length % 2 === 0 ? 'user' : 'assistant');
      const text = textOf(node);
      if (text.length < 8) continue;
      out.push({ role, text, attachmentsNoted: !!node.querySelector('img[src], [class*="attachment"]') });
    }
    return out;
  }

  function scrapeMessages() {
    const a = scrapeByRoleAttr();
    if (a.length >= 1) return a;
    const b = scrapeLabeledTurns();
    if (b.length >= 1) return b;
    return [];
  }

  function findComposer() {
    const ta = document.querySelector('textarea');
    if (ta && !ta.disabled && ta.offsetParent !== null) return ta;
    const editables = [...document.querySelectorAll('[contenteditable="true"]')];
    const visible = editables.find((el) => el.offsetParent !== null || el.getClientRects().length);
    return visible || editables[0] || null;
  }

  function setComposer(text) {
    const el = findComposer();
    if (!el) return false;
    el.focus();
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(el, text);
      else el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    try {
      document.execCommand('selectAll', false, null);
      const ok = document.execCommand('insertText', false, text);
      if (ok) return true;
    } catch (_) {
      /* fall through */
    }
    el.textContent = text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
    return true;
  }

  function ensureUi() {
    let host = document.getElementById(HOST_ID);
    if (host) return host.shadowRoot;
    host = document.createElement('div');
    host.id = HOST_ID;
    document.documentElement.appendChild(host);
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; font-family: "IBM Plex Sans", "Segoe UI", sans-serif; }
        .chip, .banner {
          position: fixed; z-index: 2147483646; color: #e8e8e8;
          background: #111; border: 1px solid #3a3a3a;
        }
        .chip {
          right: 16px; bottom: 16px; min-height: 44px; padding: 0 12px;
          display: flex; align-items: center; gap: 8px;
          font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
          cursor: default;
        }
        .chip button, .banner button {
          min-height: 32px; padding: 0 10px; border: 1px solid #6a6a6a;
          background: #1a1a1a; color: #f2f2f2; cursor: pointer; letter-spacing: 0.06em;
          text-transform: uppercase; font-size: 10px;
        }
        .chip button:focus, .banner button:focus { outline: 2px solid #fff; outline-offset: 2px; }
        .banner {
          left: 50%; bottom: 72px; transform: translateX(-50%);
          max-width: 420px; width: calc(100vw - 24px);
          padding: 12px 14px; display: none; gap: 10px; align-items: center;
          font-size: 13px; letter-spacing: 0.01em;
        }
        .banner.show { display: flex; }
        .muted { color: #a0a0a0; }
      </style>
      <div class="chip" role="status">
        <span id="est">Keystone</span>
        <button type="button" id="save">Save baton</button>
      </div>
      <div class="banner" id="banner" role="status">
        <span id="bannerText">Window looks tight. Save a baton?</span>
        <button type="button" id="bannerSave">Save</button>
        <button type="button" id="bannerDismiss">Dismiss</button>
      </div>
    `;
    root.getElementById('save').addEventListener('click', () => openPopupSave());
    root.getElementById('bannerSave').addEventListener('click', () => openPopupSave());
    root.getElementById('bannerDismiss').addEventListener('click', () => {
      root.getElementById('banner').classList.remove('show');
    });
    host.addEventListener('keydown', (e) => e.stopPropagation());
    return root;
  }

  function openPopupSave() {
    api.runtime.sendMessage({ type: 'KEYSTONE_PREPARE', messages: lastMessages, estimate: lastEstimate, url: location.href });
    try {
      api.runtime.sendMessage({ type: 'KEYSTONE_OPEN_POPUP' });
    } catch (_) {
      /* popup user-gesture limit */
    }
  }

  function refresh() {
    const site = K.detectSite(location.href);
    const root = ensureUi();
    lastMessages = scrapeMessages();
    lastEstimate = K.estimateThread(lastMessages, site?.windowTokens || 128000);
    const label = site ? site.label : 'Chat';
    const est = root.getElementById('est');
    if (est) {
      est.textContent =
        lastMessages.length === 0
          ? `Keystone · ${label}`
          : `${label} · est. ${lastEstimate.tokens} / ${lastEstimate.window}`;
    }
    api.runtime.sendMessage({
      type: 'KEYSTONE_STATUS',
      siteId: site?.id || null,
      estimate: lastEstimate,
      messageCount: lastMessages.length,
      url: location.href,
    }).catch(() => {});

    const key = location.href.split('?')[0];
    if (lastEstimate.ratio >= THRESHOLD && lastMessages.length && naggedFor !== key) {
      naggedFor = key;
      root.getElementById('banner').classList.add('show');
    }
  }

  api.runtime.onMessage.addListener((msg, sender) => {
    if (sender?.id && sender.id !== api.runtime.id) return;
    if (msg?.type === 'KEYSTONE_SCRAPE') {
      lastMessages = scrapeMessages();
      const site = K.detectSite(location.href);
      lastEstimate = K.estimateThread(lastMessages, site?.windowTokens || 128000);
      return Promise.resolve({
        ok: true,
        messages: lastMessages,
        estimate: lastEstimate,
        siteId: site?.id || null,
        url: location.href,
      });
    }
    if (msg?.type === 'KEYSTONE_INJECT') {
      const ok = setComposer(String(msg.packet || ''));
      return Promise.resolve({ ok });
    }
    if (msg?.type === 'KEYSTONE_PING') {
      return Promise.resolve({ ok: true, url: location.href });
    }
  });

  ensureUi();
  refresh();
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      naggedFor = naggedFor; // keep once-per-path
    }
    refresh();
  }, 2500);

  api.runtime.sendMessage({ type: 'KEYSTONE_READY', url: location.href }).catch(() => {});
})();
