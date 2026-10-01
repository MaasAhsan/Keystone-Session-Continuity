import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['sites.js', 'estimate.js', 'packer.js']) {
  const code = fs.readFileSync(path.join(root, 'src/shared', f), 'utf8');
  const wrapped = new Function(code);
  wrapped();
}
const K = globalThis.Keystone;

assert.equal(K.detectSite('https://chatgpt.com/c/abc').id, 'chatgpt');
assert.equal(K.detectSite('https://www.chatgpt.com/').id, 'chatgpt');
assert.equal(K.detectSite('https://grok.x.ai/').id, 'grok');
assert.equal(K.detectSite('https://chat.deepseek.com/').id, 'deepseek');
assert.equal(K.detectSite('https://www.perplexity.ai/search/foo').id, 'perplexity');
assert.equal(K.detectSite('https://copilot.microsoft.com/').id, 'copilot');
assert.equal(K.detectSite('https://chat.mistral.ai/chat').id, 'mistral');
assert.equal(K.detectSite('https://example.com/'), null);
assert.equal(K.SITES.length, 8);

const packet = K.packBaton({
  source: { id: 'chatgpt', label: 'ChatGPT' },
  dest: { id: 'claude', label: 'Claude' },
  messages: [
    { role: 'user', text: 'Write a six-section library briefing.' },
    { role: 'assistant', text: 'Outline drafted. Sections 1-3 done.' },
    { role: 'user', text: 'Add two citations to section 3.' },
  ],
});
assert.match(packet, /BROKEN TELEPHONE/);
assert.match(packet, /library briefing/);
assert.match(packet, /Add two citations/);
assert.match(packet, /### Next action/);
assert.ok(packet.length < 8000);

const est = K.estimateThread([{ role: 'user', text: 'abcd'.repeat(100) }], 1000);
assert.equal(est.tokens, 100);
assert.equal(est.percent, 10);

console.log('ok', K.SITES.map((s) => s.id).join(','));
