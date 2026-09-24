// A small document double for node-based component tests that run real SEO effects.
export function createSeoDocument(overrides = {}) {
  const children = [];
  const head = {
    children,
    append(element) {
      children.push(element);
    },
    querySelectorAll(selector) {
      if (selector !== "[data-nxt5-seo]") throw new Error(`Unsupported test selector: ${selector}`);
      return children.filter(element => element.hasAttribute("data-nxt5-seo"));
    },
  };
  return {
    title: "",
    head,
    createElement(tagName) {
      const attributes = new Map();
      return {
        tagName: tagName.toUpperCase(),
        textContent: "",
        setAttribute(name, value) { attributes.set(name, String(value)); },
        getAttribute(name) { return attributes.get(name) ?? this[name] ?? null; },
        hasAttribute(name) { return attributes.has(name); },
        remove() {
          const index = children.indexOf(this);
          if (index !== -1) children.splice(index, 1);
        },
      };
    },
    ...overrides,
  };
}
