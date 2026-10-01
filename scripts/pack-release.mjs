import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'release');
const out = path.join(outDir, 'keystone-session-continuity.zip');

await mkdir(outDir, { recursive: true });
await rm(out, { force: true });

const py = `
import zipfile
from pathlib import Path
root = Path(${JSON.stringify(path.join(root, 'dist'))})
out = Path(${JSON.stringify(out)})
readme = """Keystone — Chromium + Firefox unpacked builds

CHROMIUM / EDGE / BRAVE
chrome://extensions → Developer mode → Load unpacked → chromium/

FIREFOX 128+
about:debugging#/runtime/this-firefox → Load Temporary Add-on → firefox/manifest.json
"""
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('README.txt', readme)
    for browser in ('chromium', 'firefox'):
        base = root / browser
        for p in base.rglob('*'):
            if p.is_file():
                z.write(p, f'{browser}/{p.relative_to(base)}')
print(out)
`;

const res = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
if (res.status !== 0) {
  console.error(res.stderr || res.stdout);
  process.exit(res.status || 1);
}
console.log(res.stdout.trim());
