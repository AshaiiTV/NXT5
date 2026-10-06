import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('limits Tailwind glob input to static, brace-free repository source paths', () => {
  const source = ts.createSourceFile('tailwind.config.js',
    readFileSync(new URL('../../tailwind.config.js', import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  // Inspect the syntax as well as values: an env-derived expression that happens
  // to yield safe paths on CI must not bypass this build-time input boundary.
  expect(source.statements).toHaveLength(1);
  const declaration = source.statements[0];
  expect(ts.isExportAssignment(declaration)).toBe(true);
  expect(ts.isObjectLiteralExpression(declaration.expression)).toBe(true);
  const properties = declaration.expression.properties;
  expect(properties.every(property => ts.isPropertyAssignment(property) && ts.isIdentifier(property.name))).toBe(true);
  const content = properties.filter(property => property.name.text === 'content');
  expect(content).toHaveLength(1);
  expect(ts.isArrayLiteralExpression(content[0].initializer)).toBe(true);
  const elements = content[0].initializer.elements;
  expect(elements.every(element => ts.isStringLiteral(element))).toBe(true);
  expect(elements.map(element => element.text)).toEqual([
    './index.html', './src/**/*.js', './src/**/*.jsx', './src/**/*.ts', './src/**/*.tsx'
  ]);
});
