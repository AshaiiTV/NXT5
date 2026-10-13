import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React, { useId, useMemo, useState } from "react";
import { BookOpen, Check, ChevronLeft, ChevronRight, ChevronsRight, Clock3, Copy, Download, FileJson, FileText, Hash, Image as ImageIcon, Link2, Maximize2, MessageSquare, Plus, Repeat2, RotateCcw, Search, Swords, Users } from "lucide-react";
import { RoleIcon } from "../../components/brand/BrandAssets.jsx";
import { PROFILE_VIEW_ROUTES } from "../../app/constants.jsx";
import { cx } from "../../app/helpers.js";
import { Champion, FAVICON, Screen, Zone, championArt, formatDate, formatNumber, formatSigned } from "./tutorial-ui.jsx";

// Équipe fictive de la démonstration publique : Horizon contre Aurore.
const ROSTER = [
  { role: "TOP", champion: "Gnar" }, { role: "JGL", champion: "Vi" }, { role: "MID", champion: "Ahri" },
  { role: "ADC", champion: "Jinx" }, { role: "SUP", champion: "Braum" },
];
const SCRIM_1 = "2026-09-21T18:00:00.000Z";
const SCRIM_3 = "2026-09-23T18:00:00.000Z";
const range = () => `${formatDate(SCRIM_1, { day: "numeric" })} – ${formatDate(SCRIM_3)}`;
const decimals = (value) => formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function MockAccueil() {
  useLanguage();
  return <Screen path="/accueil">
    <div><p className="tuto-m-label">{t("Bienvenue sur NXT5")}</p><p className="tuto-m-titre">{t("Par où commences-tu ?")}</p></div>
    <Zone z="1" className="tuto-m-choix">
      <div className="tuto-m-choix-carte is-choisi"><Users aria-hidden="true" /><strong>{t("Créer mon équipe")}</strong><span>{t("Tu ouvres l’espace de ton équipe.")}</span></div>
      <div className="tuto-m-choix-carte"><Link2 aria-hidden="true" /><strong>{t("Rejoindre mon équipe")}</strong><span>{t("Avec l’invitation reçue.")}</span></div>
    </Zone>
    <Zone z="2" className="tuto-m-prochaine">
      <div><p className="tuto-m-label">{t("Ta prochaine action")}</p><strong>{t("Importer une première partie")}</strong></div>
      <span className="tuto-m-btn"><Plus aria-hidden="true" />{t("Importer une partie")}</span>
    </Zone>
    <Zone z="3" className="tuto-m-panneau tuto-m-reperes">
      <p className="tuto-m-label">{t("Tes premiers repères")}</p>
      <ol>
        <li className="is-courant"><i>1</i>{t("Importer une première partie")}</li>
        <li><i>2</i>{t("Ouvrir son résumé")}</li>
        <li><i>3</i>{t("Enregistrer un premier débrief")}</li>
      </ol>
    </Zone>
    <Zone z="4" className="tuto-m-pied"><u>{t("Explorer librement")}</u><span className="tuto-m-btn-g"><BookOpen aria-hidden="true" />{t("Aide")}</span></Zone>
  </Screen>;
}

function MockEquipe() {
  useLanguage();
  return <Screen path="/mon-equipe">
    <div className="tuto-m-ligne tuto-m-entre tuto-m-wrap">
      <div className="tuto-m-ligne"><span className="tuto-m-embleme" aria-hidden="true">H</span><div><p className="tuto-m-titre">Horizon</p><p className="tuto-m-p">{t("Titulaires")} · {t("Remplaçants")} · {t("Encadrement")}</p></div></div>
      <Zone z="2" as="span" className="tuto-m-btn-g"><Copy aria-hidden="true" />{t("Copier le multi OP.GG")}</Zone>
    </div>
    <Zone z="1">
      <p className="tuto-m-label tuto-m-label-espace">{t("Titulaires")}</p>
      <div className="tuto-m-roster">
        {ROSTER.map((player) => <div key={player.role} className="tuto-m-joueur">
          <img src={championArt(player.champion)} alt="" width="240" height="436" loading="lazy" decoding="async" />
          <span className="tuto-m-joueur-role"><RoleIcon role={player.role} className="tuto-m-role" />{player.role}</span>
          <span className="tuto-m-joueur-info"><b>Horizon {player.role}</b><span>{player.champion}</span></span>
        </div>)}
      </div>
    </Zone>
    <Zone z="3" className="tuto-m-panneau tuto-m-table">
      <div className="tuto-m-table-tete"><span>{t("Profil")}</span><span>{t("Rôle")}</span><span>{t("Riot ID")}</span><span>{t("Effectif")}</span></div>
      <div><span>Horizon MID</span><span className="tuto-m-num">MID</span><span className="tuto-m-num">HorizonMid#HZN</span><span><span className="tuto-m-pill is-c">{t("Titulaires")}</span></span></div>
      <div><span>Horizon Flex</span><span className="tuto-m-num">TOP</span><span className="tuto-m-num">HorizonFlex#HZN</span><span><span className="tuto-m-pill is-n">{t("Remplaçants")}</span></span></div>
    </Zone>
    <Zone z="4" className="tuto-m-panneau tuto-m-ligne tuto-m-entre tuto-m-wrap">
      <span className="tuto-m-ligne tuto-m-petit"><Check aria-hidden="true" className="tuto-m-vert" />{t("Compte NXT5 associé")} · Horizon MID</span>
      <span className="tuto-m-btn"><Plus aria-hidden="true" />{t("Inviter dans l’équipe")}</span>
    </Zone>
  </Screen>;
}

function MockImporter() {
  useLanguage();
  return <div className="tuto-cadre"><div className="tuto-m-corps">
    <Zone z="1" className="tuto-m-plateformes">
      <span className="tuto-m-label">{t("Télécharger")}</span>
      <span className="tuto-m-btn-g"><Download aria-hidden="true" />{t("Windows (64 bits)")}</span>
      <span className="tuto-m-btn-g"><Download aria-hidden="true" />{t("Mac Apple Silicon")}</span>
      <span className="tuto-m-btn-g"><Download aria-hidden="true" />{t("Mac Intel")}</span>
    </Zone>
    <div className="tuto-m-fenetre">
      <div className="tuto-m-fenetre-barre"><Download aria-hidden="true" />NXT5 Importer</div>
      <div className="tuto-m-app">
        <div className="tuto-m-app-cote">
          <img src={FAVICON} alt="" width="48" height="48" loading="lazy" decoding="async" />
          <span className="is-actif">{t("Exporter")}</span><span>{t("Historique")}</span><span>{t("Paramètres")}</span>
        </div>
        <div className="tuto-m-app-main">
          <Zone z="2" as="span" className="tuto-m-etat">{t("Client League of Legends détecté")}</Zone>
          <Zone z="3" className="tuto-m-champs">
            <div><span>{t("Identifiant du match")}</span><span className="tuto-m-input"><span className="tuto-m-val tuto-m-num">EUW1_7134502881</span></span></div>
            <div><span>{t("Serveur")}</span><span className="tuto-m-input tuto-m-select"><span className="tuto-m-val">EUW</span></span></div>
          </Zone>
          <Zone z="4" className="tuto-m-pile">
            <span className="tuto-m-btn tuto-m-debut"><Download aria-hidden="true" />{t("Exporter la game")}</span>
            <span className="tuto-m-fichier"><FileJson aria-hidden="true" />{t("Fichier .json enregistré sur ton ordinateur")}</span>
          </Zone>
        </div>
      </div>
    </div>
  </div></div>;
}

function MockImport() {
  useLanguage();
  return <Screen path={`${t("Parties")} · ${t("Importer une partie")}`}>
    <Zone z="1" className="tuto-m-fichier tuto-m-entre">
      <span className="tuto-m-ligne"><Check aria-hidden="true" /><b>{t("Fichier chargé")}</b></span>
      <span className="tuto-m-btn-g">{t("Changer de fichier")}</span>
    </Zone>
    <Zone z="2" className="tuto-m-cotes">
      <span className="tuto-m-cote is-bleu">{t("Côté bleu")}<span>Horizon</span></span>
      <span className="tuto-m-cote is-rouge">{t("Côté rouge")}<span>Aurore</span></span>
    </Zone>
    <Zone z="3" className="tuto-m-joueurs">
      {ROSTER.map((player) => <div key={player.role}>
        <span className="tuto-m-poste"><RoleIcon role={player.role} className="tuto-m-role" />{player.role}</span>
        <span className="tuto-m-ligne"><Champion name={player.champion} />{player.champion}</span>
        <span className="tuto-m-input tuto-m-select"><span className="tuto-m-val">Horizon {player.role}</span></span>
      </div>)}
    </Zone>
    <Zone z="4" className="tuto-m-pile">
      <span className="tuto-m-input"><span className="tuto-m-val">{t("Scrim Aurore · partie 1")}</span></span>
      <span className="tuto-m-tags"><span className="tuto-m-label">{t("Tags")}</span><span className="tuto-m-tag"><Check aria-hidden="true" />{t("Scrim")}</span></span>
    </Zone>
    <Zone z="5" className="tuto-m-pile">
      <span className="tuto-m-label">{t("Équipe adverse (facultatif)")}</span>
      <span className="tuto-m-input tuto-m-select"><span className="tuto-m-val">Aurore</span></span>
    </Zone>
    <Zone z="6" className="tuto-m-ligne tuto-m-entre tuto-m-wrap">
      <span className="tuto-m-btn">{t("Confirmer l’import")}</span>
      <span className="tuto-m-toast"><Check aria-hidden="true" />{t("Partie importée")}</span>
    </Zone>
  </Screen>;
}

// Courbe illustrative, identique à l’aperçu de l’accueil public.
const GOLD = [[0, 0], [120, 200], [225, -200], [345, 450], [450, 250], [560, 650], [720, 250], [840, -400], [945, 100], [1065, -100],
  [1170, 700], [1260, 1300], [1380, 1000], [1500, 2200], [1605, 1700], [1710, 2800], [1845, 2600], [2025, 4000]];
const DURATION = 2025;
const gx = (seconds) => 24 + (seconds / DURATION) * 602;
const gy = (gold) => 159 - gold * 0.029;
const GOLD_PATH = GOLD.map(([seconds, gold], index) => `${index ? "L" : "M"}${gx(seconds).toFixed(1)} ${gy(gold).toFixed(1)}`).join(" ");
const GOLD_AREA = `${GOLD_PATH} L626 178 L24 178 Z`;
export const GOLD_MOMENTS = [
  { s: 720, label: "Premier écart", question: "Qui récupère la prochaine vague ?" },
  { s: 1260, label: "Retour dans la partie", question: "Avions-nous la même information ?" },
  { s: 2025, label: "Fin de partie", question: "Qu’est-ce qu’on garde pour la suite ?" },
];
export const GOLD_OBJECTIVES = [
  { s: 1200, label: "Dragon", question: "Avions-nous préparé la vision avant le dragon ?", icon: "/assets/objectives/dragon.png", labelY: 160 },
  { s: 1710, label: "Nashor", question: "Étions-nous tous prêts à jouer le Nashor ?", icon: "/assets/objectives/baron.png", labelY: 56 },
];
export function goldAt(seconds) {
  const end = GOLD.findIndex(([time]) => time >= seconds);
  if (end <= 0) return GOLD[end === 0 ? 0 : GOLD.length - 1][1];
  const [startTime, startGold] = GOLD[end - 1];
  const [endTime, endGold] = GOLD[end];
  return startGold + ((seconds - startTime) / (endTime - startTime)) * (endGold - startGold);
}
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

function MockPartie() {
  useLanguage();
  const [seconds, setSeconds] = useState(1260);
  const sliderId = useId();
  const gold = Math.round(goldAt(seconds) / 10) * 10;
  const objective = GOLD_OBJECTIVES.find((item) => item.s === seconds);
  const moment = objective || GOLD_MOMENTS.reduce((nearest, item) => Math.abs(item.s - seconds) < Math.abs(nearest.s - seconds) ? item : nearest);
  const choose = (value) => setSeconds(Math.max(0, Math.min(DURATION, value)));
  return <Screen path={t("Review d’équipe")}>
    <div className="tuto-m-ligne tuto-m-entre tuto-m-wrap tuto-m-haut">
      <Zone z="1" className="tuto-z-marge">
        <p className="tuto-m-label">{t("Scrim 3 · Faille de l’invocateur")}</p>
        <p className="tuto-m-titre">Horizon <span className="tuto-m-contre">{t("contre")}</span> Aurore</p>
        <p className="tuto-m-p tuto-m-num">{formatDate(SCRIM_3)} · 33:45</p>
      </Zone>
      <Zone z="2" className="tuto-m-ligne tuto-z-marge">
        <span className="tuto-m-pill is-v">{t("Victoire")}</span>
        <span className="tuto-m-score"><span><strong>21</strong><Swords aria-hidden="true" /><strong>12</strong></span><small>{t("Éliminations")}</small></span>
      </Zone>
    </div>
    <Zone z="4" className="tuto-m-compo">
      {ROSTER.map((player) => <span key={player.role}><Champion name={player.champion} />{player.role}</span>)}
    </Zone>
    <Zone z="3" className="tuto-m-panneau">
      <div className="tuto-m-or-tete">
        <div><p className="tuto-m-or-valeur">{formatSigned(gold)}<small>{t("or")}</small></p><p className="tuto-m-p">{t("Écart avec l’adversaire à cet instant")}</p></div>
        <span className="tuto-m-or-temps"><Clock3 aria-hidden="true" />{clock(seconds)}</span>
      </div>
      <svg className="tuto-m-graph" viewBox="0 0 680 198" role="group" aria-label={t("Écart d’or au fil de la partie")}>
        <line className="tuto-g-grille" x1="24" x2="626" y1="43" y2="43" />
        <line className="tuto-g-grille" x1="24" x2="626" y1="101" y2="101" />
        <line className="tuto-g-zero" x1="24" x2="626" y1="159" y2="159" />
        <text className="tuto-g-axe" x="634" y="47">{formatSigned(4000)}</text>
        <text className="tuto-g-axe" x="634" y="105">{formatSigned(2000)}</text>
        <text className="tuto-g-axe" x="634" y="163">0</text>
        <path d={GOLD_AREA} fill="url(#nxt5-tuto-or-aire)" />
        <path d={GOLD_PATH} className="tuto-g-courbe" stroke="url(#nxt5-tuto-or)" />
        <line className="tuto-g-curseur" x1={gx(seconds)} x2={gx(seconds)} y1="14" y2="178" />
        <circle className="tuto-g-point" cx={gx(seconds)} cy={gy(goldAt(seconds))} r="5.5" />
        {GOLD_OBJECTIVES.map((item) => <g key={item.s} className="tuto-g-objectif" role="button" tabIndex={0}
          aria-label={t("Afficher {0} à {1}", [t(item.label), clock(item.s)])}
          onClick={() => choose(item.s)}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(item.s); } }}>
          <circle cx={gx(item.s)} cy={gy(goldAt(item.s))} r="13" />
          <image href={item.icon} x={gx(item.s) - 10} y={gy(goldAt(item.s)) - 10} width="20" height="20" />
          <text x={gx(item.s)} y={item.labelY} textAnchor="middle">{t(item.label)}</text>
        </g>)}
        <text className="tuto-g-axe" x="24" y="194">{t("{0} min", [0])}</text>
        <text className="tuto-g-axe" x="202" y="194" textAnchor="middle">10</text>
        <text className="tuto-g-axe" x="381" y="194" textAnchor="middle">20</text>
        <text className="tuto-g-axe" x="626" y="194" textAnchor="end">33:45</text>
      </svg>
      <label className="sr-only" htmlFor={sliderId}>{t("Moment de la partie")}</label>
      <input id={sliderId} className="tuto-m-curseur" type="range" min="0" max={DURATION} step="15" value={seconds}
        onChange={(event) => choose(Number(event.target.value))}
        aria-valuetext={t("{0} · écart de {1} or", [clock(seconds), formatSigned(gold)])} />
      <div className="tuto-m-moments" role="group" aria-label={t("Moments clés")}>
        {GOLD_MOMENTS.map((item) => <button key={item.s} type="button" aria-pressed={item.s === seconds} onClick={() => choose(item.s)}><b>{clock(item.s)}</b><span>{t(item.label)}</span></button>)}
      </div>
      <div className="tuto-m-note"><MessageSquare aria-hidden="true" /><div>
        <b>{objective ? t("À discuter ensemble · {0} à {1}", [t(objective.label), clock(objective.s)]) : t("À discuter ensemble · Séquence de {0}", [clock(moment.s)])}</b>
        <p>{t(moment.question)}</p>
      </div></div>
    </Zone>
    <Zone z="5" className="tuto-m-ligne tuto-m-wrap">
      <span className="tuto-m-btn"><FileText aria-hidden="true" />{t("Préparer un débrief")}</span>
      <span className="tuto-m-btn-g">{t("Statistiques et comparaison 5 contre 5")}</span>
    </Zone>
  </Screen>;
}

function MockDebrief() {
  useLanguage();
  return <Screen path={`${t("Débriefs")} · ${t("Nouveau débrief")}`}>
    <Zone z="1" className="tuto-z-marge">
      <p className="tuto-m-label">{t("Partie liée · {0}", ["Scrim 3 · Aurore"])}</p>
      <p className="tuto-m-titre">{t("Observations et décisions de l’équipe")}</p>
    </Zone>
    <Zone z="2" className="tuto-m-doc is-fait"><i>01</i><div><b>{t("Le fait")}</b><p>{t("L’équipe termine avec 4 000 or de plus et un écart de vision de +20.")}</p></div></Zone>
    <Zone z="3" className="tuto-m-doc is-question"><i>02</i><div><b>{t("La question")}</b><p>{t("La vision a-t-elle facilité nos décisions, ou reflète-t-elle surtout notre avance ?")}</p></div></Zone>
    <Zone z="4" className="tuto-m-doc is-action"><i>03</i><div><b>{t("L’action à essayer")}</b><p>{t("Avant le prochain objectif contesté, un joueur annonce qui prépare la vision et qui prend les vagues.")}</p></div></Zone>
    <div className="tuto-m-auto"><span>{t("Analyse automatique des parties")}</span><span className="tuto-m-pill is-n">{t("Pistes à vérifier")}</span></div>
    <Zone z="5" className="tuto-m-ligne tuto-m-wrap">
      <span className="tuto-m-btn"><Check aria-hidden="true" />{t("Créer le débrief")}</span>
      <span className="tuto-m-btn-g">{t("Fermer et garder le brouillon")}</span>
    </Zone>
  </Screen>;
}

function MockAdversaires() {
  useLanguage();
  return <Screen path={`${t("Parties")} › ${t("Équipes")}`}>
    <div className="tuto-m-adv">
      <Zone z="1" className="tuto-m-liste">
        <span className="tuto-m-input"><Search aria-hidden="true" /><span className="tuto-m-val tuto-m-mute">{t("Rechercher")}</span></span>
        <span className="is-actif"><b>Aurore</b><span className="tuto-m-mute">{t("{0} parties", [2])}</span></span>
        <span><b>Orbite</b><span className="tuto-m-mute">{t("{0} partie", [1])}</span></span>
      </Zone>
      <Zone z="2" className="tuto-m-pile tuto-z-marge">
        <span className="tuto-m-ligne tuto-m-entre"><span className="tuto-m-titre">Aurore</span><span className="tuto-m-pill is-n">{t("{0} V · {1} D", [1, 1])}</span></span>
        <span className="tuto-m-onglets"><span>{t("Vue d’ensemble")}</span><span className="is-actif">{t("Parties")}</span><span>{t("Drafts")}</span></span>
        <span className="tuto-m-parties">
          <span className="tuto-m-partie"><span className="tuto-m-pill is-v">{t("Victoire")}</span><span><b>Scrim 3 · Aurore</b><small>{formatDate(SCRIM_3)} · 33:45</small></span><ChevronRight aria-hidden="true" /></span>
          <span className="tuto-m-partie"><span className="tuto-m-pill is-d">{t("Défaite")}</span><span><b>Scrim 1 · Aurore</b><small>{formatDate(SCRIM_1)} · 31:15</small></span><ChevronRight aria-hidden="true" /></span>
        </span>
      </Zone>
    </div>
    <Zone z="3" className="tuto-m-panneau tuto-m-pile">
      <p className="tuto-m-label">{t("Dans la partie · {0}", [t("Équipe adverse")])}</p>
      <span className="tuto-m-ligne tuto-m-wrap"><span className="tuto-m-input tuto-m-select tuto-m-etire"><span className="tuto-m-val">Aurore</span></span><span className="tuto-m-btn">{t("Enregistrer l’adversaire")}</span></span>
    </Zone>
    <Zone z="4" className="tuto-m-panneau tuto-m-pile">
      <p className="tuto-m-label">{t("Dans le groupe · {0}", [t("Équipe adverse du groupe")])}</p>
      <span className="tuto-m-ligne tuto-m-wrap"><span className="tuto-m-input tuto-m-select tuto-m-etire"><span className="tuto-m-val">Aurore</span></span><span className="tuto-m-btn-g"><Link2 aria-hidden="true" />{t("Enregistrer le lien")}</span></span>
    </Zone>
  </Screen>;
}

// Résultats calculés sur les trois scrims fictifs de la démonstration.
const CHAMPION_ROWS = [
  { champion: "Ahri", role: "MID", kda: 4.88 }, { champion: "Jinx", role: "ADC", kda: 4.5 }, { champion: "Braum", role: "SUP", kda: 3.64 },
  { champion: "Vi", role: "JGL", kda: 3 }, { champion: "Gnar", role: "TOP", kda: 2.4 },
];

function MockAnalyses() {
  useLanguage();
  return <Screen path={`${t("Analyses")} › ${t("Champions")}`}>
    <span className="tuto-m-onglets"><span className="is-actif">{t("Champions")}</span><span>{t("Drafts & bans")}</span></span>
    <div className="tuto-m-ligne tuto-m-entre tuto-m-wrap tuto-m-haut">
      <Zone z="1" className="tuto-m-filtres">
        <span className="tuto-m-filtre"><em>{t("Période")}</em>{range()}</span>
        <span className="tuto-m-filtre"><em>{t("Catégorie")}</em>{t("Scrims")}</span>
      </Zone>
      <Zone z="2" as="span" className="tuto-m-pill is-c">{t("{0} parties analysées · {1} victoires", [3, 2])}</Zone>
    </div>
    <Zone z="3" className="tuto-m-ch-table">
      <span className="tuto-m-table-tete"><span>{t("Champion")}</span><span>{t("Parties")}</span><span>{t("Victoires")}</span><span>{t("KDA")}</span></span>
      {CHAMPION_ROWS.map((row) => <span key={row.champion} className={cx(row.champion === "Ahri" && "is-actif")}>
        <span className="tuto-m-nom"><Champion name={row.champion} /><span>{row.champion}<small>{row.role}</small></span></span>
        <span className="tuto-m-num">3</span><span className="tuto-m-num">2</span>
        <span className="tuto-m-kda"><b className="tuto-m-num">{decimals(row.kda)}</b><svg viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true"><rect width={row.kda * 20} height="4" rx="2" fill="url(#nxt5-tuto-or)" /></svg></span>
      </span>)}
    </Zone>
    <Zone z="4" className="tuto-m-ligne tuto-m-wrap">
      <span className="tuto-m-btn-g">{t("Voir les parties")}</span>
      <span className="tuto-m-btn-g">{t("Revoir les défaites")}</span>
      <span className="tuto-m-btn">{t("Comparer et approfondir")}</span>
    </Zone>
  </Screen>;
}

// Draft fictive dans l’ordre des tournois : six bans, six picks, quatre bans, quatre picks.
export const DRAFT_SEQUENCE = [
  ["b", "ban", "Azir"], ["r", "ban", "Kalista"], ["b", "ban", "Rumble"], ["r", "ban", "Rell"], ["b", "ban", "Corki"], ["r", "ban", "Varus"],
  ["b", "pick", "Vi"], ["r", "pick", "Orianna"], ["r", "pick", "Jarvan IV"], ["b", "pick", "Ahri"], ["b", "pick", "Jinx"], ["r", "pick", "Ezreal"],
  ["r", "ban", "Nautilus"], ["b", "ban", "Sejuani"], ["r", "ban", "Leona"], ["b", "ban", "Kai’Sa"],
  ["r", "pick", "Rakan"], ["b", "pick", "Braum"], ["b", "pick", "Gnar"], ["r", "pick", "Ornn"],
];

export function draftStepLabel(step) {
  if (step <= 0) return t("Draft vide");
  if (step >= DRAFT_SEQUENCE.length) return t("Draft finale");
  const [camp, kind, name] = DRAFT_SEQUENCE[step - 1];
  const rank = DRAFT_SEQUENCE.slice(0, step).filter(([side, type]) => side === camp && type === kind).length;
  if (camp === "b") return kind === "ban" ? t("Ban bleu {0} — {1}", [rank, name]) : t("Pick bleu {0} — {1}", [rank, name]);
  return kind === "ban" ? t("Ban rouge {0} — {1}", [rank, name]) : t("Pick rouge {0} — {1}", [rank, name]);
}

function DraftCamp({ camp, team, sideLabel, slots, step }) {
  const state = (slotStep) => cx(slotStep > step && "is-vide", slotStep === step && step < DRAFT_SEQUENCE.length && "is-courant");
  return <div className={cx("tuto-m-camp", camp === "b" ? "is-bleu" : "is-rouge")}>
    <span className="tuto-m-camp-tete"><b>{team}</b><small>{sideLabel}</small></span>
    <span className="tuto-m-bans">{slots.ban.map((slot) => <span key={slot.name} className={cx("tuto-m-ban", state(slot.step))} title={slot.name}>{slot.name.slice(0, 2).toUpperCase()}</span>)}</span>
    <span className="tuto-m-picks">{slots.pick.map((slot, index) => <span key={slot.name} className={cx("tuto-m-pick", state(slot.step))}>
      <span className="tuto-m-rang">{camp === "b" ? "B" : "R"}{index + 1}</span><Champion name={slot.name} /><span className="tuto-m-nomc">{slot.name}</span>
    </span>)}</span>
  </div>;
}

function MockDraft() {
  useLanguage();
  const [step, setStep] = useState(DRAFT_SEQUENCE.length);
  const slots = useMemo(() => {
    const result = { b: { ban: [], pick: [] }, r: { ban: [], pick: [] } };
    DRAFT_SEQUENCE.forEach(([camp, kind, name], index) => result[camp][kind].push({ name, step: index + 1 }));
    return result;
  }, []);
  const last = DRAFT_SEQUENCE.length;
  return <Screen path={t("Tableau de draft")}>
    <div className="tuto-m-ligne tuto-m-wrap">
      <Zone z="1" as="span" className="tuto-m-input tuto-m-plein"><Link2 aria-hidden="true" /><span className="tuto-m-val tuto-m-num">https://drafter.lol/…?game=2</span></Zone>
      <Zone z="2" as="span" className="tuto-m-ligne tuto-z-marge">
        <span className="tuto-m-pill is-bleu">{t("Notre côté : {0}", [t("Bleu")])}</span>
        <span className="tuto-m-btn">{t("Rattacher la draft")}</span>
      </Zone>
    </div>
    <Zone z="3" className="tuto-m-filtres">
      <span className="tuto-m-filtre"><em>{t("Équipe adverse liée")}</em>Aurore</span>
      <span className="tuto-m-filtre"><em>{t("Bans à analyser")}</em>{t("Bans contre nous")}</span>
      <span className="tuto-m-filtre"><em>{t("Côté")}</em>{t("Bleu")}</span>
    </Zone>
    <Zone z="4" className="tuto-m-pile">
      <p className="tuto-m-etape" aria-live="polite">{t("Étape {0} / {1}", [step, last])} · <b>{draftStepLabel(step)}</b></p>
      <div className="tuto-m-plateau">
        <DraftCamp camp="b" team="Horizon" sideLabel={t("Côté bleu")} slots={slots.b} step={step} />
        <DraftCamp camp="r" team="Aurore" sideLabel={t("Côté rouge")} slots={slots.r} step={step} />
      </div>
      <div className="tuto-m-commandes" role="group" aria-label={t("Rejouer la draft")}>
        <button type="button" disabled={step === 0} onClick={() => setStep(0)}><RotateCcw aria-hidden="true" />{t("Revoir depuis le début")}</button>
        <button type="button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}><ChevronLeft aria-hidden="true" />{t("Étape précédente")}</button>
        <button type="button" disabled={step === last} onClick={() => setStep((value) => Math.min(last, value + 1))}><ChevronRight aria-hidden="true" />{t("Étape suivante")}</button>
        <button type="button" disabled={step === last} onClick={() => setStep(last)}><ChevronsRight aria-hidden="true" />{t("Voir la draft finale")}</button>
      </div>
    </Zone>
  </Screen>;
}

function MockPool() {
  useLanguage();
  return <Screen path={`${t("Draft & Pool")} › ${t("Champions des joueurs")}`}>
    <Zone z="1" className="tuto-m-pile">
      <span className="tuto-m-input tuto-m-select"><span className="tuto-m-val">Horizon MID</span></span>
      <span className="tuto-m-roles">{ROSTER.map((player) => <span key={player.role} className={cx(player.role === "MID" && "is-actif")}><RoleIcon role={player.role} className="tuto-m-role" />{player.role}</span>)}</span>
    </Zone>
    <Zone z="2" className="tuto-m-pool">
      <span><Champion name="Ahri" /><span><b>Ahri</b><span className="tuto-m-niveau is-confiance">{t("Confiance")}</span></span></span>
      <span><Champion name="Orianna" /><span><b>Orianna</b><span className="tuto-m-niveau is-validation">{t("En validation")}</span></span></span>
      <span><span className="tuto-m-champ tuto-m-mono" aria-hidden="true">Sy</span><span><b>Sylas</b><span className="tuto-m-niveau is-situationnel">{t("Situationnel")}</span></span></span>
      <span><span className="tuto-m-champ tuto-m-mono" aria-hidden="true">Ta</span><span><b>Taliyah</b><span className="tuto-m-niveau is-entrainement">{t("En entraînement")}</span></span></span>
    </Zone>
    <Zone z="3" className="tuto-m-legende">
      <span><b>{t("Prêts à jouer")}</b><span className="tuto-m-niveau is-confiance">{t("Confiance")}</span><span className="tuto-m-niveau is-situationnel">{t("Situationnel")}</span></span>
      <span><b>{t("En travail")}</b><span className="tuto-m-niveau is-validation">{t("En validation")}</span><span className="tuto-m-niveau is-entrainement">{t("En entraînement")}</span></span>
    </Zone>
  </Screen>;
}

function MockCompo() {
  useLanguage();
  return <Screen path={`${t("Draft & Pool")} › ${t("Compositions")}`}>
    <Zone z="1" className="tuto-m-ligne tuto-m-entre tuto-m-wrap tuto-z-marge">
      <p className="tuto-m-titre">{t("Horizon · plan Ahri–Vi")}</p>
      <span className="tuto-m-onglets is-plat"><span>{t("Toutes")}</span><span className="is-actif">{t("Côté bleu")}</span><span>{t("Côté rouge")}</span></span>
    </Zone>
    <Zone z="2" className="tuto-m-slots">
      {ROSTER.map((player) => <span key={player.role} className={cx("tuto-m-slot", player.role === "MID" && "is-cible")}>
        <Champion name={player.champion} /><b>{player.champion}</b><small><RoleIcon role={player.role} className="tuto-m-role" />{player.role}</small>
      </span>)}
    </Zone>
    <Zone z="3" className="tuto-m-panneau tuto-m-pile">
      <span className="tuto-m-ligne tuto-m-entre tuto-m-wrap"><span className="tuto-m-label">{t("Aide au choix : pool et parties de l’équipe")}</span><span className="tuto-m-filtre">{t("Poste : {0}", ["MID"])}</span></span>
      <span className="tuto-m-sugg"><Champion name="Ahri" /><span><b>Ahri</b><small>{t("{0} · {1} parties au résultat connu", [t("Confiance"), 3])}</small></span><span className="tuto-m-pill is-c">{t("Choisi")}</span></span>
      <span className="tuto-m-sugg"><Champion name="Orianna" /><span><b>Orianna</b><small>{t("{0} · aucune partie", [t("En validation")])}</small></span><span className="tuto-m-btn-g"><Plus aria-hidden="true" />{t("Choisir")}</span></span>
    </Zone>
    <Zone z="4" className="tuto-m-pile">
      <p className="tuto-m-label">{t("Plan de jeu")}</p>
      <p className="tuto-m-plan">{t("Jouer les déplacements Ahri–Vi ensemble. Poser la vision avant de chercher le pick. Braum protège Jinx dans les combats.")}</p>
      <span className="tuto-m-btn tuto-m-debut"><Check aria-hidden="true" />{t("Enregistrer la composition")}</span>
    </Zone>
  </Screen>;
}

const WEEK = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"];
const AVAILABLE = new Set(["2026-10-14", "2026-10-15", "2026-10-18"]);
const dayDate = (day, options) => formatDate(`${day}T12:00:00.000Z`, options);

function MockPlanning() {
  useLanguage();
  const note = t("Dispo dès 20:30 jeudi, absent samedi.");
  const sessions = [
    { day: "2026-10-14", kind: "entrainement", type: t("Entraînement"), name: t("Bloc de scrims"), hours: "20:00 – 22:00", detail: t("Horizon contre Aurore") },
    { day: "2026-10-15", kind: "debrief", type: t("Débrief"), name: t("Revoir la partie"), hours: "20:30 – 21:15", detail: t("Review du scrim 3") },
    { day: "2026-10-18", kind: "entrainement", type: t("Entraînement"), name: t("Travailler la composition"), hours: "19:00 – 21:00", detail: t("Tester les options de champions") },
  ];
  return <Screen path="/planning">
    <Zone z="1" className="tuto-m-pile tuto-z-marge">
      <span className="tuto-m-ligne tuto-m-entre">
        <span className="tuto-m-icone" aria-hidden="true"><ChevronLeft /></span>
        <b>{t("Semaine du {0} au {1}", [dayDate(WEEK[0], { day: "numeric" }), dayDate(WEEK[6], { day: "numeric", month: "long" })])}</b>
        <span className="tuto-m-icone" aria-hidden="true"><ChevronRight /></span>
      </span>
      <span className="tuto-m-semaine">{WEEK.map((day) => <span key={day} className={cx("tuto-m-jour", AVAILABLE.has(day) && "is-dispo")}>
        <i>{dayDate(day, { weekday: "short" })}</i><b>{dayDate(day, { day: "numeric" })}</b><i>{AVAILABLE.has(day) ? t("Dispo") : "—"}</i>
      </span>)}</span>
    </Zone>
    <div className="tuto-m-deux">
      <Zone z="2">
        <p className="tuto-m-label">{t("Ta précision")}</p>
        <p className="tuto-m-zone-texte">{note}</p>
        <p className="tuto-m-compteur tuto-m-num">{note.length} / 500</p>
      </Zone>
      <Zone z="3">
        <p className="tuto-m-label">{t("Précisions de l’équipe")}</p>
        <span className="tuto-m-precision"><RoleIcon role="TOP" className="tuto-m-role" /><span><b>Horizon TOP</b><span>{t("Retard possible mercredi.")}</span></span></span>
        <span className="tuto-m-precision"><RoleIcon role="SUP" className="tuto-m-role" /><span><b>Horizon SUP</b><span>{t("Dispo toute la semaine.")}</span></span></span>
      </Zone>
    </div>
    <Zone z="4" className="tuto-m-seances">
      {sessions.map((session) => <span key={session.day} className={cx("tuto-m-seance", `is-${session.kind}`)}>
        <span className="tuto-m-seance-jour">{dayDate(session.day, { weekday: "short", day: "numeric" })} · {session.type}</span>
        <b>{session.name}</b><span className="tuto-m-num">{session.hours}</span><span className="tuto-m-mute">{session.detail}</span>
      </span>)}
    </Zone>
  </Screen>;
}

function MockProfil() {
  useLanguage();
  return <Screen path={`${t("Mon profil")} › ${t("Champions joués")}`}>
    <Zone z="1" className="tuto-m-profil-tete tuto-z-marge">
      <span className="tuto-m-avatar"><img src={championArt("Ahri")} alt="" width="240" height="436" loading="lazy" decoding="async" /></span>
      <span><span className="tuto-m-titre">Horizon MID</span><span className="tuto-m-p">MID · {t("Titulaire · compte associé")}</span></span>
      <span className="tuto-m-filtre"><em>{t("Catégorie")}</em>{t("Scrims")}</span>
    </Zone>
    <Zone z="2">
      <span className="tuto-m-onglets is-defile">{PROFILE_VIEW_ROUTES.map((view) => <span key={view.id} className={cx(view.id === "champions" && "is-actif")}>{t(view.label)}</span>)}</span>
    </Zone>
    <Zone z="3" className="tuto-m-panneau tuto-m-pile">
      <p className="tuto-m-label">{t("Matchups · même poste")}</p>
      <span className="tuto-m-duel"><Champion name="Ahri" /><span className="tuto-m-vs"><b>VS</b><span>{t("{0} contre {1}", ["Ahri", "Orianna"])}</span><small className="tuto-m-num">{t("{0} parties · {1} V · {2} D", [3, 2, 1])}</small></span><Champion name="Orianna" /></span>
    </Zone>
    <Zone z="4" className="tuto-m-pile">
      <p className="tuto-m-label">{t("Plan de départ et essais")}</p>
      <p className="tuto-m-plan">{t("Jouer les déplacements Ahri–Vi ensemble. Noter après chaque scrim ce qui a fonctionné contre Orianna.")}</p>
      <span className="tuto-m-btn-g tuto-m-debut"><Check aria-hidden="true" />{t("Enregistrer le carnet")}</span>
    </Zone>
  </Screen>;
}

function MockCarte() {
  useLanguage();
  const [back, setBack] = useState(false);
  const cardId = useId();
  return <Screen path={`${t("Mon profil")} › ${t("Carte & Wrapped")}`}>
    <div className="tuto-m-vitrine">
      <Zone z="2" className="tuto-carte-scene">
        <div id={cardId} className={cx("tuto-carte", back && "is-retournee")}>
          <div className="tuto-carte-face tuto-carte-recto" aria-hidden={back}>
            <img className="tuto-carte-art" src={championArt("Ahri")} alt="" width="240" height="436" loading="lazy" decoding="async" />
            <span className="tuto-carte-haut"><img src={FAVICON} alt="" width="32" height="32" /><span className="tuto-m-pill is-n">MID</span></span>
            <span className="tuto-carte-bas"><b>Horizon MID</b><span className="tuto-carte-stats">
              <span><strong>3</strong>{t("parties")}</span><span><strong>2</strong>{t("victoires")}</span><span><strong>{decimals(4.88)}</strong>KDA</span>
            </span></span>
          </div>
          <div className="tuto-carte-face tuto-carte-verso" aria-hidden={!back}>
            <img src={FAVICON} alt="" width="48" height="48" />
            <b>{t("Données et méthode")}</b>
            <dl>
              <div><dt>{t("Catégorie")}</dt><dd>{t("Scrims")}</dd></div>
              <div><dt>{t("Parties reliées")}</dt><dd>3</dd></div>
              <div><dt>{t("Période")}</dt><dd>{range()}</dd></div>
            </dl>
            <p>{t("Ces chiffres décrivent cette sélection, sans note de niveau.")}</p>
          </div>
        </div>
      </Zone>
      <div className="tuto-m-vitrine-cote">
        <button type="button" className="tuto-retourner" aria-pressed={back} aria-controls={cardId} onClick={() => setBack((value) => !value)}><Repeat2 aria-hidden="true" />{back ? t("Voir le recto") : t("Voir le verso")}</button>
        <span className="tuto-m-btn-g tuto-m-debut"><Maximize2 aria-hidden="true" />{t("Agrandir")}</span>
        <Zone z="3" className="tuto-m-panneau tuto-m-pile">
          <p className="tuto-m-label" translate="no">Wrapped</p>
          <b>{t("Découvrir le Wrapped")}</b>
          <span className="tuto-m-chapitres" aria-hidden="true"><i className="is-on" /><i /><i /><i /><i /></span>
          <span className="tuto-m-num tuto-m-mute">{t("Chapitre {0} / {1}", [1, 5])}</span>
        </Zone>
        <Zone z="4" as="span" className="tuto-m-btn-g tuto-m-debut"><ImageIcon aria-hidden="true" />{t("Exporter en PNG")}</Zone>
      </div>
    </div>
  </Screen>;
}

function MockDiscord() {
  useLanguage();
  return <div className="tuto-cadre"><div className="tuto-m-corps tuto-m-discord">
    <span className="tuto-m-salon"><Hash aria-hidden="true" />commandes-horizon<span className="tuto-m-fictif">{t("Exemple fictif")}</span></span>
    <Zone z="1" className="tuto-m-msg">
      <span className="tuto-m-av" aria-hidden="true">H</span>
      <span><span className="tuto-m-qui">Horizon MID <small>20:41</small></span><code className="tuto-m-commande">/nxt lier</code>
        <span className="tuto-m-embed"><span><b>{t("Liaison de ton compte")}</b><small>{t("Réponse privée · ouvre le lien pour confirmer")}</small></span><Link2 aria-hidden="true" /></span>
      </span>
    </Zone>
    <Zone z="2" className="tuto-m-msg">
      <span className="tuto-m-av" aria-hidden="true">C</span>
      <span><span className="tuto-m-qui">Coach Horizon <small>20:43</small></span><code className="tuto-m-commande">/nxt connecter code:••••••</code><span className="tuto-m-p">{t("Équipe Horizon reliée à ce serveur.")}</span></span>
    </Zone>
    <Zone z="3" className="tuto-m-msg">
      <span className="tuto-m-av is-bot" aria-hidden="true"><img src={FAVICON} alt="" width="28" height="28" /></span>
      <span><span className="tuto-m-qui">NXT5 <em translate="no">BOT</em> <small>20:44</small></span><code className="tuto-m-commande">/nxt voir sujet:derniere</code>
        <span className="tuto-m-embed"><span><b>Scrim 3 · Aurore</b><small>33:45 · 21 × 12 · {formatSigned(4000)} {t("or")}</small></span><span className="tuto-m-pill is-v">{t("Victoire")}</span></span>
      </span>
    </Zone>
    <Zone z="4" className="tuto-m-msg">
      <span className="tuto-m-av is-bot" aria-hidden="true"><img src={FAVICON} alt="" width="28" height="28" /></span>
      <span><span className="tuto-m-qui">NXT5 <em translate="no">BOT</em> <small>#scrims-horizon</small></span>
        <span className="tuto-m-visuel">
          <span className="tuto-m-ligne tuto-m-entre"><b>{t("Horizon contre Aurore")}</b><span className="tuto-m-pill is-v">{t("Victoire")}</span></span>
          <span className="tuto-m-compo">{ROSTER.map((player) => <Champion key={player.role} name={player.champion} />)}</span>
        </span>
      </span>
    </Zone>
  </div></div>;
}

export const TUTORIAL_MOCKS = {
  accueil: MockAccueil, equipe: MockEquipe, importer: MockImporter, import: MockImport, partie: MockPartie,
  debrief: MockDebrief, adversaires: MockAdversaires, analyses: MockAnalyses, draft: MockDraft, pool: MockPool,
  compo: MockCompo, planning: MockPlanning, profil: MockProfil, carte: MockCarte, discord: MockDiscord,
};

/** Strings displayed through variables in the example screens, for translation checks. */
export const TUTORIAL_MOCK_STRINGS = [
  ...GOLD_MOMENTS.flatMap((item) => [item.label, item.question]),
  ...GOLD_OBJECTIVES.flatMap((item) => [item.label, item.question]),
  ...PROFILE_VIEW_ROUTES.map((view) => view.label),
];

