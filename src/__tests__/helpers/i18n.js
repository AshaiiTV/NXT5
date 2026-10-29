import { beforeAll } from 'vitest';
import { loadLanguageMessages } from '../../i18n/translate.js';

// Rendering tests exercise translated output after the user's selection has
// loaded. Store and switcher tests separately cover the asynchronous transition.
beforeAll(() => Promise.all(['en', 'es'].map(loadLanguageMessages)));
