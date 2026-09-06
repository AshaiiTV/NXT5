import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

// Vite's default SPA fallback ignores Netlify redirects. Mirror the generated
// static route rules locally so preview tests exercise auth shells and real 404s.
export function installPreviewRouting(server, noindex) {
  const output = resolve(server.config.root, server.config.build.outDir);
  const rules = readFileSync(resolve(output, "_redirects"), "utf8").split("\n").filter((line) => line && !line.startsWith("#")).map((line) => line.split(/\s+/));
  server.middlewares.use((req, res, next) => {
    const url = new URL(req.url || "/", "http://localhost");
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (noindex) res.setHeader("X-Robots-Tag", "noindex, nofollow");
    const matches = ([from]) => from.endsWith("/*") ? path.startsWith(from.slice(0, -1)) : path === from;
    const forced = rules.find((rule) => rule[2].endsWith("!") && matches(rule));
    const files = path === "/" ? ["index.html"] : [path.slice(1), `${path.slice(1)}.html`, `${path.slice(1)}/index.html`];
    const hasFile = files.some((file) => { const target = resolve(output, file); return target.startsWith(`${output}/`) && existsSync(target) && statSync(target).isFile(); });
    const rule = forced || (!hasFile && rules.find(matches));
    if (!rule) { next(); return; }
    const [, to, statusText] = rule;
    const status = Number.parseInt(statusText, 10);
    if (status >= 300 && status < 400) { res.writeHead(status, { Location: `${to}${url.search}` }); res.end(); return; }
    if (status === 404) { res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" }); res.end(readFileSync(resolve(output, to.slice(1)))); return; }
    req.url = `${to}${url.search}`;
    next();
  });
}
