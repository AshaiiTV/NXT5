import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('the saved file points to the current import screen', async () => {
  const html = await readFile(new URL('../src/renderer.html', import.meta.url), 'utf8');
  const result = html.match(/<section id="resultPanel"[\s\S]*?<\/section>/)?.[0];
  assert.match(result, /Choisis ce fichier JSON dans NXT5 pour l’ajouter à ton équipe\./);
  assert.match(result, /<button\b[^>]*\bdata-open-import\b[^>]*>Importer dans NXT5/);
  assert.match(html, /<button\b[^>]*\btype="button"[^>]*\bdata-open-link\b[^>]*>Obtenir un code sur NXT5/);
  assert.doesNotMatch(html, /Intégration|Importer un fichier NXT5 local/);
});
