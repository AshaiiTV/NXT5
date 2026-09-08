import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Reuse the exact reviewed generator displayed by the application. Bundle its
// JSX dependency graph in memory: no browser, requests, or generated public file.
export async function loadReviewBackfillGenerator() {
  const result = await build({
    stdin: {
      contents: 'export { buildRetroactiveCoachContent, stripGeneratedReportContent, reportMatchIds } from "./src/pages/workspace/GameWorkspace.jsx";',
      resolveDir: fileURLToPath(new URL('../', import.meta.url)),
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    treeShaking: true,
    loader: { '.css': 'empty' },
    define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent',
  });
  const module = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
  return {
    generateContent: module.buildRetroactiveCoachContent,
    stripGeneratedContent: module.stripGeneratedReportContent,
    getMatchIds: module.reportMatchIds,
  };
}
