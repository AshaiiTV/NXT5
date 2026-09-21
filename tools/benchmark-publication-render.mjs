import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { buildGamePublicationSnapshot } from '../shared/publications/game-publication.js';
import { publicationFixture } from '../shared/publications/fixtures.js';
import { renderGamePublicationPng } from '../netlify/functions/_lib/publication-render.ts';
const output = path.resolve(process.argv[2] || 'artifacts/discord-render');
await mkdir(output, { recursive: true });
const records = [];
for (const [name, options] of [['complete', {}], ['missing-timeline', { timeline: false }], ['long-incomplete', { timeline: false, longNames: true, incomplete: true }], ['red-side', { side: 'red' }], ['facts-only', { includeHints: false }]]) {
  const start = performance.now();
  const snapshot = buildGamePublicationSnapshot(publicationFixture(options));
  const result = await renderGamePublicationPng(snapshot, { includeHints: options.includeHints });
  const record = { fixture: name, milliseconds: Math.round(performance.now() - start), bytes: result.bytes.length, width: result.width, height: result.height, rssMiB: Math.round(process.memoryUsage().rss / 1024 / 1024) };
  records.push(record);
  await writeFile(path.join(output, `${name}.png`), result.bytes);
  await writeFile(path.join(output, `${name}.json`), JSON.stringify(snapshot, null, 2));
}
await writeFile(path.join(output, 'benchmark.json'), JSON.stringify({ runtime: process.version, platform: `${process.platform}/${process.arch}`, note: 'Synthetic fixtures; local measurements, not a Netlify production SLA.', records }, null, 2));
console.log(JSON.stringify({ output, records }, null, 2));
