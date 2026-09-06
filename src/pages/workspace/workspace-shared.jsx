import { PNG_THEME, pngAccent, pngTint, pngFitText, pngWrapText, pngLine, pngPanel, pngBackground, pngHeader, pngFooter, pngLoadImage, pngImageCover, pngMetricStrip, pngDownload } from "../../utils/png-report.js";
import { lazy, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Shield, Swords, Target, Upload, Flame, Gauge, ShieldCheck } from "lucide-react";
import { matchDisplayName, assetProxyUrl } from "../../utils/matches.js";
import { cx, tone } from "../../app/helpers.js";
import { roleLabel } from "./shell-shared.jsx";

function lazyNamed(importer, name) {
  return lazy(() => importer().then((module) => ({ default: module[name] })));
}

const loadNextPhase = () => import("../../NextPhase.jsx");

const DDRAGON_FALLBACK_VERSIONS = ["16.16.1", "16.15.1", "16.14.1", "16.13.1", "16.11.1", "15.24.1"];

const CHAMPION_STYLE_TAGS = {
  Aatrox: ["bruiser", "teamfight"], Ahri: ["pick", "tempo"], Akali: ["assassin", "side"], Alistar: ["engage", "peel"], Amumu: ["engage", "teamfight"], Anivia: ["control", "scaling"], Annie: ["burst", "engage"], Aphelios: ["scaling", "front-to-back"], Ashe: ["utility", "pick"], AurelionSol: ["scaling", "control"], Azir: ["scaling", "front-to-back"],
  Bard: ["roam", "pick"], Blitzcrank: ["pick", "engage"], Brand: ["poke", "teamfight"], Braum: ["peel", "front-to-back"], Caitlyn: ["lane", "siege"], Camille: ["side", "pick"], Cassiopeia: ["scaling", "front-to-back"], Chogath: ["frontline", "objective"], Corki: ["poke", "scaling"],
  Darius: ["bruiser", "lane"], Diana: ["engage", "burst"], DrMundo: ["frontline", "scaling"], Draven: ["lane", "snowball"], Ekko: ["assassin", "side"], Elise: ["early", "dive"], Evelynn: ["pick", "assassin"], Ezreal: ["poke", "safe"], Fiddlesticks: ["engage", "teamfight"], Fiora: ["side", "duel"], Fizz: ["assassin", "pick"],
  Galio: ["engage", "cover"], Gangplank: ["scaling", "teamfight"], Garen: ["bruiser", "simple"], Gnar: ["teamfight", "side"], Gragas: ["engage", "disengage"], Graves: ["tempo", "skirmish"], Gwen: ["scaling", "side"], Hecarim: ["engage", "tempo"], Heimerdinger: ["control", "siege"], Hwei: ["control", "poke"],
  Irelia: ["side", "snowball"], Ivern: ["utility", "peel"], Janna: ["peel", "disengage"], JarvanIV: ["engage", "early"], Jax: ["side", "scaling"], Jayce: ["poke", "lane"], Jhin: ["utility", "pick"], Jinx: ["scaling", "front-to-back"], Kaisa: ["dive", "scaling"], Kalista: ["lane", "objective"], Karma: ["poke", "tempo"], Karthus: ["scaling", "farm"], Kassadin: ["scaling", "side"], Katarina: ["reset", "snowball"], Kayle: ["scaling", "front-to-back"], Kayn: ["tempo", "skirmish"], Kennen: ["engage", "teamfight"], Khazix: ["pick", "assassin"], Kindred: ["tempo", "scaling"], Kled: ["engage", "snowball"], KogMaw: ["scaling", "front-to-back"], KSante: ["frontline", "side"],
  LeBlanc: ["pick", "poke"], LeeSin: ["early", "playmaker"], Leona: ["engage", "lane"], Lillia: ["tempo", "teamfight"], Lissandra: ["engage", "lockdown"], Lucian: ["lane", "tempo"], Lulu: ["peel", "scaling"], Lux: ["poke", "pick"], Malphite: ["engage", "teamfight"], Malzahar: ["lockdown", "pick"], Maokai: ["engage", "vision"], MasterYi: ["scaling", "reset"], Milio: ["peel", "scaling"], MissFortune: ["teamfight", "lane"], MonkeyKing: ["engage", "teamfight"], Mordekaiser: ["frontline", "side"], Morgana: ["pick", "control"], Nami: ["lane", "utility"], Nasus: ["scaling", "side"], Nautilus: ["engage", "pick"], Neeko: ["engage", "teamfight"], Nidalee: ["tempo", "poke"], Nilah: ["dive", "teamfight"], Nocturne: ["dive", "pick"], Nunu: ["objective", "gank"], Olaf: ["bruiser", "tempo"], Orianna: ["control", "teamfight"], Ornn: ["frontline", "scaling"], Pantheon: ["early", "pick"], Poppy: ["disengage", "frontline"], Pyke: ["pick", "roam"], Qiyana: ["assassin", "teamfight"], Quinn: ["side", "lane"], Rakan: ["engage", "roam"], Rammus: ["engage", "frontline"], RekSai: ["early", "dive"], Rell: ["engage", "teamfight"], Renata: ["disengage", "teamfight"], Renekton: ["lane", "early"], Rengar: ["assassin", "pick"], Riven: ["side", "snowball"], Rumble: ["teamfight", "lane"], Ryze: ["side", "scaling"], Samira: ["dive", "reset"], Sejuani: ["engage", "frontline"], Senna: ["scaling", "utility"], Seraphine: ["teamfight", "scaling"], Sett: ["frontline", "engage"], Shen: ["side", "cover"], Shyvana: ["farm", "teamfight"], Singed: ["side", "disrupt"], Sion: ["frontline", "engage"], Sivir: ["waveclear", "front-to-back"], Skarner: ["pick", "frontline"], Smolder: ["scaling", "front-to-back"], Sona: ["scaling", "teamfight"], Soraka: ["peel", "sustain"], Swain: ["teamfight", "frontline"], Sylas: ["skirmish", "pick"], Syndra: ["burst", "control"], TahmKench: ["peel", "frontline"], Taliyah: ["control", "roam"], Talon: ["roam", "assassin"], Taric: ["peel", "teamfight"], Teemo: ["side", "control"], Thresh: ["pick", "peel"], Tristana: ["lane", "siege"], Trundle: ["frontline", "objective"], Tryndamere: ["side", "scaling"], TwistedFate: ["roam", "pick"], Twitch: ["scaling", "flank"], Udyr: ["tempo", "frontline"], Urgot: ["bruiser", "frontline"], Varus: ["poke", "pick"], Vayne: ["scaling", "duel"], Veigar: ["scaling", "control"], Velkoz: ["poke", "control"], Vex: ["burst", "anti-dive"], Vi: ["dive", "lockdown"], Viego: ["reset", "skirmish"], Viktor: ["control", "scaling"], Vladimir: ["scaling", "teamfight"], Volibear: ["dive", "early"], Warwick: ["early", "skirmish"], Xayah: ["self-peel", "front-to-back"], Xerath: ["poke", "siege"], XinZhao: ["early", "dive"], Yasuo: ["skirmish", "teamfight"], Yone: ["side", "teamfight"], Yorick: ["side", "siege"], Yuumi: ["scaling", "attach"], Zac: ["engage", "teamfight"], Zed: ["assassin", "side"], Zeri: ["scaling", "teamfight"], Ziggs: ["poke", "siege"], Zilean: ["utility", "scaling"], Zoe: ["poke", "pick"], Zyra: ["poke", "control"],
};

const ADDITIONAL_CHAMPION_STYLE_TAGS = {
  Akshan: ["roam", "reset"],
  Ambessa: ["dive", "skirmish"],
  Aurora: ["teamfight", "side"],
  Belveth: ["scaling", "skirmish"],
  Briar: ["dive", "snowball"],
  Illaoi: ["side", "teamfight"],
  Leblanc: ["pick", "poke"],
  Locke: ["assassin", "burst"],
  Mel: ["control", "poke"],
  Naafiri: ["assassin", "dive"],
  Shaco: ["pick", "assassin"],
  Yunara: ["scaling", "front-to-back"],
  Zaahen: ["bruiser", "dive"],
};

const ALL_CHAMPION_STYLE_TAGS = {
  ...CHAMPION_STYLE_TAGS,
  ...ADDITIONAL_CHAMPION_STYLE_TAGS,
};

const CHAMPION_ASSET_ALIASES = {
  aurelionsol: "AurelionSol",
  belveth: "Belveth",
  chogath: "Chogath",
  drmundo: "DrMundo",
  jarvaniv: "JarvanIV",
  kaisa: "Kaisa",
  khazix: "Khazix",
  kogmaw: "KogMaw",
  ksante: "KSante",
  leblanc: "Leblanc",
  leesin: "LeeSin",
  masteryi: "MasterYi",
  missfortune: "MissFortune",
  monkeyking: "MonkeyKing",
  nunuwillump: "Nunu",
  reksai: "RekSai",
  renataglasc: "Renata",
  tahmkench: "TahmKench",
  twistedfate: "TwistedFate",
  velkoz: "Velkoz",
  viego: "Viego",
  wukong: "MonkeyKing",
  xinzhao: "XinZhao",
};

function championKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function championAssetId(value) {
  const raw = String(value || "").trim();
  const key = championKey(raw);
  return CHAMPION_ASSET_ALIASES[key] || raw.replace(/[^A-Za-z0-9]/g, "");
}

function championDisplayName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const names = {
    AurelionSol: "Aurelion Sol",
    Chogath: "Cho'Gath",
    DrMundo: "Dr. Mundo",
    JarvanIV: "Jarvan IV",
    Kaisa: "Kai'Sa",
    Khazix: "Kha'Zix",
    KogMaw: "Kog'Maw",
    KSante: "K'Sante",
    Leblanc: "LeBlanc",
    LeeSin: "Lee Sin",
    MasterYi: "Master Yi",
    MissFortune: "Miss Fortune",
    MonkeyKing: "Wukong",
    Nunu: "Nunu & Willump",
    RekSai: "Rek'Sai",
    TahmKench: "Tahm Kench",
    TwistedFate: "Twisted Fate",
    Velkoz: "Vel'Koz",
    XinZhao: "Xin Zhao",
  };
  const asset = championAssetId(raw);
  return names[asset] || raw.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function compositionIdentity(picks) {
  const tagCounts = new Map();
  (picks || []).filter(Boolean).forEach((pick) => championStyleTags(pick.champion).forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)));
  const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const primary = tags[0]?.[0] || "standard";
  const text = primary === "engage" ? "Chercher une ouverture claire et jouer autour du premier go." : primary === "scaling" || primary === "front-to-back" ? "Protéger les carries, temporiser et jouer les objectifs préparés." : primary === "poke" || primary === "siege" ? "Gagner l'espace avant objectif, gratter les HP puis forcer." : primary === "side" ? "Créer une pression side lane et punir les rotations adverses." : primary === "pick" ? "Jouer vision noire, isoler une cible et convertir en objectif." : "Importer plus de matchs pour stabiliser l'identité de draft.";
  return { primary, tags, text };
}

function championStyleTags(champion) {
  return ALL_CHAMPION_STYLE_TAGS[championAssetId(champion)] || ["standard"];
}

function championStyleTone(tag) {
  if (["engage", "dive", "early", "snowball", "assassin", "burst", "pick"].includes(tag)) return "red";
  if (["scaling", "front-to-back", "peel", "sustain", "utility", "control", "waveclear", "safe", "vision"].includes(tag)) return "cyan";
  if (["side", "duel", "split", "siege", "poke", "farm", "lane"].includes(tag)) return "yellow";
  if (["frontline", "teamfight", "objective", "tempo", "roam", "skirmish", "reset", "disengage", "lockdown"].includes(tag)) return "green";
  return "slate";
}

function tagLabel(tag) {
  return {
    "blue side": "Côté bleu",
    "red side": "Côté rouge",
    "front-to-back": "Combat frontal",
    teamfight: "Combat d'équipe",
    scaling: "Late game",
    pick: "Catch",
    poke: "Poke",
    siege: "Siège",
    side: "Side lane",
    engage: "Initiation",
    dive: "Dive",
    early: "Début de game",
    snowball: "Snowball",
    assassin: "Assassin",
    burst: "Burst",
    peel: "Protection",
    sustain: "Tenue",
    utility: "Utilitaire",
    control: "Contrôle",
    duel: "Duel",
    split: "Split",
    frontline: "Première ligne",
    objective: "Objectifs",
    tempo: "Tempo",
    waveclear: "Nettoyage de waves",
    safe: "Sécurité",
    vision: "Vision",
    farm: "Farm",
    lane: "Lane",
    roam: "Roam",
    skirmish: "Escarmouche",
    reset: "Reset",
    disengage: "Désengage",
    lockdown: "Verrouillage",
    flank: "Flank",
    dps: "DPS",
    invade: "Invade",
    exhaust: "Fatigue",
    standard: "Standard",
    scrim: "Scrim",
  }[String(tag || "")] || String(tag || "").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function championSplashUrl(champion) {
  const id = championAssetId(champion);
  return id ? assetProxyUrl("https://ddragon.leagueoflegends.com/cdn/img/champion/splash/" + id + "_0.jpg") : "";
}

function championPortraitSources(rowOrChampion, explicitChampion = "") {
  const championId = rowOrChampion?.raw?.championId || rowOrChampion?.championId;
  const champion = explicitChampion || (typeof rowOrChampion === "string" ? rowOrChampion : rowOrChampion?.champion);
  const id = championAssetId(champion);
  return [...new Set([
    championId ? assetProxyUrl("https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/" + championId + ".png") : "",
    ...DDRAGON_FALLBACK_VERSIONS.map((version) => id ? assetProxyUrl("https://ddragon.leagueoflegends.com/cdn/" + version + "/img/champion/" + id + ".png") : ""),
    id ? assetProxyUrl("https://ddragon.leagueoflegends.com/cdn/img/champion/loading/" + id + "_0.jpg") : "",
  ].filter(Boolean))];
}

function ChampionPortrait({ champion, row, alt, className = "h-full w-full object-cover" }) {
  const sources = useMemo(() => championPortraitSources(row || champion, champion || row?.champion), [row, champion]);
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => setSourceIndex(0), [sources.join("|")]);
  const source = sources[sourceIndex];
  if (!source) return <div className={cx("flex items-center justify-center bg-gradient-to-br from-cyan-400/18 via-blue-500/10 to-fuchsia-500/18 text-[0.6rem] font-black text-cyan-100", className)}>{String(alt || champion || row?.champion || "?").slice(0, 2).toUpperCase()}</div>;
  return <img src={source} alt={alt || champion || row?.champion || "Champion"} className={className} loading="lazy" decoding="async" onError={() => setSourceIndex((index) => index + 1)} />;
}

function safeExportFilename(value, fallback = "export") {
  const normalized = String(value || fallback).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function championPoolRowsByTier(rows = []) {
  const grouped = CHAMPION_TIERS.reduce((map, tier) => ({ ...map, [tier.id]: [] }), {});
  rows.forEach((row) => {
    const status = championPoolStatus(row);
    if (!grouped[status]) grouped[status] = [];
    grouped[status].push(row);
  });
  return grouped;
}

async function exportChampionTierListPng({ player, rows = [], rowsByTier, pushToast } = {}) {
  const grouped = rowsByTier || championPoolRowsByTier(rows);
  const allRows = CHAMPION_TIERS.flatMap((tier) => grouped[tier.id] || []);
  if (!allRows.length) {
    pushToast?.({ type: "yellow", title: "Export vide", text: "Ajoute au moins un champion dans la tier list avant d'exporter." });
    return;
  }

  try {
    const W = 1920;
    const margin = 64;
    const labelW = 264;
    const gap = 16;
    const columns = 4;
    const cardH = 96;
    const contentW = W - margin * 2;
    const cardW = (contentW - labelW - 48 - (columns - 1) * gap) / columns;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const hintFont = "500 18px Inter, Arial, sans-serif";
    const hints = CHAMPION_TIERS.map((tier) => pngWrapText(ctx, tier.hint, labelW - 48, { font: hintFont }));
    const tierHeights = CHAMPION_TIERS.map((tier, index) => Math.max(168, 112 + hints[index].length * 25, 48 + Math.ceil((grouped[tier.id] || []).length / columns) * (cardH + gap) - gap));
    const H = Math.max(1080, 224 + tierHeights.reduce((sum, height) => sum + height, 0) + 24 * (CHAMPION_TIERS.length - 1) + 100);
    canvas.width = W;
    canvas.height = H;

    const images = new Map();
    const logoPromise = pngLoadImage("/assets/nxt5-wordmark.png");
    await Promise.all(allRows.map(async (row) => {
      const sources = championPortraitSources(row, row?.champion);
      let image = await pngLoadImage(sources[0]);
      if (!image && sources.length > 1) image = await pngLoadImage(sources[1]);
      images.set(championAssetId(row.champion) || row.champion, image);
    }));
    pngBackground(ctx, W, H);
    pngHeader(ctx, { width: W, title: "Champion Pool", subtitle: `${player?.name || "Joueur"} · ${roleLabel(player?.role || "")} · ${allRows.length} champion${allRows.length > 1 ? "s" : ""}`, eyebrow: "Préparation équipe", logo: await logoPromise });

    let y = 224;
    CHAMPION_TIERS.forEach((tier, tierIndex) => {
      const tierRows = grouped[tier.id] || [];
      const tierH = tierHeights[tierIndex];
      pngPanel(ctx, margin, y, contentW, tierH, { accent: tier.tone });
      pngFitText(ctx, POOL_TIER_LABELS[tier.id], margin + 28, y + 48, labelW - 52, { font: "700 26px Inter, Arial, sans-serif", color: pngAccent(tier.tone), min: 24 });
      pngFitText(ctx, `${tierRows.length} champion${tierRows.length > 1 ? "s" : ""}`, margin + 28, y + 81, labelW - 52, { font: "500 18px Inter, Arial, sans-serif", color: PNG_THEME.muted });
      hints[tierIndex].forEach((line, index) => pngFitText(ctx, line, margin + 28, y + 113 + index * 25, labelW - 48, { font: hintFont, color: PNG_THEME.muted, min: 18 }));
      pngLine(ctx, margin + labelW, y + 24, margin + labelW, y + tierH - 24);
      if (!tierRows.length) pngFitText(ctx, "Aucun champion dans cette catégorie.", margin + labelW + 24, y + 87, contentW - labelW - 48, { font: "500 21px Inter, Arial, sans-serif", color: PNG_THEME.muted });
      tierRows.forEach((row, index) => {
        const x = margin + labelW + 24 + (index % columns) * (cardW + gap);
        const cardY = y + 24 + Math.floor(index / columns) * (cardH + gap);
        const name = championDisplayName(row.champion);
        pngPanel(ctx, x, cardY, cardW, cardH, { fill: PNG_THEME.panelAlt, radius: 12 });
        const portrait = images.get(championAssetId(row.champion) || row.champion);
        if (!pngImageCover(ctx, portrait, x + 16, cardY + 16, 64, 64, 10)) {
          pngPanel(ctx, x + 16, cardY + 16, 64, 64, { fill: pngTint(tier.tone, 0.12), stroke: null, radius: 10 });
          pngFitText(ctx, name.slice(0, 2).toUpperCase(), x + 48, cardY + 56, 54, { font: "700 22px Inter, Arial, sans-serif", color: pngAccent(tier.tone), align: "center" });
        }
        const games = Number(row.games || 0);
        pngFitText(ctx, name, x + 96, cardY + (games ? 41 : 55), cardW - 112, { font: "700 24px Inter, Arial, sans-serif", min: 20 });
        if (games) {
          const explicitWinrate = row.winrate !== undefined && row.winrate !== null && row.winrate !== "";
          const winrate = explicitWinrate ? Number(row.winrate) : Math.round(Number(row.wins || 0) / games * 100);
          pngFitText(ctx, `${games} games${Number.isFinite(winrate) ? ` · ${Math.round(winrate)} % WR` : ""}`, x + 96, cardY + 70, cardW - 112, { font: "500 18px Inter, Arial, sans-serif", color: PNG_THEME.muted });
        }
      });
      y += tierH + 24;
    });
    pngFooter(ctx, { width: W, height: H, label: "Champion Pool" });
    await pngDownload(canvas, `nxt5-tier-list-${safeExportFilename(player?.name, "joueur")}-${new Date().toISOString().slice(0, 10)}.png`);
    pushToast?.({ type: "cyan", title: "Tier list exportée", text: "Le PNG du Champion Pool a été téléchargé." });
  } catch (err) {
    pushToast?.({ type: "red", title: "Export impossible", text: err?.message || "Le navigateur n'a pas pu générer le PNG." });
  }
}

function championSplashFocus(champion, focus = "default") {
  if (focus !== "face") return "center center";
  const id = championAssetId(champion);
  const overrides = {
    Aatrox: "50% 18%",
    Alistar: "48% 20%",
    AurelionSol: "52% 18%",
    Azir: "50% 22%",
    Bard: "50% 20%",
    Blitzcrank: "48% 22%",
    Chogath: "48% 18%",
    Darius: "25% 23%",
    Galio: "50% 18%",
    Hecarim: "50% 22%",
    JarvanIV: "64% 25%",
    Jhin: "48% 24%",
    Karma: "64% 26%",
    Khazix: "48% 20%",
    KogMaw: "50% 24%",
    Lissandra: "46% 24%",
    Malphite: "50% 20%",
    Nautilus: "50% 20%",
    Nocturne: "50% 22%",
    Ornn: "50% 22%",
    Rammus: "50% 24%",
    RekSai: "50% 22%",
    Renata: "48% 24%",
    Skarner: "50% 20%",
    TahmKench: "50% 24%",
    Thresh: "50% 22%",
    Velkoz: "50% 20%",
    Warwick: "50% 22%",
    Yunara: "58% 26%",
    Zac: "50% 22%",
  };
  return overrides[id] || "50% 22%";
}

function ChampionBackdrop({ champion, focus = "default" }) {
  const url = championSplashUrl(champion);
  if (!url) return null;
  const focused = focus === "face";
  const position = championSplashFocus(champion, focus);
  return <div className={cx("absolute inset-0", focused ? "opacity-58" : "opacity-42")} aria-hidden="true"><img src={url} alt="" className="h-full w-full object-cover saturate-[1.18] blur-[1.5px]" loading="lazy" decoding="async" style={{ objectPosition: position, transform: focused ? "scale(2.25)" : "scale(1.08)", transformOrigin: position }} /><div className={cx("absolute inset-0", focused ? "bg-gradient-to-r from-[#050711]/82 via-[#050711]/60 to-[#050711]/28" : "bg-gradient-to-r from-[#070b16]/90 via-[#070b16]/70 to-[#070b16]/25")} /></div>;
}

const COMP_ROLES = ["TOP", "JGL", "MID", "ADC", "SUP"];

const ROLE_ORDER = Object.fromEntries(COMP_ROLES.map((role, index) => [role, index]));

function sortPlayersByRole(players = []) {
  return [...players].sort((a, b) => (ROLE_ORDER[String(a.role || "").toUpperCase()] ?? 99) - (ROLE_ORDER[String(b.role || "").toUpperCase()] ?? 99) || String(a.name || "").localeCompare(String(b.name || "")));
}

const STAFF_ROLES = ["COACH", "ASSISTANT", "ANALYST", "MANAGER", "BOARD"];

const ROSTER_ROLE_ORDER = COMP_ROLES;

const TEAM_ACCESS_ROLES = [
  ["player", "Joueur"],
  ["coach", "Coach"],
  ["assistant", "Assistant coach"],
  ["analyst", "Analyste"],
  ["manager", "Manager"],
  ["board", "Board"],
  ["captain", "Capitaine"],
];

const STAFF_ACCESS_ROLE_IDS = TEAM_ACCESS_ROLES.map(([id]) => id).filter((id) => id !== "player");

function canStaffManage(role) {
  return ["owner", ...STAFF_ACCESS_ROLE_IDS].includes(String(role || "").toLowerCase());
}

function isGameplayRole(role) {
  return [...COMP_ROLES, "SUB"].includes(String(role || "").toUpperCase());
}

function isStaffRole(role) {
  return STAFF_ROLES.includes(String(role || "").toUpperCase());
}

function formatPoints(value) {
  const number = Number(value || 0);
  const sign = number < 0 ? "-" : "";
  const abs = Math.abs(number);
  if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}${Math.round(abs / 1000)}k`;
  return `${sign}${abs}`;
}

function formatGoldDiff(value) {
  const number = Math.round(Number(value || 0));
  return `${number >= 0 ? "+" : "-"}${Math.abs(number)}`;
}

function teamMatchRows(matches = [], teamKey = "ALLY") {
  return (matches || []).flatMap((match) => (match.participants || [])
    .filter((row) => row.team_key === teamKey)
    .map((row) => ({ ...row, match, role: normalizeProfileRole(row.role || row.raw?.teamPosition || row.raw?.individualPosition || row.raw?.lane) })));
}

function playerDisplayFromRow(row, players = []) {
  const linked = players.find((player) => String(player.id || "") === String(row?.player_id || ""));
  return linked?.name || row?.summoner_name || row?.riot_id || roleLabel(row?.role || "ROLE");
}

function buildStaffAlerts(matches = [], players = []) {
  const rows = teamMatchRows(matches, "ALLY");
  const wins = matches.filter((match) => match.result === "Victoire").length;
  const losses = matches.length - wins;
  const sideGroups = ["Blue", "Red"].map((side) => {
    const sideMatches = matches.filter((match) => String(match.side || "").toLowerCase().includes(side.toLowerCase()));
    const sideWins = sideMatches.filter((match) => match.result === "Victoire").length;
    return { side, games: sideMatches.length, wins: sideWins, wr: Math.round((sideWins / Math.max(1, sideMatches.length)) * 100) };
  });
  const roleRows = ROSTER_ROLE_ORDER.map((role) => {
    const roleItems = rows.filter((row) => row.role === role);
    const games = roleItems.length;
    const deaths = roleItems.reduce((sum, row) => sum + Number(row.deaths || 0), 0) / Math.max(1, games);
    const kp = roleItems.reduce((sum, row) => sum + parsePercent(row.kill_participation || row.kp || 0), 0) / Math.max(1, games);
    const damage = roleItems.reduce((sum, row) => sum + Number(row.damage || 0), 0) / Math.max(1, games);
    return { role, games, deaths, kp, damage, sample: roleItems.slice().sort((a, b) => Number(b.deaths || 0) - Number(a.deaths || 0))[0] };
  }).filter((item) => item.games);
  const playerRows = Array.from(rows.reduce((map, row) => {
    const key = row.player_id || `${row.role}-${row.riot_id || row.summoner_name || row.champion}`;
    const current = map.get(key) || { name: playerDisplayFromRow(row, players), role: row.role, games: 0, deaths: 0, kp: 0, champions: new Map(), rows: [] };
    current.games += 1;
    current.deaths += Number(row.deaths || 0);
    current.kp += parsePercent(row.kill_participation || row.kp || 0);
    current.champions.set(row.champion, (current.champions.get(row.champion) || 0) + 1);
    current.rows.push(row);
    map.set(key, current);
    return map;
  }, new Map()).values()).map((item) => ({ ...item, avgDeaths: item.deaths / Math.max(1, item.games), avgKp: item.kp / Math.max(1, item.games), mainChampion: Array.from(item.champions.entries()).sort((a, b) => b[1] - a[1])[0] }));
  const exposed = playerRows.slice().sort((a, b) => b.avgDeaths - a.avgDeaths)[0];
  const disconnected = playerRows.slice().sort((a, b) => a.avgKp - b.avgKp)[0];
  const weakRole = roleRows.slice().sort((a, b) => b.deaths - a.deaths || a.kp - b.kp)[0];
  const sideGap = sideGroups[0]?.games && sideGroups[1]?.games ? Math.abs(sideGroups[0].wr - sideGroups[1].wr) : 0;
  const worseSide = sideGroups.slice().sort((a, b) => a.wr - b.wr)[0];
  return [
    matches.length < 3 && { title: "Pas assez de volume", text: `${matches.length} game${matches.length > 1 ? "s" : ""} importée${matches.length > 1 ? "s" : ""}. Lire les signaux comme des hypothèses.`, action: "Importer le prochain bloc avant de conclure.", toneName: "slate", icon: Upload },
    losses >= wins && matches.length >= 3 && { title: "Bloc à stabiliser", text: `${wins}W - ${losses}L sur le contexte actif.`, action: "Choisir une seule priorité équipe avant la prochaine session.", toneName: "orange", icon: AlertTriangle },
    exposed?.games >= 2 && exposed.avgDeaths >= 4 && { title: "Exposition joueur", text: `${exposed.name} est à ${exposed.avgDeaths.toFixed(1)} morts/game.`, action: `Ouvrir ${matchDisplayName(exposed.rows.slice().sort((a, b) => Number(b.deaths || 0) - Number(a.deaths || 0))[0]?.match, "la game source")} et classer les morts.`, toneName: "red", icon: Shield },
    disconnected?.games >= 2 && disconnected.avgKp < 52 && { title: "Connexion fights", text: `${disconnected.name} descend à ${Math.round(disconnected.avgKp)}% KP moyen.`, action: "Revoir le move 30s avant les deux premiers objectifs.", toneName: "yellow", icon: Swords },
    weakRole?.games >= 2 && { title: "Rôle à review", text: `${roleLabel(weakRole.role)} ressort comme le rôle le plus fragile du bloc.`, action: weakRole.sample ? `Source : ${matchDisplayName(weakRole.sample.match, "game")} sur ${championDisplayName(weakRole.sample.champion)}.` : "Comparer lane, morts et KP.", toneName: "purple", icon: Target },
    sideGap >= 20 && worseSide?.games >= 2 && { title: "Side faible", text: `${worseSide.side} side tombe à ${worseSide.wr}% WR.`, action: "Préparer un plan draft et une condition de victoire spécifique à ce side.", toneName: "cyan", icon: BarChart3 },
  ].filter(Boolean).slice(0, 6);
}

function formatCountdown(seconds) {
  const safe = Math.max(0, Math.ceil(Number(seconds || 0)));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return minutes ? `${minutes}:${String(rest).padStart(2, "0")}` : `${rest}s`;
}

function normalizeProfileKey(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "").replace("#", "-");
}

function normalizeProfileRole(value) {
  const raw = String(value || "").toUpperCase();
  if (raw === "JUNGLE") return "JGL";
  if (raw === "MIDDLE") return "MID";
  if (raw === "BOTTOM") return "ADC";
  if (raw === "UTILITY" || raw === "SUPPORT") return "SUP";
  return raw;
}

function playerIntegratedRows(player, matches = []) {
  const riotKey = normalizeProfileKey(player?.riot_id);
  const nameKey = normalizeProfileKey(player?.name);
  const playerRole = normalizeProfileRole(player?.role);
  const seen = new Set();
  return matches.flatMap((match) => (match.participants || []).map((row) => ({ ...row, match }))).filter((row) => {
    const rowRole = normalizeProfileRole(row.role || row.raw?.teamPosition || row.raw?.individualPosition || row.raw?.lane);
    const roleMatches = !playerRole || playerRole === "SUB" || rowRole === playerRole;
    const rowPlayerId = String(row.player_id || "");
    const playerId = String(player?.id || "");
    const rowRiotKey = normalizeProfileKey(row.riot_id);
    const rowSummonerKey = normalizeProfileKey(row.summoner_name);
    const identityMatches = rowPlayerId
      ? rowPlayerId === playerId
      : (Boolean(riotKey) && rowRiotKey === riotKey) || (Boolean(nameKey) && rowSummonerKey === nameKey);
    if (!(row.team_key === "ALLY" && roleMatches && identityMatches)) return false;
    const key = [row.match?.id || row.match?.game_id, row.raw?.participantId || row.participant_id || row.role, row.player_id || row.riot_id || row.summoner_name || player?.id, row.champion].map((value) => String(value || "")).join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchImportDateLabel(match) {
  const value = match?.created_at || match?.createdAt || match?.imported_at || "";
  if (!value) return "Date d'import inconnue";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const day = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(date);
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date);
  return `${day} à ${time}`;
}

function matchCategoryTone(category) {
  return ["cyan", "purple", "pink", "green", "yellow", "orange", "red", "blue", "slate"].includes(String(category?.color || "")) ? category.color : "slate";
}

function CategoryFilter({ categories, selectedCategoryId, onSelect, label = "Catégories" }) {
  return <div className="flex min-w-0 flex-wrap items-center gap-2">
    <span className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-slate-300">{label}</span>
    <button type="button" onClick={() => onSelect("")} className={cx("rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] transition", !selectedCategoryId ? "border-cyan-200/45 bg-cyan-400/14 text-cyan-50" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]")}>Toutes</button>
    {(categories || []).map((category) => <button key={category.id} type="button" onClick={() => onSelect(String(category.id) === String(selectedCategoryId) ? "" : category.id)} className={cx("rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] transition", String(category.id) === String(selectedCategoryId) ? tone(matchCategoryTone(category)) : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]")}>{category.name}</button>)}
  </div>;
}

function itemIconSources(itemId) {
  const id = Number(itemId || 0);
  if (!id) return [];
  return [...new Set([
    ...DDRAGON_FALLBACK_VERSIONS.map((version) => assetProxyUrl(`https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`)),
    assetProxyUrl(`https://raw.communitydragon.org/latest/game/assets/items/icons2d/${id}.png`),
    assetProxyUrl(`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/items/icons2d/${id}.png`),
  ])];
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

const SUMMONER_SPELLS = {
  1: "SummonerBoost",
  3: "SummonerExhaust",
  4: "SummonerFlash",
  6: "SummonerHaste",
  7: "SummonerHeal",
  11: "SummonerSmite",
  12: "SummonerTeleport",
  13: "SummonerMana",
  14: "SummonerDot",
  21: "SummonerBarrier",
  32: "SummonerSnowball",
};

function summonerSpellIconSources(spellId) {
  const name = SUMMONER_SPELLS[Number(spellId || 0)];
  if (!name) return [];
  return [...new Set([
    ...DDRAGON_FALLBACK_VERSIONS.map((version) => assetProxyUrl(`https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${name}.png`)),
    assetProxyUrl(`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/data/spells/icons2d/${name.toLowerCase()}.png`),
  ])];
}

function participantStoredRaw(row) {
  const raw = typeof row?.raw === "string" ? safeJsonParse(row.raw, {}) : row?.raw || {};
  return raw;
}

function participantRaw(row) {
  const raw = participantStoredRaw(row);
  return raw?.participant || raw?.stats || raw;
}

function itemIndexFromKey(key) {
  const match = String(key).match(/^item([0-6])(?:Id)?$/i);
  return match ? Number(match[1]) : null;
}

function participantSources(row) {
  const raw = participantStoredRaw(row);
  return [row, raw, raw?.participant, raw?.stats, raw?.participant?.stats, raw?.challenges, raw?.participant?.challenges, participantRaw(row)].filter((source, index, list) => source && list.indexOf(source) === index);
}

function participantNumber(row, ...keys) {
  const sources = participantSources(row);
  for (const source of sources) {
    for (const key of keys) {
      const value = Number(source?.[key] ?? 0);
      if (value) return value;
    }
  }
  for (const key of keys) {
    const itemIndex = itemIndexFromKey(key);
    if (itemIndex !== null) {
      for (const source of sources) {
        const value = Number(source?.items?.[itemIndex] ?? source?.itemIds?.[itemIndex] ?? source?.stats?.items?.[itemIndex] ?? source?.stats?.itemIds?.[itemIndex] ?? source?.participant?.items?.[itemIndex] ?? source?.participant?.itemIds?.[itemIndex] ?? source?.participant?.stats?.items?.[itemIndex] ?? source?.participant?.stats?.itemIds?.[itemIndex] ?? 0);
        if (value) return value;
      }
    }
  }
  return 0;
}

function itemSlots(row) {
  return [0, 1, 2, 3, 4, 5].map((index) => participantNumber(row, `item${index}`, `item${index}Id`));
}

function trinketItemId(row) {
  return participantNumber(row, "item6", "item6Id", "trinket", "trinketItemId");
}

function storedTimelineFrames(match) {
  return match?.raw?.timeline?.info?.frames
    || match?.raw?.metadata?.timeline?.info?.frames
    || match?.raw?.timeline?.frames
    || match?.raw?.timeline?.timeline?.info?.frames
    || match?.raw?.timeline?.timeline?.frames
    || [];
}

function compactTimelineEvents(match) {
  const events = match?.raw?.nxt5?.timelineEvents;
  return Array.isArray(events) ? events : [];
}

function matchTimelineFrames(match) {
  const frames = storedTimelineFrames(match);
  if (frames.length) return frames;
  const events = compactTimelineEvents(match);
  return events.length ? [{ timestamp: 0, events }] : [];
}

function summonerSpellIds(row) {
  const sources = participantSources(row);
  const spellFromList = (index) => {
    for (const source of sources) {
      const value = Number(source?.summonerSpells?.[index] ?? source?.spells?.[index] ?? source?.stats?.summonerSpells?.[index] ?? source?.stats?.spells?.[index] ?? 0);
      if (value) return value;
    }
    return 0;
  };
  const first = participantNumber(row, "summoner1Id", "spell1Id") || spellFromList(0);
  const second = participantNumber(row, "summoner2Id", "spell2Id") || spellFromList(1);
  return [first, second].filter(Boolean);
}

function parsePercent(value) {
  if (typeof value === "string" && value.includes("%")) return Number(value.replace("%", "")) || 0;
  return Number(value || 0) * (Number(value || 0) <= 1 ? 100 : 1);
}

function statValue(row, key, fallback = 0) {
  return Number(row?.[key] ?? row?.raw?.[key] ?? fallback) || 0;
}

function creepScore(row) {
  const raw = participantRaw(row);
  const combined = Number(raw?.totalMinionsKilled || 0) + Number(raw?.neutralMinionsKilled || 0);
  return Number(row?.cs ?? row?.creep_score ?? row?.total_cs ?? (combined || raw?.totalMinionsKilled || raw?.neutralMinionsKilled || 0)) || 0;
}

function teamRows(match, team = "ALLY") {
  return (match?.participants || []).filter((row) => row.team_key === team);
}

function sumRows(rows, key) {
  return rows.reduce((total, row) => total + statValue(row, key), 0);
}

function shareOfTeam(row, rows, key) {
  return (statValue(row, key) / Math.max(1, sumRows(rows, key))) * 100;
}

function rowParticipantId(row) {
  return Number(row?.raw?.participantId || row?.participantId || 0);
}

function objectiveEventLabel(event) {
  const monster = String(event?.monsterType || "").toUpperCase();
  const subtype = String(event?.monsterSubType || "").toUpperCase().replace("HEXTECH", "HEXTECH");
  if (monster === "DRAGON") {
    const element = subtype.replace("_DRAGON", "").replace(/_/g, " ").toLowerCase();
    return element ? `${element.charAt(0).toUpperCase()}${element.slice(1)} Dragon` : "Dragon";
  }
  if (monster === "BARON_NASHOR") return "Nashor";
  if (monster === "RIFTHERALD") return "Herald";
  if (monster === "HORDE") return "Void Grubs";
  return monster ? monster.replace(/_/g, " ") : "Objectif";
}

function objectiveEventType(event) {
  const label = objectiveEventLabel(event).toLowerCase();
  if (label.includes("nashor")) return "baron";
  if (label.includes("herald")) return "herald";
  if (label.includes("grub")) return "grub";
  if (label.includes("tower") || label.includes("tour")) return "tower";
  return "dragon";
}

function objectiveEvents(match) {
  const frames = matchTimelineFrames(match);
  const timelineEvents = frames.flatMap((frame) => frame.events || []);
  const compactObjectives = match?.raw?.nxt5?.objectiveEvents;
  const events = timelineEvents.length ? timelineEvents : Array.isArray(compactObjectives) ? compactObjectives : [];
  const participantTeam = participantTeamMap(match);
  const allyTeamId = Number(teamRows(match, "ALLY")[0]?.raw?.teamId || 0);
  return events.filter((event) => event.type === "ELITE_MONSTER_KILL").map((event) => {
    const killerTeamId = Number(event.killerTeamId || participantTeam.get(Number(event.killerId)) || 0);
    return {
      ...event,
      teamKey: killerTeamId && allyTeamId && killerTeamId === allyTeamId ? "ALLY" : "ENEMY",
      side: killerTeamId === 100 ? "BLUE" : killerTeamId === 200 ? "RED" : "",
      time: formatCountdown(Math.floor(Number(event.timestamp || 0) / 1000)),
      label: objectiveEventLabel(event),
    };
  }).sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
}

function objectiveTeamId(match, teamKey) {
  return Number(teamRows(match, teamKey)[0]?.raw?.teamId || 0);
}

function objectiveTeamValue(match, name, teamKey) {
  const teamId = objectiveTeamId(match, teamKey);
  const rawTeam = match?.raw?.info?.teams?.find((team) => Number(team.teamId) === teamId);
  const objectives = rawTeam?.objectives || {};
  const direct = objectives?.[name]?.kills;
  if (direct !== undefined && direct !== null) return Number(direct || 0);
  const normalized = String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const found = Object.entries(objectives).find(([key]) => String(key || "").toLowerCase().replace(/[^a-z0-9]/g, "") === normalized);
  return Number(found?.[1]?.kills || 0);
}

function objectiveTeamAnyValue(match, teamKey, names) {
  return Math.max(0, ...names.map((name) => objectiveTeamValue(match, name, teamKey)));
}

function objectiveTeamSummary(match, teamKey) {
  const events = objectiveEvents(match);
  const teamEvents = events.filter((event) => event.teamKey === teamKey);
  const dragons = teamEvents.filter((event) => objectiveEventType(event) === "dragon");
  const rawDragons = objectiveTeamAnyValue(match, teamKey, ["dragon"]);
  const rawGrubs = objectiveTeamAnyValue(match, teamKey, ["horde", "voidgrub", "voidGrubs", "grub", "grubs"]);
  const rawHeralds = objectiveTeamAnyValue(match, teamKey, ["riftHerald", "riftHeralds", "herald"]);
  const rawBarons = objectiveTeamAnyValue(match, teamKey, ["baron", "baronNashor"]);
  const rawTowers = objectiveTeamAnyValue(match, teamKey, ["tower", "towers"]);
  if (events.length) {
    return {
      dragons,
      dragonCount: Math.max(dragons.length, rawDragons),
      grubs: Math.max(teamEvents.filter((event) => objectiveEventType(event) === "grub").length, rawGrubs),
      heralds: Math.max(teamEvents.filter((event) => objectiveEventType(event) === "herald").length, rawHeralds),
      barons: Math.max(teamEvents.filter((event) => objectiveEventType(event) === "baron").length, rawBarons),
      towers: rawTowers,
    };
  }
  return {
    dragons: [],
    dragonCount: rawDragons,
    grubs: rawGrubs,
    heralds: rawHeralds,
    barons: rawBarons,
    towers: rawTowers,
  };
}

function diffTone(value) {
  return Number(value || 0) >= 0 ? "green" : "red";
}

function participantTeamMap(match) {
  const storedParticipants = match?.raw?.info?.participants || [];
  const participants = storedParticipants.length ? storedParticipants : (match?.participants || []).map((row) => ({
    participantId: rowParticipantId(row),
    teamId: Number(row?.raw?.teamId || 0),
  }));
  return new Map(participants.map((participant) => [Number(participant.participantId), Number(participant.teamId)]));
}

function HudIcon({ src, sources, label, fallback, emptyText = "VIDE", toneName = "cyan", className = "" }) {
  const sourceList = useMemo(() => [...new Set([...(Array.isArray(sources) ? sources : []), src].filter(Boolean))], [src, sources]);
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => setSourceIndex(0), [sourceList.join("|")]);
  const source = sourceList[sourceIndex];
  const active = Boolean(source);
  return <div title={label} className={cx("relative aspect-square min-h-0 min-w-0 overflow-hidden rounded-xl border bg-black/35", active ? toneName === "pink" ? "border-fuchsia-200/25 shadow-[0_0_14px_rgba(217,70,239,.10)]" : "border-cyan-200/20 shadow-[0_0_14px_rgba(34,211,238,.10)]" : "border-white/8 opacity-45", className)}>
    {active ? <>
      <img src={source} alt={label} className="h-full w-full object-cover" loading="lazy" decoding="async" onError={() => setSourceIndex((index) => index + 1)} />
      <span className="hidden h-full w-full items-center justify-center px-1 text-center text-[0.54rem] font-black text-slate-300">{fallback}</span>
    </> : <span className="flex h-full w-full items-center justify-center px-1 text-center text-[0.54rem] font-black text-slate-300">{emptyText}</span>}
  </div>;
}

function championPoolStatus(row) {
  const status = String(row?.status || "");
  return ["lock", "pocket", "work", "danger"].includes(status) ? status : "work";
}

function championPoolStatusLabel(status) {
  return status === "lock" ? "Pick de confiance" : status === "danger" ? "Pick en développement training" : status === "pocket" ? "Pick situationnel" : "Pick en validation";
}

function championPoolStatusTone(status) {
  return status === "lock" ? "green" : status === "danger" ? "red" : status === "pocket" ? "yellow" : "cyan";
}

const CHAMPION_TIERS = [
  { id: "lock", title: "Pick de confiance", hint: "Pick fiable, prêt pour scrim ou match.", tone: "green" },
  { id: "pocket", title: "Pick situationnel", hint: "Bon pick à sortir dans un contexte précis.", tone: "yellow" },
  { id: "work", title: "Pick en validation", hint: "Bonne perf en scrim, à valider avant de le prioriser.", tone: "cyan" },
  { id: "danger", title: "Pick en développement training", hint: "Besoin d’au moins 15 games de training avant validation.", tone: "red" },
];

function championTierFrame(tier, active = false) {
  const t = tier?.tone || "cyan";
  const base = {
    green: "border-emerald-300/24 bg-emerald-400/[0.075] text-emerald-200 shadow-[0_0_28px_rgba(52,211,153,.08)]",
    yellow: "border-amber-300/24 bg-amber-300/[0.075] text-amber-200 shadow-[0_0_28px_rgba(251,191,36,.08)]",
    cyan: "border-cyan-300/24 bg-cyan-400/[0.075] text-cyan-200 shadow-[0_0_28px_rgba(34,211,238,.08)]",
    red: "border-rose-300/24 bg-rose-500/[0.075] text-rose-200 shadow-[0_0_28px_rgba(244,63,94,.08)]",
  }[t] || "border-cyan-300/24 bg-cyan-400/[0.075]";
  const strong = {
    green: "border-emerald-200/55 bg-emerald-300/18 text-emerald-100 shadow-[0_0_22px_rgba(52,211,153,.20)]",
    yellow: "border-amber-200/55 bg-amber-300/18 text-amber-100 shadow-[0_0_22px_rgba(251,191,36,.18)]",
    cyan: "border-cyan-200/55 bg-cyan-300/18 text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,.20)]",
    red: "border-rose-200/55 bg-rose-400/18 text-rose-100 shadow-[0_0_22px_rgba(244,63,94,.18)]",
  }[t] || base;
  return active ? strong : base;
}

function championTierColumnFrame(tier) {
  const t = tier?.tone || "cyan";
  return {
    green: "border-emerald-200/32 bg-[linear-gradient(135deg,rgba(6,95,70,.30),rgba(2,6,23,.58)_46%,rgba(16,185,129,.12))] shadow-[inset_0_1px_0_rgba(255,255,255,.10),0_0_34px_rgba(52,211,153,.12)]",
    yellow: "border-amber-200/32 bg-[linear-gradient(135deg,rgba(146,64,14,.28),rgba(2,6,23,.58)_46%,rgba(251,191,36,.12))] shadow-[inset_0_1px_0_rgba(255,255,255,.10),0_0_34px_rgba(251,191,36,.10)]",
    cyan: "border-cyan-200/32 bg-[linear-gradient(135deg,rgba(8,145,178,.28),rgba(2,6,23,.58)_46%,rgba(34,211,238,.12))] shadow-[inset_0_1px_0_rgba(255,255,255,.10),0_0_34px_rgba(34,211,238,.12)]",
    red: "border-rose-200/32 bg-[linear-gradient(135deg,rgba(159,18,57,.28),rgba(2,6,23,.58)_46%,rgba(244,63,94,.12))] shadow-[inset_0_1px_0_rgba(255,255,255,.10),0_0_34px_rgba(244,63,94,.12)]",
  }[t] || "border-cyan-200/32 bg-cyan-400/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,.10),0_0_34px_rgba(34,211,238,.12)]";
}

function championTierColumnGlow(tier) {
  const t = tier?.tone || "cyan";
  return {
    green: "from-emerald-300/13 via-transparent to-emerald-400/8",
    yellow: "from-amber-300/13 via-transparent to-amber-400/8",
    cyan: "from-cyan-300/13 via-transparent to-cyan-400/8",
    red: "from-rose-300/13 via-transparent to-rose-400/8",
  }[t] || "from-cyan-300/13 via-transparent to-cyan-400/8";
}

function ChampionTierMark({ tier, active = false, className = "" }) {
  const Icon = tier?.id === "lock" ? ShieldCheck : tier?.id === "pocket" ? Flame : tier?.id === "danger" ? AlertTriangle : Gauge;
  return <span className={cx("relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border transition", championTierFrame(tier, active), className)}>
    <Icon className="relative z-10 h-5 w-5 drop-shadow-[0_0_10px_rgba(255,255,255,.20)]" />
    <span className="pointer-events-none absolute inset-x-1 bottom-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
  </span>;
}

const CHAMPION_LANE_POOLS = {
  TOP: ["Aatrox", "Camille", "Chogath", "Darius", "DrMundo", "Fiora", "Gangplank", "Garen", "Gnar", "Gwen", "Irelia", "Jax", "Jayce", "Kayle", "Kennen", "Kled", "KSante", "Malphite", "MonkeyKing", "Mordekaiser", "Nasus", "Olaf", "Ornn", "Pantheon", "Poppy", "Quinn", "Renekton", "Riven", "Rumble", "Ryze", "Sett", "Shen", "Singed", "Sion", "Teemo", "Tryndamere", "Urgot", "Vladimir", "Volibear", "Warwick", "Yone", "Yorick"],
  JGL: ["Amumu", "Diana", "Ekko", "Elise", "Evelynn", "Fiddlesticks", "Gragas", "Graves", "Hecarim", "Ivern", "JarvanIV", "Karthus", "Kayn", "Khazix", "Kindred", "LeeSin", "Lillia", "Maokai", "MasterYi", "MonkeyKing", "Nidalee", "Nocturne", "Nunu", "Olaf", "Poppy", "Rammus", "RekSai", "Rengar", "Sejuani", "Shyvana", "Skarner", "Taliyah", "Trundle", "Udyr", "Vi", "Viego", "Volibear", "Warwick", "XinZhao", "Zac"],
  MID: ["Ahri", "Akali", "Anivia", "Annie", "AurelionSol", "Azir", "Cassiopeia", "Corki", "Diana", "Ekko", "Fizz", "Galio", "Hwei", "Irelia", "Kassadin", "Katarina", "Leblanc", "Lissandra", "Lux", "Malzahar", "Neeko", "Orianna", "Qiyana", "Ryze", "Sylas", "Syndra", "Taliyah", "Talon", "TwistedFate", "Veigar", "Velkoz", "Vex", "Viktor", "Vladimir", "Xerath", "Yasuo", "Yone", "Zed", "Ziggs", "Zoe"],
  ADC: ["Aphelios", "Ashe", "Caitlyn", "Draven", "Ezreal", "Jhin", "Jinx", "Kaisa", "Kalista", "KogMaw", "Lucian", "MissFortune", "Nilah", "Samira", "Senna", "Seraphine", "Sivir", "Smolder", "Tristana", "Twitch", "Varus", "Vayne", "Xayah", "Zeri", "Ziggs"],
  SUP: ["Alistar", "Ashe", "Bard", "Blitzcrank", "Brand", "Braum", "Janna", "Karma", "Leona", "Lulu", "Lux", "Maokai", "Milio", "Morgana", "Nami", "Nautilus", "Pyke", "Rakan", "Rell", "Renata", "Senna", "Seraphine", "Sona", "Soraka", "Swain", "TahmKench", "Taric", "Thresh", "Yuumi", "Zilean", "Zyra"],
};

const ADDITIONAL_CHAMPION_LANE_POOLS = {
  TOP: ["Ambessa", "Aurora", "Illaoi", "Zaahen"],
  JGL: ["Belveth", "Briar", "Shaco", "Zaahen"],
  MID: ["Akshan", "Aurora", "Locke", "Mel", "Naafiri"],
  ADC: ["Mel", "Yunara"],
  SUP: ["Mel"],
};

const ALL_CHAMPION_LANE_POOLS = Object.fromEntries(
  Object.keys(CHAMPION_LANE_POOLS).map((lane) => [lane, [...new Set([...(CHAMPION_LANE_POOLS[lane] || []), ...(ADDITIONAL_CHAMPION_LANE_POOLS[lane] || [])])]])
);

function championMatchesLane(champion, lane) {
  if (!lane || lane === "ALL") return true;
  const id = championAssetId(champion);
  return (ALL_CHAMPION_LANE_POOLS[lane] || []).includes(id);
}

export { ROSTER_ROLE_ORDER, COMP_ROLES, canStaffManage, STAFF_ACCESS_ROLE_IDS, TEAM_ACCESS_ROLES, isGameplayRole, isStaffRole, STAFF_ROLES, lazyNamed, loadNextPhase, championDisplayName, championAssetId, CHAMPION_ASSET_ALIASES, championKey, sortPlayersByRole, ROLE_ORDER, teamMatchRows, normalizeProfileRole, buildStaffAlerts, playerDisplayFromRow, parsePercent, formatCountdown, ChampionPortrait, championPortraitSources, DDRAGON_FALLBACK_VERSIONS, playerIntegratedRows, normalizeProfileKey, matchCategoryTone, matchImportDateLabel, championMatchesLane, ALL_CHAMPION_LANE_POOLS, CHAMPION_LANE_POOLS, ADDITIONAL_CHAMPION_LANE_POOLS, formatPoints, formatGoldDiff, objectiveTeamId, teamRows, sumRows, statValue, storedTimelineFrames, compactTimelineEvents, diffTone, matchTimelineFrames, participantTeamMap, rowParticipantId, objectiveEvents, objectiveEventLabel, objectiveEventType, compositionIdentity, championStyleTags, ALL_CHAMPION_STYLE_TAGS, CHAMPION_STYLE_TAGS, ADDITIONAL_CHAMPION_STYLE_TAGS, championStyleTone, tagLabel, objectiveTeamSummary, objectiveTeamAnyValue, objectiveTeamValue, ChampionBackdrop, championSplashUrl, championSplashFocus, itemIconSources, summonerSpellIconSources, SUMMONER_SPELLS, itemSlots, participantNumber, itemIndexFromKey, participantSources, participantStoredRaw, safeJsonParse, participantRaw, trinketItemId, summonerSpellIds, creepScore, HudIcon, shareOfTeam, CategoryFilter, championPoolRowsByTier, championPoolStatus, CHAMPION_TIERS, exportChampionTierListPng, safeExportFilename, championTierColumnFrame, championTierColumnGlow, ChampionTierMark, championTierFrame, championPoolStatusLabel, championPoolStatusTone };

export const POOL_TIER_LABELS = { lock: "Confiance", pocket: "Situationnel", work: "En validation", danger: "En training" };
