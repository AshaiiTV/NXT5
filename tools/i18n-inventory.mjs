import ts from 'typescript';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

// Inventory only static product copy. No API responses, account data or source
// code is included in the translation catalogue.
export function technicalCopyReason(text) {
  const value = text.trim();
  // Match SQL syntax, not isolated words such as the UI action “Update”.
  if (/^(?:select\s+(?:[\s\S]*\bfrom\b|[\s\S]*\(|\d|\*)|insert\s+into\b|update\s+[\w.$"]+(?:\s+(?:as\s+)?[\w"]+)?\s+set\b|delete\s+from\b|with\s+[\w"]+(?:\s*\([^)]*\))?\s+as\b|(?:create|alter|drop)\s+(?:table|index|type|function|extension|policy)\b)/i.test(value)) return 'sql';
  if (/^(?:[a-z][\w-]*)?\[(?:data-|aria-|role\b|tabindex\b|href\b|open\b)/.test(value)
    || /^(?:button|input|a|select|textarea|dialog)(?:\[[^\]]*\]|:[\w():-]+)?(?:\s*,\s*(?:button|input|a|select|textarea|dialog|\[)[\s\S]*)$/.test(value)) return 'selector';
  // Two or more CSS tokens plus a known CSS prefix; hyphenated prose is copy.
  if (/(?:^|\s)(?:m[trblxy]?-|p[trblxy]?-|w-|h-|min-|max-|object-|pointer-|inset-|z-|space-|divide-|ring-|from-|via-|to-|nxt5-|discord-|ig-|matchup-|profile-|draft-|trends-|block-comparison-|as-|admin-|audience-|bot-|community-announcement-|purchase-|pricing-|ih-|games-|team-management-|team-roster-|fixed\b|absolute\b|relative\b|block\b)/.test(value)
    && /^(?:\S+-\S+|\{\d+\}|hidden|fixed|absolute|relative|isolate|flex|grid|inline|block|truncate)(?:\s+(?:\S+-\S+|\{\d+\}|hidden|fixed|absolute|relative|isolate|flex|grid|inline|block|truncate))+$/.test(value)) return 'css-classes';
  if (/^\{\d+\}-(?:ally|title) \{\d+\}-(?:enemy|description)$/.test(value)) return 'element-ids';
  if (/^\[[a-z][a-z.:-]*\](?:$|\s)/.test(value)) return 'log-prefix';
  return null;
}

export function technicalCopyContext(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isJsxAttribute(parent)) return parent.name.getText() === 'className' ? 'className-attribute' : null;
    if (ts.isCallExpression(parent)) {
      if (ts.isPropertyAccessExpression(parent.expression)) {
        const { expression, name } = parent.expression;
        if (['querySelector', 'querySelectorAll', 'closest', 'matches'].includes(name.text) && parent.arguments[0]?.pos <= node.pos && parent.arguments[0]?.end >= node.end) return 'selector-call';
        if (expression.getText() === 'console') return 'console-call';
      }
      return null;
    }
    if (ts.isStatement(parent)) return null;
  }
  return null;
}

export function isCopy(text) {
  const value = text.trim();
  if (technicalCopyReason(value)) return false;
  if (!/[A-Za-zÀ-ÿ]{2}/.test(value) || value.length > 12000) return false;
  if (/^(?:https?:|\/|\.|#|data:|image\/|application\/|video\/|--)/.test(value)) return false;
  if (/[<>]|=>|\b(?:SELECT|INSERT|UPDATE|CREATE|ALTER|DELETE|DROP)\b/.test(value)) return false;
  if (/(?:^|\s)(?:nxt5-|bg-|text-|rounded-|border-|px-|py-|sm:|md:|lg:|hover:|focus:|grid-|flex-|items-|justify-|gap-|font-|h-\d|w-\d)/.test(value)) return false;
  if (/\.(?:png|jpe?g|webp|svg|json|css|js|exe|dmg|zip|woff2?)\b/i.test(value) && !/\s/.test(value)) return false;
  if (/^[a-zA-Z0-9_.:/#?=&%{}@-]+$/.test(value) && !/^[A-ZÀ-Ý][a-zà-ÿ]+$/.test(value)) return false;
  if (/^[\w-]+\([\w\W]*\)$/.test(value) || /^\d/.test(value) && !/\s/.test(value)) return false;
  return true;
}

export function jsxText(text) {
  const lines = text.split(/\r\n|\n|\r/);
  let last = 0;
  for (let i = 0; i < lines.length; i++) if (/[^ \t]/.test(lines[i])) last = i;
  return lines.map((line, i) => {
    let part = line.replace(/\t/g, ' ');
    if (i) part = part.replace(/^ +/, '');
    if (i !== lines.length - 1) part = part.replace(/ +$/, '');
    return part && i !== last ? part + ' ' : part;
  }).join('');
}

export async function sourceFiles(root) {
  const files = [];
  for (const item of await readdir(root, { withFileTypes: true })) {
    if (['__tests__', 'i18n', 'node_modules'].includes(item.name)) continue;
    const path = join(root, item.name);
    if (item.isDirectory()) files.push(...await sourceFiles(path));
    else if (/\.(jsx?|tsx?)$/.test(path)) files.push(path.replaceAll('\\', '/'));
  }
  return files;
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/i18n-inventory.mjs')) {
  const entries = new Map();
  const files = [...await sourceFiles('src'), ...await sourceFiles('shared'), ...await sourceFiles('netlify/functions')];
  for (const file of files) {
    const code = await readFile(file, 'utf8');
    const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, file.endsWith('jsx') ? ts.ScriptKind.JSX : file.endsWith('tsx') ? ts.ScriptKind.TSX : file.endsWith('ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
    function visit(node) {
      let value;
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) value = node.text;
      else if (ts.isJsxText(node)) value = jsxText(node.text);
      else if (ts.isTemplateExpression(node)) value = node.head.text + node.templateSpans.map((span, index) => `{${index}}${span.literal.text}`).join('');
      if (value && isCopy(value) && !technicalCopyContext(node)) {
        value = value.trim();
        if (!entries.has(value)) entries.set(value, []);
        entries.get(value).push(`${file}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  await mkdir('artifacts/i18n-2026-10-10', { recursive: true });
  await writeFile('artifacts/i18n-2026-10-10/inventory.json', JSON.stringify(Object.fromEntries(entries), null, 2) + '\n');
  console.log(JSON.stringify({ messages: entries.size, characters: [...entries.keys()].join('').length, files: files.length }));
}
