/** Netlify Functions supplies runtime secrets; process.env supports local tests. */
export function riotRsoEnv(name: string): string {
  return (globalThis as any).Netlify?.env?.get?.(name) ?? process.env[name] ?? '';
}
