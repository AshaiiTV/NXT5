import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.netlify/functions');
const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const checked = [];
for (const name of ['discord-publish-background', 'team-discord-preview', 'team-discord-test', 'publication-asset']) {
  const entry = manifest.functions.find((item) => item.name === name);
  if (!entry || entry.runtimeVersion !== 'nodejs24.x') throw new Error(`Missing Node 24 function: ${name}`);
  if (name.endsWith('-background') && entry.invocationMode !== 'background') throw new Error(`Wrong invocation mode: ${name}`);
  const zip = path.join(root, name + '.zip');
  const files = execFileSync('unzip', ['-Z', '-1', zip], { encoding: 'utf8' }).trim().split('\n');
  const native = 'node_modules/@napi-rs/canvas-linux-x64-gnu/skia.linux-x64-gnu.node';
  for (const required of [native, 'public/assets/nxt5-wordmark.png', ...[400,500,600,700].map((weight) => `node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff2`)]) {
    if (!files.includes(required)) throw new Error(`${name} is missing ${required}. Build on Linux, or install the matching optional Linux binary before a local draft deployment.`);
  }
  const binary = execFileSync('unzip', ['-p', zip, native], { maxBuffer: 80 * 1024 * 1024 });
  if (binary.subarray(0,4).toString('hex') !== '7f454c46' || binary.readUInt16LE(18) !== 62) throw new Error(`${name}: expected Linux x64 ELF`);
  checked.push({ name, runtime: entry.runtimeVersion, invocationMode: entry.invocationMode, native: 'linux-x64-gnu', nativeBytes: binary.byteLength, fonts: 4, logo: true });
}
mkdirSync('artifacts/discord-render', { recursive: true });
writeFileSync('artifacts/discord-render/bundle-check.json', JSON.stringify({ checkedAt: new Date().toISOString(), checked }, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, checked }, null, 2));
