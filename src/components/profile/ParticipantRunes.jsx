import { useEffect, useState } from "react";
import { Button } from "../ui/Core.jsx";
import { DDRAGON_FALLBACK_VERSIONS, safeJsonParse } from "../../pages/workspace/workspace-shared.jsx";
import { assetProxyUrl } from "../../utils/matches.js";
import { participantRunes, skillOrder } from "../../utils/matchup-notebook.js";
import "./participant-runes.css";

const CATALOG_TIMEOUT_MS = 4000;
const FAILED_CATALOG_COOLDOWN_MS = 30_000;
const catalogs = new Map();
const pendingCatalogs = new Map();
const failedCatalogs = new Map();

// Data Dragon does not include stat shards. Keep labels only for known IDs;
// omit numerical bonuses, which change between patches.
const SHARD_NAMES = {
  5001: "PV par niveau",
  5002: "Armure",
  5003: "Résistance magique",
  5005: "Vitesse d’attaque",
  5007: "Accélération de compétence",
  5008: "Force adaptative",
};
const SKILL_LABELS = { 1: "A", 2: "Z", 3: "E", 4: "R" };

function normalizeRuneVersion(value) {
  const parts = String(value ?? "").trim().match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!parts || Number(parts[1]) < 1 || Number(parts[2]) < 1) return "";
  // A game build such as 16.18.704.1234 maps to the published 16.18.1 catalogue.
  const revision = !parts[4] && Number(parts[3]) > 0 && Number(parts[3]) < 10 ? Number(parts[3]) : 1;
  return `${Number(parts[1])}.${Number(parts[2])}.${revision}`;
}

export function participantRuneVersion(row) {
  const match = row?.match;
  const raw = typeof match?.raw === "string" ? safeJsonParse(match.raw, {}) : match?.raw || {};
  for (const value of [raw?.info?.gameVersion, match?.gameVersion, match?.version, match?.patch, row?.gameVersion]) {
    const version = normalizeRuneVersion(value);
    if (version) return version;
  }
  return "";
}

export function runeCatalogVersions(version) {
  return [...new Set([normalizeRuneVersion(version), ...DDRAGON_FALLBACK_VERSIONS].filter(Boolean))];
}

function parseRuneCatalog(payload, version) {
  if (!Array.isArray(payload)) return null;
  const entries = new Map();
  const add = (value) => {
    const id = Number(value?.id);
    const name = typeof value?.name === "string" ? value.name.trim() : "";
    if (!Number.isInteger(id) || id <= 0 || !name) return;
    // Rune icons from Riot are relative PNG paths, never arbitrary remote URLs.
    const icon = typeof value.icon === "string" && /^perk-images\/[A-Za-z0-9/_-]+\.png$/.test(value.icon) ? value.icon : "";
    entries.set(id, { name, icon });
  };
  for (const style of payload) {
    add(style);
    for (const slot of Array.isArray(style?.slots) ? style.slots : []) {
      for (const rune of Array.isArray(slot?.runes) ? slot.runes : []) add(rune);
    }
  }
  return entries.size ? { version, entries } : null;
}

function fetchRuneCatalog(version, retry) {
  if (catalogs.has(version)) return Promise.resolve(catalogs.get(version));
  if (pendingCatalogs.has(version)) return pendingCatalogs.get(version);
  const failedAt = failedCatalogs.get(version);
  if (!retry && failedAt !== undefined && Date.now() - failedAt < FAILED_CATALOG_COOLDOWN_MS) return Promise.resolve(null);

  const request = (async () => {
    const controller = new AbortController();
    let timeout;
    try {
      // Bound the JSON read as well as the initial response. A hanging request
      // must not leave every participant waiting on the shared promise forever.
      const payload = await Promise.race([
        (async () => {
          const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/fr_FR/runesReforged.json`, { signal: controller.signal });
          return response.ok ? response.json() : null;
        })(),
        new Promise((resolve) => {
          timeout = setTimeout(() => { controller.abort(); resolve(null); }, CATALOG_TIMEOUT_MS);
        }),
      ]);
      const catalog = parseRuneCatalog(payload, version);
      if (catalog) {
        catalogs.set(version, catalog);
        failedCatalogs.delete(version);
        return catalog;
      }
    } catch {
      // Try the next published version; the imported choices stay visible.
    } finally {
      clearTimeout(timeout);
    }
    failedCatalogs.set(version, Date.now());
    return null;
  })();
  pendingCatalogs.set(version, request);
  request.finally(() => pendingCatalogs.delete(version));
  return request;
}

export async function loadRuneCatalog(version = "", { retry = false } = {}) {
  for (const candidate of runeCatalogVersions(version)) {
    const catalog = await fetchRuneCatalog(candidate, retry);
    if (catalog) return catalog;
  }
  return null;
}

export function runeDisplayName(id, catalog, shard = false) {
  return catalog?.entries.get(Number(id))?.name || (shard && SHARD_NAMES[Number(id)]) || `${shard ? "Fragment" : "Rune"} ${id}`;
}

function RuneName({ id, catalog, shard = false }) {
  const icon = catalog?.entries.get(Number(id))?.icon;
  const [failedIcon, setFailedIcon] = useState("");
  return <span className="matchup-runes-name">
    {icon && failedIcon !== icon && <img src={assetProxyUrl(`https://ddragon.leagueoflegends.com/cdn/img/${icon}`)} width="24" height="24" alt="" loading="lazy" onError={() => setFailedIcon(icon)} />}
    <span>{runeDisplayName(id, catalog, shard)}</span>
  </span>;
}

function skillTime(timestamp) {
  const seconds = Math.floor(timestamp / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function ParticipantRunes({ row }) {
  const page = participantRunes(row);
  const skills = skillOrder(row);
  const hasRunes = Boolean(page.primaryStyle || page.secondaryStyle || page.selections.length || page.shards.length);
  const needsCatalog = Boolean(page.primaryStyle || page.secondaryStyle || page.selections.length);
  const version = participantRuneVersion(row);
  const [retryCount, setRetryCount] = useState(0);
  const [loaded, setLoaded] = useState({ version: "", catalog: null, status: "idle" });
  const catalog = loaded.version === version ? loaded.catalog : null;
  const status = needsCatalog ? (loaded.version === version ? loaded.status : "loading") : "idle";

  useEffect(() => {
    if (!needsCatalog) return;
    let active = true;
    setLoaded({ version, catalog: null, status: "loading" });
    loadRuneCatalog(version, { retry: retryCount > 0 }).then((next) => {
      if (active) setLoaded({ version, catalog: next, status: next ? "ready" : "error" });
    });
    return () => { active = false; };
  }, [version, needsCatalog, retryCount]);

  return <div className="matchup-runes">
    <h6>Runes</h6>
    {!hasRunes ? <p className="matchup-runes-meta">Runes non renseignées.</p> : <>
      {(page.primaryStyle || page.secondaryStyle) && <dl className="matchup-runes-styles">
        {[["Arbre principal", page.primaryStyle], ["Arbre secondaire", page.secondaryStyle]].map(([label, id]) => <div key={label}><dt>{label}</dt><dd>{id ? <RuneName id={id} catalog={catalog} /> : "Non renseigné"}</dd></div>)}
      </dl>}
      {page.selections.length > 0 && <ul className="matchup-runes-selections" aria-label="Runes sélectionnées">{page.selections.map((id, index) => <li key={`${index}-${id}`}><RuneName id={id} catalog={catalog} /></li>)}</ul>}
      {page.shards.length > 0 && <div className="matchup-runes-shards"><p>Fragments</p><ul aria-label="Fragments de statistiques">{page.shards.map((id, index) => <li key={`${index}-${id}`}><RuneName id={id} catalog={catalog} shard /></li>)}</ul></div>}
      {status === "loading" && <p className="matchup-runes-meta" role="status">Chargement des noms des runes…</p>}
      {status === "error" && <div className="matchup-runes-error"><p className="matchup-runes-meta" role="status">Noms des runes indisponibles pour le moment.</p><Button type="button" variant="ghost" onClick={() => setRetryCount((count) => count + 1)}>Réessayer les noms des runes</Button></div>}
    </>}
    {skills.length ? <details className="matchup-runes-skills"><summary>Ordre des compétences <span>· {skills.length} améliorations</span></summary><p className="matchup-runes-meta">A / Z / E / R · temps écoulé depuis le début de la partie.</p><ol aria-label="Compétences améliorées dans l’ordre">{skills.map((event, index) => <li key={`${index}-${event.timestamp}-${event.slot}`}><strong>{SKILL_LABELS[event.slot]}</strong><span>{skillTime(event.timestamp)}</span></li>)}</ol></details> : <p className="matchup-runes-meta matchup-runes-skill-empty">Ordre des compétences non renseigné.</p>}
  </div>;
}
