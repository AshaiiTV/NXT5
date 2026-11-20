import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('the saved file points to the current import screen', async () => {
  const html = await readFile(new URL('../src/renderer.html', import.meta.url), 'utf8');
  const result = html.match(/<section id="resultPanel"[\s\S]*?<\/section>/)?.[0];
  assert.match(result, /Parties → Importer une partie → Choisir mon fichier/);
  assert.doesNotMatch(html, /Intégration|Importer un fichier NXT5 local/);
});
