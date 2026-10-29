export const LANGUAGE_STORAGE_KEY = "nxt5:language:v1";
export const SUPPORTED_LANGUAGES = Object.freeze(["fr", "en", "es"]);
const LOCALES = { fr: "fr-FR", en: "en-GB", es: "es-ES" };
const RIOT_LOCALES = { fr: "fr_FR", en: "en_US", es: "es_ES" };
let language = "fr";
let selectionVersion = 0;
const listeners = new Set();

export function normalizeLanguage(value) {
  return SUPPORTED_LANGUAGES.includes(value) ? value : "fr";
}

export function getLanguage() { return language; }
export function getLocale(value = language) { return LOCALES[normalizeLanguage(value)]; }
export function getRiotLocale(value = language) { return RIOT_LOCALES[normalizeLanguage(value)]; }

function updateLanguage(value) {
  const next = normalizeLanguage(value);
  if (language !== next) {
    language = next;
    for (const listener of listeners) listener();
  }
  return language;
}

export function setLanguage(value, { persist = true } = {}) {
  const next = normalizeLanguage(value);
  const request = ++selectionVersion;
  const commit = () => {
    if (request !== selectionVersion) return language;
    updateLanguage(next);
    if (persist) {
      try { globalThis.window?.localStorage?.setItem(LANGUAGE_STORAGE_KEY, next); } catch { /* Private browsing can disable storage. */ }
    }
    return next;
  };
  // Keep the current language and form state until the requested catalogue is
  // available. A slower earlier request can never replace a newer selection.
  return hasLanguageMessages(next) ? commit() : loadLanguageMessages(next).then(commit);
}

// Call after hydration: SSR and the first browser render both remain French.
export function restoreLanguage() {
  try { return setLanguage(globalThis.window?.localStorage?.getItem(LANGUAGE_STORAGE_KEY), { persist: false }); }
  catch { return language; }
}

function receiveStorage(event) {
  if (event.key === LANGUAGE_STORAGE_KEY || event.key === null) Promise.resolve(setLanguage(event.newValue, { persist: false })).catch(() => {});
}

export function subscribeLanguage(listener) {
  if (!listeners.size) globalThis.window?.addEventListener?.("storage", receiveStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) globalThis.window?.removeEventListener?.("storage", receiveStorage);
  };
}
import { hasLanguageMessages, loadLanguageMessages } from './translate.js';
