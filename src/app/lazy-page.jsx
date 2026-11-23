import React, { lazy, useState } from "react";

/**
 * React.lazy with an explicit preload. Once `preload()` has resolved (before
 * hydrating a prerendered page) or `provide()` was called (server render), the
 * page renders synchronously: no Suspense fallback replaces the prerendered
 * HTML. Each mount keeps the component it started with so a page never
 * remounts when its module finishes loading.
 */
export function lazyPage(load, pick = module => module.default) {
  let resolved;
  let pending;
  const preload = () => {
    pending ||= load().then(module => (resolved = pick(module))).catch(error => { pending = undefined; throw error; });
    return pending;
  };
  const Lazy = lazy(() => preload().then(component => ({ default: component })));
  function Page(props) {
    const [Component] = useState(() => resolved || Lazy);
    return <Component {...props} />;
  }
  Page.preload = preload;
  Page.provide = module => { resolved = pick(module); };
  return Page;
}
