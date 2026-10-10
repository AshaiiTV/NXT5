import base from './messages/en.json' with { type: 'json' };
import { en as quality } from './quality-overrides.js';
import { en as reviewed } from './overrides.js';
import { en as components } from './component-overrides.js';
import { en as interfaceCopy } from './overrides-ui.js';
import { en as showcase } from './showcase-overrides.js';
export default { ...base, ...quality, ...reviewed, ...components, ...interfaceCopy, ...showcase };
