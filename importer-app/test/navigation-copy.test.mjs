import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('T3-G6 uses current import navigation in both export instructions', async () => {
  const html = await readFile(new URL('../src/renderer.html', import.meta.url), 'utf8');
  assert.equal(html.split('Parties → Importer une partie → Choisir mon fichier').length - 1, 2);
  assert.doesNotMatch(html, /Intégration|Importer un fichier NXT5 local/);
});
