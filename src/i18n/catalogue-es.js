import base from './messages/es.json' with { type: 'json' };
import { es as quality } from './quality-overrides.js';
import { es as reviewed } from './overrides.js';
import { es as components } from './component-overrides.js';
import { es as interfaceCopy } from './overrides-ui.js';
import { es as showcase } from './showcase-overrides.js';
export default { ...base, ...quality, ...reviewed, ...components, ...interfaceCopy, ...showcase };
