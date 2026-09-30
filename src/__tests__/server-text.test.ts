import { describe, expect, it } from 'vitest';
import { cleanText, escapeHtml } from '../../netlify/functions/_lib/text';

describe('cleanText', () => {
  it('trims then caps the text at the given length', () => {
    expect(cleanText('  Équipe NXT5  ', 80)).toBe('Équipe NXT5');
    expect(cleanText('  abcdef', 3)).toBe('abc');
    expect(cleanText('a'.repeat(10), 4)).toBe('aaaa');
  });

  it('keeps inner whitespace and control characters untouched', () => {
    expect(cleanText(' a  b\nc ', 80)).toBe('a  b\nc');
  });

  it('turns every falsy value into an empty string', () => {
    for (const value of [undefined, null, '', 0, false, Number.NaN]) expect(cleanText(value, 80)).toBe('');
  });

  it('stringifies other values', () => {
    expect(cleanText(42, 80)).toBe('42');
    expect(cleanText(true, 80)).toBe('true');
  });
});

describe('escapeHtml', () => {
  it('escapes the five HTML-sensitive characters', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe('&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  });

  it('leaves other text, including accents and existing entities, readable', () => {
    expect(escapeHtml('Réinitialisation — NXT5')).toBe('Réinitialisation — NXT5');
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });

  it('turns every falsy value into an empty string', () => {
    for (const value of [undefined, null, '', 0, false]) expect(escapeHtml(value)).toBe('');
  });
});
