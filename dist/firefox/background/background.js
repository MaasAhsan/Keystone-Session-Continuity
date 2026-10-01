// Keystone background. No durable in-memory state across idle kills except in-flight maps rebuilt from storage.
const _importScripts = globalThis['importScripts'];
if (typeof _importScripts === 'function') {
  _importScripts('../shared/sites.js', '../shared/packer.js');
}

const api = globalThis.browser ?? globalThis.chrome;
const K = globalThis.Keystone || {};

const DEFAULTS = {
  includeRecent: true,
  recentCount: 8,
  relays: [],
  pendingPacket: '',
  lastScrape: null,
};

async function getState() {
  const data = await api.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...data };
}

async function setState(patch) {
  await api.storage.local.set(patch);
}

function badgeText(estimate) {
  if (!estimate || !estimate.percent) return '';
  return String(Math.min(99, estimate.percent));
}

api.runtime.onInstalled.addListener(async () => {
  const cur = await api.storage.local.get(['includeRecent', 'recentCount']);
  if (cur.includeRecent === undefined) await api.storage.local.set({ includeRecent: true, recentCount: 8, relays: [] });
});

api.runtime.onMessage.addListener((msg, sender) => {
  if (sender?.id && sender.id !== api.runtime.id) return;
  if (msg?.type === 'KEYSTONE_STATUS') {
    const text = badgeText(msg.estimate);
    if (sender.tab?.id != null) {
      api.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#111111' });
      api.action.setBadgeText({ tabId: sender.tab.id, text });
    }
    return Promise.resolve({ ok: true });
  }
  if (msg?.type === 'KEYSTONE_PREPARE') {
    return setState({ lastScrape: { messages: msg.messages, estimate: msg.estimate, url: msg.url, at: Date.now() } }).then(
      () => ({ ok: true }),
    );
  }
  if (msg?.type === 'KEYSTONE_OPEN_POPUP') {
    if (api.action.openPopup) {
      return api.action.openPopup().then(
        () => ({ ok: true }),
        () => ({ ok: false, reason: 'popup-gesture' }),
      );
    }
    return Promise.resolve({ ok: false });
  }
  if (msg?.type === 'KEYSTONE_PACK') {
    return packNow(msg).then((packet) => ({ ok: true, packet }));
  }
  if (msg?.type === 'KEYSTONE_SAVE_RELAY') {
    return saveRelay(msg).then((relays) => ({ ok: true, relays }));
  }
  if (msg?.type === 'KEYSTONE_INJECT_DEST') {
    return injectDest(msg).then((r) => r);
  }
  if (msg?.type === 'KEYSTONE_READY') {
    return consumePending(sender.tab?.id, msg.url).then((r) => r);
  }
});

async function packNow(msg) {
  const state = await getState();
  const source = (K.detectSite && K.detectSite(msg.url || state.lastScrape?.url || '')) || {
    id: 'unknown',
    label: msg.sourceLabel || 'Source',
  };
  const dest = (K.siteById && K.siteById(msg.destId)) || { id: 'next', label: msg.destLabel || 'next AI' };
  const messages = msg.messages || state.lastScrape?.messages || [];
  const packet = K.packBaton({
    messages,
    source,
    dest,
    includeRecent: state.includeRecent !== false,
    recentCount: state.recentCount || 8,
  });
  await setState({ pendingPacket: packet });
  return packet;
}

async function saveRelay(msg) {
  const state = await getState();
  const item = {
    id: `r-${Date.now()}`,
    createdAt: new Date().toISOString(),
    source: msg.source || 'unknown',
    dest: msg.dest || 'next',
    title: String(msg.title || 'Relay').slice(0, 80),
    packet: msg.packet || state.pendingPacket || '',
  };
  const relays = [item, ...(state.relays || [])].slice(0, 20);
  await setState({ relays, pendingPacket: item.packet });
  return relays;
}

async function injectDest(msg) {
  const dest = K.siteById ? K.siteById(msg.destId) : null;
  if (!dest) return { ok: false, reason: 'unknown-dest' };
  const packet = msg.packet || (await getState()).pendingPacket;
  if (!packet) return { ok: false, reason: 'empty-packet' };
  await setState({ pendingInject: { packet, destId: dest.id, createdAt: Date.now() } });
  const tab = await api.tabs.create({ url: dest.newChatUrl, active: true });
  return { ok: true, tabId: tab.id };
}

async function consumePending(tabId, url) {
  const { pendingInject } = await api.storage.local.get(['pendingInject']);
  if (!pendingInject || !tabId) return { ok: false };
  const dest = K.siteById ? K.siteById(pendingInject.destId) : null;
  const site = K.detectSite ? K.detectSite(url || '') : null;
  if (dest && site && dest.id !== site.id) return { ok: false };
  const started = Date.now();
  while (Date.now() - started < 8000) {
    try {
      const res = await api.tabs.sendMessage(tabId, { type: 'KEYSTONE_INJECT', packet: pendingInject.packet });
      if (res?.ok) {
        await api.storage.local.remove('pendingInject');
        return { ok: true };
      }
    } catch (_) {
      /* content script not ready */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return { ok: false, reason: 'inject-timeout' };
}
