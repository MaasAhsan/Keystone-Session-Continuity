# Keystone

Corporate session continuity for AI chats.

Keystone reads the **visible thread** on a supported chat site, packs a compact [Broken Telephone](docs/protocol.md) baton, and pastes it into a new chat on the same site or another model.

No extra model call. No Keystone server. Chat text never leaves the browser.

## Features

- Compact handoff packet (goal, done, next action, last 8 turns)
- In-page chip with a local token **estimate**
- One quiet banner at ~85% estimated fullness — never auto-sends
- Continue on ChatGPT, Claude, Gemini, Grok, Perplexity, DeepSeek, Mistral, or Copilot
- Chromium and Firefox builds from one source tree

## Install from source

```bash
git clone <this-repo>
cd keystone-session-continuity
npm run build
```

**Chrome / Edge / Brave:** `chrome://extensions` → Developer mode → Load unpacked → `dist/chromium`

**Firefox 128+:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `dist/firefox/manifest.json`

Reload the chat tab after installing. Tabs that were already open do not get the content script until they reload (Rebuild will try to inject one).

## Use

1. Open a supported chat and work as usual.
2. Click the toolbar icon or the corner chip.
3. **Rebuild** writes the baton into the box.
4. Copy, download `.md`, or pick a destination under Continue on.

If inject misses a custom editor, use Copy.

## Supported sites

| Site | Hosts |
|---|---|
| ChatGPT | chatgpt.com, chat.openai.com |
| Claude | claude.ai |
| Gemini | gemini.google.com |
| Grok | grok.com, grok.x.ai, x.com/i/grok |
| Perplexity | perplexity.ai |
| DeepSeek | chat.deepseek.com |
| Mistral | chat.mistral.ai, vibe.mistral.ai |
| Copilot | copilot.microsoft.com |

## Develop

```bash
npm test          # packer + site detection
npm run build     # dist/chromium and dist/firefox
npm run pack      # release zip of both builds
```

Layout:

```
src/
  background/     service worker / Firefox event page
  content/        scrape, chip, inject
  popup/          toolbar UI
  shared/         sites, packer, estimate, ASCII field
  icons/          16 / 32 / 48 / 128
extension.config.json
build.mjs
```

Edit `src/` and `extension.config.json`, then `npm run build`. Load `dist/…` unpacked. Bump `version` in `extension.config.json` so browsers notice an update.

## Privacy

- Reads visible message text on pages you already have open
- Stores the last 20 relays in `chrome.storage.local` on your machine
- No analytics, accounts, or remote endpoints owned by this project
- Host permissions are only the chat sites listed above

## Limits

- Token percent is `characters / 4` against a preset window. Not the vendor meter.
- Scrapers follow each site’s DOM and will drift. Empty scrape fails closed.
- Attachments are noted, not transferred.
- Does not run in Claude Code, Cursor, or other non-browser apps.

## License

MIT. See [LICENSE](LICENSE).
