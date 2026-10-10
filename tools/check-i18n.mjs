import ts from 'typescript';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { sourceFiles } from './i18n-inventory.mjs';

const references = new Map();
for (const file of await sourceFiles('src')) {
  const code = await readFile(file, 'utf8');
  const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, file.endsWith('jsx') ? ts.ScriptKind.JSX : ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 't' && node.arguments[0]) {
      const record = argument => {
        if (ts.isConditionalExpression(argument)) { record(argument.whenTrue); record(argument.whenFalse); }
        if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
          const key = argument.text.trim();
          if (key) references.set(key, [...(references.get(key) || []), `${file}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1}`]);
        }
      };
      record(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
if (process.argv.includes('--inventory')) {
  const file = 'artifacts/i18n-2026-10-10/inventory.json';
  const inventory = JSON.parse(await readFile(file, 'utf8'));
  for (const [key, locations] of references) inventory[key] = locations;
  await writeFile(file, JSON.stringify(inventory, null, 2) + '\n');
  console.log(`Inventoried ${references.size} explicit messages.`);
} else {
  const { messages, loadLanguageMessages } = await import('../src/i18n/translate.js');
  await Promise.all(['en', 'es'].map(loadLanguageMessages));
  const missing = [];
  const invalid = [];
  const slots = value => [...value.matchAll(/\{(\d+)\}/g)].map(match => match[1]).sort().join(',');
  for (const [language, catalogue] of Object.entries(messages)) {
    for (const [key, locations] of references) if (!Object.hasOwn(catalogue, key)) missing.push({ language, key, location: locations[0] });
    for (const [key, translation] of Object.entries(catalogue)) {
      if (typeof translation !== 'string' || !translation.trim() || slots(key) !== slots(translation)) invalid.push({ language, key, translation });
    }
  }
  if (missing.length || invalid.length) {
    await mkdir('artifacts/i18n-2026-10-10', { recursive: true });
    await writeFile('artifacts/i18n-2026-10-10/catalogue-issues.json', JSON.stringify({ missing, invalid }, null, 2) + '\n');
    console.error(`${missing.length} missing messages; ${invalid.length} invalid translations. See artifacts/i18n-2026-10-10/catalogue-issues.json.`);
    process.exitCode = 1;
  } else console.log(`i18n: ${references.size} explicit messages covered in English and Spanish; all placeholders valid.`);
}
