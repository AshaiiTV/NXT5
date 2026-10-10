import { getLanguage } from './locale.js';

export const messages = Object.create(null);
const loading = new Map();
const loaders = { en: () => import('./catalogue-en.js'), es: () => import('./catalogue-es.js') };
export const hasLanguageMessages = language => language === 'fr' || Object.hasOwn(messages, language);
export function loadLanguageMessages(language) {
  if (hasLanguageMessages(language) || !Object.hasOwn(loaders, language)) return Promise.resolve();
  if (!loading.has(language)) {
    loading.set(language, loaders[language]().then(module => { messages[language] = module.default; }).catch(error => { loading.delete(language); throw error; }));
  }
  return loading.get(language);
}
const cache = { en: new Map(), es: new Map() };
const templates = {};
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function interpolate(text, values) {
  return text.replace(/\{(\d+)\}/g, (token, index) => values?.[index] == null ? token : String(values[index]));
}

function translateTemplate(source, language) {
  if (!templates[language]) {
    templates[language] = new Map();
    for (const [key, value] of Object.entries(messages[language])) {
      if (!/\{\d+\}/.test(key) || key.replace(/\{\d+\}/g, '').length < 12) continue;
      const indices = [...key.matchAll(/\{(\d+)\}/g)].map(match => Number(match[1]));
      const expression = key.split(/\{\d+\}/).map(escapeRegExp).join('([\\s\\S]*?)');
      const prefix = key.slice(0, key.indexOf('{')).slice(0, 12);
      const list = templates[language].get(prefix) || [];
      list.push({ pattern: new RegExp(`^${expression}$`), indices, value });
      templates[language].set(prefix, list);
    }
  }
  for (let length = Math.min(12, source.length); length >= 0; length--) {
    for (const entry of templates[language].get(source.slice(0, length)) || []) {
      const match = source.match(entry.pattern);
      if (match) {
        const values = [];
        entry.indices.forEach((index, capture) => { values[index] = match[capture + 1]; });
        return interpolate(entry.value, values);
      }
    }
  }
  return source;
}

/** Translate product copy at its display boundary. Never pass user-authored
 * names, notes, message bodies or API objects here. Values are interpolated as
 * plain text, without HTML interpretation or recursive translation. */
export function t(source, values, language = getLanguage()) {
  if (typeof source !== 'string') return source;
  if (!Object.hasOwn(messages, language)) return values ? interpolate(source, values) : source;
  const key = source.trim();
  if (!key) return source;
  let translated = Object.hasOwn(messages[language], key) ? messages[language][key] : undefined;
  if (translated === undefined) {
    translated = cache[language].get(key);
    if (translated === undefined) {
      translated = translateTemplate(key, language);
      // Bound memory when messages include dynamic counters.
      if (cache[language].size >= 2000) cache[language].clear();
      cache[language].set(key, translated);
    }
  }
  const result = source.slice(0, source.length - source.trimStart().length) + translated + source.slice(source.trimEnd().length);
  return values ? interpolate(result, values) : result;
}
