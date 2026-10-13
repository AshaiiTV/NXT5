// Bundles the site's real glass-scene.js (unchanged source) into a headless harness that lets the
// video renderer set the sculpture pose explicitly and render one frame on demand.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const scene = path.join(repo, 'src/pages/home/glass-scene.js');
const ANCHOR = '    applyPose();\n    resize();\n';
const HOOK = `    globalThis.__glass = {
      render(pose) {
        sculpture.rotation.set(...pose.rotation);
        sculpture.position.set(...pose.position);
        renderer.render(scene, camera);
      },
      resize,
    };
`;

await build({
  entryPoints: [path.join(here, 'harness.js')],
  bundle: true,
  format: 'esm',
  outfile: path.join(here, 'dist/harness.js'),
  nodePaths: [path.join(here, '../node_modules')],
  plugins: [{
    name: 'expose-glass',
    setup(b) {
      b.onLoad({ filter: /glass-scene\.js$/ }, () => {
        const src = readFileSync(scene, 'utf8');
        if (!src.includes(ANCHOR)) throw new Error('glass-scene.js anchor not found: update the harness hook');
        return { contents: src.replace(ANCHOR, ANCHOR + HOOK), loader: 'js', resolveDir: path.dirname(scene) };
      });
    },
  }],
  logLevel: 'warning',
});
console.log('built glass/dist/harness.js');
