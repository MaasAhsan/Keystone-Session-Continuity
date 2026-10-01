const api = globalThis.browser ?? globalThis.chrome;
const K = globalThis.Keystone;

const packetEl = document.getElementById('packet');
const metaEl = document.getElementById('meta');
const statusEl = document.getElementById('status');
const destsEl = document.getElementById('dests');
const recentEl = document.getElementById('recent');

let tab = null;
let scrape = { messages: [], estimate: null, siteId: null, url: '', live: false };

function setStatus(text) {
  statusEl.textContent = text || '';
}

async function activeTab() {
  const tabs = await api.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function loadSettings() {
  const { includeRecent } = await api.storage.local.get({ includeRecent: true });
  recentEl.checked = includeRecent !== false;
}

async function injectAgent(tabId) {
  if (!api.scripting?.executeScript) return false;
  try {
    await api.scripting.executeScript({
      target: { tabId },
      files: ['shared/sites.js', 'shared/estimate.js', 'shared/packer.js', 'content/content.js'],
    });
    return true;
  } catch {
    return false;
  }
}

async function scrapeTab() {
  if (!tab?.id) return { error: 'no-tab' };
  const ping = async () => {
    try {
      return await api.tabs.sendMessage(tab.id, { type: 'KEYSTONE_SCRAPE' });
    } catch (err) {
      return { error: String(err && err.message ? err.message : err) };
    }
  };
  let res = await ping();
  if (res?.ok) return res;
  const injected = await injectAgent(tab.id);
  if (injected) {
    await new Promise((r) => setTimeout(r, 150));
    res = await ping();
    if (res?.ok) {
      res.injected = true;
      return res;
    }
  }
  return res || { error: 'no-agent' };
}

function renderDests() {
  destsEl.replaceChildren();
  for (const site of K.SITES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = site.label;
    if (site.id === scrape.siteId) b.classList.add('primary');
    b.addEventListener('click', () => continueOn(site.id));
    destsEl.appendChild(b);
  }
}

function packLocal() {
  const site = scrape.siteId ? K.siteById(scrape.siteId) : K.detectSite(scrape.url || tab?.url || '') || {
    id: 'unknown',
    label: 'Source',
  };
  const packet = K.packBaton({
    messages: scrape.messages || [],
    source: site,
    dest: site,
    includeRecent: recentEl.checked,
    recentCount: 8,
  });
  packetEl.value = packet;
  return packet;
}

async function persistPacket(packet) {
  try {
    await api.storage.local.set({
      pendingPacket: packet,
      includeRecent: recentEl.checked,
      lastScrape: {
        messages: scrape.messages || [],
        estimate: scrape.estimate || null,
        url: scrape.url || tab?.url || '',
        at: Date.now(),
      },
    });
  } catch {
    /* storage is optional for a visible rebuild */
  }
}

async function refresh() {
  setStatus('Reading');
  tab = await activeTab();
  const live = await scrapeTab();
  if (live?.ok) {
    scrape = {
      messages: live.messages || [],
      estimate: live.estimate || null,
      siteId: live.siteId || K.detectSite(live.url || tab?.url || '')?.id || null,
      url: live.url || tab?.url || '',
      live: true,
    };
  } else {
    scrape = {
      messages: [],
      estimate: null,
      siteId: K.detectSite(tab?.url || '')?.id || null,
      url: tab?.url || '',
      live: false,
    };
  }

  const site = scrape.siteId ? K.siteById(scrape.siteId) : null;
  const est = scrape.estimate;
  if (site && scrape.live && scrape.messages.length) {
    metaEl.textContent = `${site.label} · ${scrape.messages.length} turns · est. ${est?.tokens || 0} / ${est?.window || site.windowTokens} tokens`;
  } else if (site && scrape.live) {
    metaEl.textContent = `${site.label} is open, but no chat bubbles were readable. Scroll the thread, then Rebuild.`;
  } else if (site && !scrape.live) {
    metaEl.textContent = `${site.label} is open, but Keystone is not on this tab yet. Reload the tab, then Rebuild.`;
  } else {
    metaEl.textContent = 'This tab is not a supported chat. Rebuild still writes a blank baton you can edit.';
  }

  renderDests();
  const packet = packLocal();
  await persistPacket(packet);
  if (scrape.live && scrape.messages.length) setStatus(`Rebuilt · ${scrape.messages.length}`);
  else if (scrape.live) setStatus('Rebuilt · empty');
  else setStatus('Rebuilt · no page hook');
}

async function continueOn(destId) {
  const packet = packetEl.value.trim();
  if (!packet) {
    setStatus('Empty');
    return;
  }
  const dest = K.siteById(destId);
  try {
    await api.runtime.sendMessage({
      type: 'KEYSTONE_SAVE_RELAY',
      packet,
      source: scrape.siteId || 'unknown',
      dest: destId,
      title: dest ? `${dest.label} handoff` : 'Handoff',
    });
  } catch {
    /* continue even if worker is asleep */
  }
  setStatus('Opening');
  try {
    const res = await api.runtime.sendMessage({ type: 'KEYSTONE_INJECT_DEST', destId, packet });
    setStatus(res?.ok ? 'Handed off' : 'Copy instead');
  } catch {
    setStatus('Copy instead');
  }
}

document.getElementById('refresh').addEventListener('click', (e) => {
  e.preventDefault();
  refresh();
});
document.getElementById('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(packetEl.value);
    setStatus('Copied');
  } catch {
    packetEl.select();
    setStatus('Select & copy');
  }
});
document.getElementById('download').addEventListener('click', () => {
  const blob = new Blob([packetEl.value], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'keystone-relay.md';
  a.click();
  URL.revokeObjectURL(url);
  setStatus('Saved file');
});
recentEl.addEventListener('change', async () => {
  const packet = packLocal();
  await persistPacket(packet);
  setStatus('Rebuilt');
});

const canvas = document.getElementById('ascii');
if (globalThis.YTA?.AsciiField && canvas) {
  const field = new YTA.AsciiField(canvas, () => '230,230,230', {
    maxAlpha: 0.18,
    speed: 1.35,
    fps: 20,
  });
  field.start();
}

loadSettings().then(refresh);
