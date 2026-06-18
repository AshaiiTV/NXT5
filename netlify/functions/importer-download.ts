const RELEASE_API = 'https://api.github.com/repos/AshaiiTV/NXT5/releases/tags/nxt5-match-exporter-latest';
const PREFERRED_VERSION = '0.2.8';

function redirect(url) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    }
  });
}

function jsonError(message, status = 404) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function scoreAsset(asset, platform, requestedVersion = PREFERRED_VERSION) {
  const name = String(asset?.name || '').toLowerCase();
  if (!asset?.browser_download_url) return -1;
  if (platform === 'windows' && !name.endsWith('.exe')) return -1;
  if (platform === 'mac' && !name.endsWith('.zip')) return -1;
  if (platform === 'windows' && !name.includes('windows')) return -1;
  if (platform === 'mac' && !name.includes('mac')) return -1;

  let score = 0;
  if (name.includes('nxt5-importer')) score += 100;
  if (name.includes('nxt5-match-exporter')) score += 50;
  if (platform === 'mac' && name.includes('arm64')) score += 20;
  if (requestedVersion && name.includes(String(requestedVersion).toLowerCase())) score += 70;
  if (name.includes(PREFERRED_VERSION)) score += 30;
  return score;
}

export default async function handler(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const platform = url.searchParams.get('platform') === 'mac' ? 'mac' : 'windows';
    const requestedVersion = String(url.searchParams.get('version') || PREFERRED_VERSION).trim();
    const response = await fetch(RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'NXT5'
      }
    });
    if (!response.ok) return jsonError('Release NXT5 Importer introuvable.', response.status);

    const release = await response.json();
    const assets = requestedVersion
      ? (release.assets || []).filter((item) => String(item?.name || '').toLowerCase().includes(requestedVersion.toLowerCase()))
      : (release.assets || []);
    const asset = assets
      .map((item) => ({ item, score: scoreAsset(item, platform, requestedVersion) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score)[0]?.item;

    if (!asset) return jsonError(`Aucun installateur ${platform === 'mac' ? 'Mac' : 'Windows'} disponible pour la version ${requestedVersion}.`);
    return redirect(asset.browser_download_url);
  } catch (err) {
    console.error(err);
    return jsonError('Téléchargement temporairement indisponible.', 500);
  }
}
