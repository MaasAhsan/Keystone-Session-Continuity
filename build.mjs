// Builds one source tree into per-browser folders:  node build.mjs
//   dist/chromium  (Chrome, Edge, Brave, Opera)   dist/firefox
// Only the manifest differs between targets. Safari: convert dist/chromium with
// `xcrun safari-web-extension-converter dist/chromium` (macOS + Xcode).
import { cp, mkdir, readFile, rm, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');
const cfg = JSON.parse(await readFile(path.join(root, 'extension.config.json'), 'utf8'));
const exists = (p) => access(p).then(() => true, () => false);

const icons = {};
for (const n of [16, 32, 48, 128]) if (await exists(path.join(src, 'icons', `icon-${n}.png`))) icons[n] = `icons/icon-${n}.png`;
const hasIcons = Object.keys(icons).length > 0;

const base = {
  manifest_version: 3,
  name: cfg.name,
  short_name: cfg.short_name,
  version: cfg.version,
  description: cfg.description,
  ...(hasIcons ? { icons } : {}),
  ...(cfg.popup
    ? { action: { default_title: cfg.short_name || cfg.name, default_popup: 'popup/popup.html', ...(hasIcons ? { default_icon: icons } : {}) } }
    : { action: {} }), // chrome.action.* is undefined without an "action" key
  permissions: cfg.permissions,
  host_permissions: cfg.host_permissions,
  ...(cfg.optional_host_permissions?.length ? { optional_host_permissions: cfg.optional_host_permissions } : {}),
  ...(cfg.content
    ? { content_scripts: [{ matches: cfg.matches, js: [...(cfg.content_shared || []), 'content/content.js'], run_at: 'document_idle' }] }
    : {}),
};

const shared = cfg.shared_background_scripts || [];
const targets = {
  chromium: {
    ...base,
    minimum_chrome_version: cfg.minimum_chrome_version,
    ...(cfg.background ? { background: { service_worker: 'background/background.js' } } : {}),
  },
  firefox: {
    ...base,
    ...(cfg.background ? { background: { scripts: [...shared, 'background/background.js'] } } : {}),
    browser_specific_settings: { gecko: { id: cfg.gecko_id, strict_min_version: cfg.firefox_min_version } },
  },
};

await rm(dist, { recursive: true, force: true });
for (const [name, manifest] of Object.entries(targets)) {
  const out = path.join(dist, name);
  await mkdir(out, { recursive: true });
  await cp(src, out, { recursive: true });
  await writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('built', path.relative(root, out));
}
