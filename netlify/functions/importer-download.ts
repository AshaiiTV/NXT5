const RELEASE_TAG = 'nxt5-match-exporter-latest';
const RELEASE_API = `https://api.github.com/repos/AshaiiTV/NXT5/releases/tags/${RELEASE_TAG}`;
const DOWNLOAD_BASE = `https://github.com/AshaiiTV/NXT5/releases/download/${RELEASE_TAG}/`;
const RELEASE_TIMEOUT_MS = 8000;
const STABLE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const ASSET_NAME = /^(NXT5-Importer|NXT5-Match-Exporter)-(Windows(?:-x64)?|Mac-(x64|arm64))-(\d+\.\d+\.\d+)\.(exe|zip)$/i;

type Platform = 'windows' | 'mac';
type Architecture = 'x64' | 'arm64';
type Installer = { name: string; url: string; version: string; platform: Platform; arch: Architecture; currentName: boolean };

const responseHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer'
};

function compareVersions(left: string, right: string): number {
  const a = left.split('.').map(BigInt);
  const b = right.split('.').map(BigInt);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

function parseInstaller(value: unknown): Installer | null {
  if (!value || typeof value !== 'object') return null;
  const asset = value as { name?: unknown; browser_download_url?: unknown };
  if (typeof asset.name !== 'string' || typeof asset.browser_download_url !== 'string') return null;
  const match = asset.name.match(ASSET_NAME);
  if (!match || match[4].length > 128 || !STABLE_VERSION.test(match[4])) return null;
  const platform: Platform = match[2].toLowerCase().startsWith('windows') ? 'windows' : 'mac';
  if (match[5].toLowerCase() !== (platform === 'windows' ? 'exe' : 'zip')) return null;

  // Redirect only to the exact release asset on our repository, never a URL
  // supplied by a similarly named asset or an unexpected upstream host.
  if (asset.browser_download_url !== `${DOWNLOAD_BASE}${encodeURIComponent(asset.name)}`) return null;
  return {
    name: asset.name,
    url: asset.browser_download_url,
    version: match[4],
    platform,
    arch: (match[3]?.toLowerCase() || 'x64') as Architecture,
    currentName: match[1].toLowerCase() === 'nxt5-importer'
  };
}

export default async function handler(request: Request): Promise<Response> {
  const jsonError = (message: string, status = 404, headers = {}) => new Response(
    request.method === 'HEAD' ? null : JSON.stringify({ error: message }),
    { status, headers: { ...responseHeaders, 'Content-Type': 'application/json; charset=utf-8', ...headers } }
  );
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return jsonError('Méthode non autorisée.', 405, { Allow: 'GET, HEAD' });
  }

  const params = new URL(request.url).searchParams;
  if (['platform', 'arch', 'version'].some((key) => params.getAll(key).length > 1)) {
    return jsonError('Paramètres de téléchargement ambigus.', 400);
  }
  const platform = params.get('platform') ?? 'windows';
  // Old links omit the architecture. x64 remains compatible with Intel Macs;
  // Apple Silicon links and desktop update checks explicitly request arm64.
  const arch = params.get('arch') ?? 'x64';
  const version = params.get('version');
  if (platform !== 'windows' && platform !== 'mac') return jsonError('Plateforme invalide : windows ou mac attendue.', 400);
  if (arch !== 'x64' && arch !== 'arm64') return jsonError('Architecture invalide : x64 ou arm64 attendue.', 400);
  if (platform === 'windows' && arch !== 'x64') return jsonError('L’application Windows est disponible en x64.', 400);
  if (version !== null && (version.length > 128 || !STABLE_VERSION.test(version))) {
    return jsonError('Version invalide : format attendu 0.3.0.', 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RELEASE_TIMEOUT_MS);
  try {
    const response = await fetch(RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'NXT5' },
      signal: controller.signal,
      redirect: 'error'
    });
    if (!response.ok) {
      if (response.status === 404) return jsonError('Release NXT5 Importer introuvable.');
      return jsonError('Le service de téléchargement est temporairement indisponible.', 503);
    }
    const release = await response.json();
    if (!release || !Array.isArray(release.assets)) return jsonError('Réponse du service de téléchargement invalide.', 502);
    const installers = release.assets
      .map(parseInstaller)
      .filter((item: Installer | null): item is Installer => !!item && item.platform === platform && item.arch === arch && (version === null || item.version === version))
      .sort((a: Installer, b: Installer) => compareVersions(b.version, a.version) || Number(b.currentName) - Number(a.currentName) || a.name.localeCompare(b.name));
    const installer: Installer | undefined = installers[0];
    if (!installer) {
      const target = `${platform === 'mac' ? 'Mac' : 'Windows'} ${arch}`;
      return jsonError(`Aucun installateur ${target} disponible${version === null ? '' : ` pour la version ${version}`}.`);
    }
    return new Response(null, { status: 302, headers: { ...responseHeaders, Location: installer.url } });
  } catch {
    return jsonError('Téléchargement temporairement indisponible. Réessaie dans quelques instants.', controller.signal.aborted ? 504 : 502);
  } finally {
    clearTimeout(timeout);
  }
}
