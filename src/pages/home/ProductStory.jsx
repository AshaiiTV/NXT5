import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import React, { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  MessageSquare,
  Swords,
  Users,
} from "lucide-react";
import { RoleIcon } from "../../components/brand/BrandAssets.jsx";
import { DemoMatchSummary } from "../../pages/public/DemoMatchSummary.jsx";
import { Badge } from "../../components/ui/Core.jsx";
import { DEMO_MATCHES } from "../../pages/public/demo-data.js";

function StoryLink({ href, navigate, children, ...props }) {
  function follow(event) {
    if (event.defaultPrevented || !navigate || !href.startsWith("/") || href.startsWith("//") || props.target === "_blank" || props.download != null || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    navigate(href);
  }
  return <a {...props} href={href} onClick={follow}>{children}</a>;
}
const CHAPTERS = [
  {
    id: "analyse",
    label: "Analyse",
    hint: "Comprendre la partie",
    icon: BarChart3,
    title: "Le score ne raconte pas tout.",
    copy: "Repars des faits. Confronte vos observations. Choisissez ce qui mérite d’être travaillé.",
    link: "Explore une partie",
  },
  {
    id: "draft",
    label: "Draft",
    hint: "Préparer les options",
    icon: Swords,
    title: "Cinq joueurs. Un plan de jeu.",
    copy: "Les champions de chacun, les options du staff et une composition à préparer ensemble.",
    link: "Découvre l’espace équipe",
  },
  {
    id: "planning",
    label: "Planning",
    hint: "Se retrouver pour jouer",
    icon: CalendarDays,
    title: "Le prochain scrim commence avant le lobby.",
    copy: "Disponibilités, entraînements, débriefs : toute l’équipe retrouve ses rendez-vous au même endroit.",
    link: "Découvre l’espace équipe",
  },
];
const MOMENTS = [
  {
    time: "12:00",
    seconds: 720,
    name: "Premier écart",
    note: "Qui récupère la prochaine vague ?",
    detail:
      "Une question à reprendre ensemble au débrief, avec le contexte du replay.",
  },
  {
    time: "21:00",
    seconds: 1260,
    name: "Retour dans la partie",
    note: "Avions-nous la même information ?",
    detail:
      "Comparez les points de vue des joueurs avant de retenir une consigne.",
  },
  {
    time: "33:45",
    seconds: 2025,
    name: "Fin de partie",
    note: "Qu’est-ce qu’on garde pour la suite ?",
    detail:
      "Choisissez un point précis à retravailler au prochain entraînement.",
  },
];
const OBJECTIVES = [
  {
    id: "dragon", name: "Dragon", label: "Dragon", seconds: 1200, time: "20:00",
    note: "Avions-nous préparé la vision avant le dragon ?",
    detail: "Revoir les positions et les informations partagées avant de lancer l’objectif.",
  },
  {
    id: "baron", name: "Baron Nashor", label: "Nashor", seconds: 1710, time: "28:30",
    note: "Étions-nous tous prêts à jouer le Nashor ?",
    detail: "Revoir la décision ensemble : position des adversaires, vagues et ressources disponibles.",
  },
];
const PLAYERS = [
  {
    role: "TOP",
    champion: "Gnar",
    option: "Ornn",
    topic: "Gestion des vagues",
    question: "Quand libérer la voie pour rejoindre l’équipe ?",
    draftNote: "Garder la téléportation pour rejoindre le combat. Préparer la vague avant de se regrouper.",
  },
  {
    role: "JGL",
    champion: "Vi",
    option: "Jarvan IV",
    topic: "Préparation des objectifs",
    question: "Quelles informations partager avant de se regrouper ?",
    draftNote: "Annoncer la cible avant l’engage. Donner aux lanes le temps de rejoindre Vi.",
  },
  {
    role: "MID",
    champion: "Ahri",
    option: "Orianna",
    topic: "Priorité et rotations",
    question: "Comment annoncer notre prochaine rotation ?",
    draftNote: "Jouer les déplacements Ahri–Vi ensemble. Poser la vision avant de chercher le pick.",
  },
  {
    role: "ADC",
    champion: "Jinx",
    option: "Ezreal",
    topic: "Placement en combat",
    question: "De quoi avons-nous besoin pour jouer le combat ensemble ?",
    draftNote: "Préserver l’espace de Jinx. Garder une réponse pour l’adversaire qui entre dans la backline.",
  },
  {
    role: "SUP",
    champion: "Braum",
    option: "Rakan",
    topic: "Vision et information",
    question: "Quelle zone préparer avant le prochain objectif ?",
    draftNote: "Braum protège le carry. Préparer l’entrée de rivière avec le jungler avant l’objectif.",
  },
];
const SESSIONS = [
  {
    day: "Mercredi",
    short: "Mer.",
    date: "14",
    type: "Entraînement",
    name: "Scrim d’équipe",
    time: "20:00",
    end: "22:00",
    note: "Préparer les objectifs ensemble",
    staff: "Joueurs et staff",
    opponent: "Horizon contre Aurore",
    agenda: ["20:00 · Brief & draft", "20:15 · Bloc de scrims", "21:45 · Débrief à chaud"],
  },
  {
    day: "Jeudi",
    short: "Jeu.",
    date: "15",
    type: "Débrief",
    name: "Revoir la partie",
    time: "20:30",
    end: "21:15",
    note: "Reprendre une séquence du scrim",
    staff: "Joueurs et coach",
    opponent: "Review du scrim 3",
    agenda: ["20:30 · Retour des joueurs", "20:40 · Séquence à revoir", "21:05 · Consigne commune"],
  },
  {
    day: "Dimanche",
    short: "Dim.",
    date: "18",
    type: "Entraînement",
    name: "Travailler la composition",
    time: "19:00",
    end: "21:00",
    note: "Tester les options de champions",
    staff: "Joueurs et staff",
    opponent: "Horizon contre Aurore",
    agenda: ["19:00 · Options de draft", "19:15 · Bloc de scrims", "20:45 · Bilan des essais"],
  },
];

const DEMO_MATCH = DEMO_MATCHES[2];
// Illustrative timeline, independent of the final totals in the match fixture.
const GOLD_TIMELINE = [
  [0, 0], [120, 200], [225, -200], [345, 450], [450, 250],
  [560, 650], [720, 250], [840, -400], [945, 100], [1065, -100],
  [1170, 700], [1260, 1300], [1380, 1000], [1500, 2200],
  [1605, 1700], [1710, 2800], [1845, 2600], [2025, 4000],
];
const MATCH_SECONDS = DEMO_MATCH.duration_seconds;
const graphX = (seconds) => 24 + (seconds / MATCH_SECONDS) * 602;
const graphY = (gold) => 159 - gold * 0.029;
const GOLD_PATH = GOLD_TIMELINE.map(([seconds, gold], index) =>
  `${index === 0 ? "M" : "L"}${graphX(seconds)} ${graphY(gold)}`,
).join(" ");
const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
const formatGold = (gold) => `${gold > 0 ? "+" : gold < 0 ? "−" : ""}${Math.abs(gold).toLocaleString(getLocale())}`;
function goldAtTime(seconds) {
  const endIndex = GOLD_TIMELINE.findIndex(([time]) => time >= seconds);
  if (endIndex <= 0) return GOLD_TIMELINE[endIndex === 0 ? 0 : GOLD_TIMELINE.length - 1][1];
  const [startTime, startGold] = GOLD_TIMELINE[endIndex - 1];
  const [endTime, endGold] = GOLD_TIMELINE[endIndex];
  return startGold + ((seconds - startTime) / (endTime - startTime)) * (endGold - startGold);
}
const ALLIES = DEMO_MATCH.participants.filter((player) => player.team_key === "ALLY");
const allyKills = ALLIES.reduce((sum, player) => sum + player.kills, 0);
const allyDeaths = ALLIES.reduce((sum, player) => sum + player.deaths, 0);

function ChampionArt({ champion, loading = false, className = "" }) {
  const [failed, setFailed] = useState(false);
  const assetId = champion.replace(/\s/g, "");
  return (
    <span className={`ps-champion-art ${className}`} aria-hidden="true">
      <span className="ps-art-fallback">{champion.slice(0, 1)}</span>
      {!failed && <img src={`/assets/home-motion/champions/${assetId}-${loading ? "loading" : "icon"}.webp`}
        alt="" width={loading ? 240 : 96} height={loading ? 436 : 96}
        loading="lazy" decoding="async" onError={() => setFailed(true)} />}
    </span>
  );
}

function SceneSignature({ children }) {
  useLanguage();
  return <div className="ps-scene-signature"><img src="/assets/nxt5-loader-favicon-256.webp" alt="NXT5" width="28" height="28" />
    <span>{children}</span><span className="ps-example">{t("Exemple fictif")}</span></div>;
}

function AnalysisScene() {
  useLanguage();
  const [seconds, setSeconds] = useState(MOMENTS[1].seconds);
  const gold = goldAtTime(seconds);
  const displayedGold = Math.round(gold / 10) * 10;
  const time = formatTime(seconds);
  const objective = OBJECTIVES.find((item) => item.seconds === seconds);
  const active = objective || MOMENTS.reduce((nearest, item) =>
    Math.abs(item.seconds - seconds) < Math.abs(nearest.seconds - seconds) ? item : nearest,
  MOMENTS[0]);
  return (
    <div className="ps-analysis">
      <SceneSignature>{t("Review d’équipe")}</SceneSignature>
      <div className="ps-scene-top">
        <div>
          <span className="ps-overline">{t("Scrim 3 · Faille de l’invocateur")}</span>
          <h4>Horizon <span>{t("contre")}</span> Aurore</h4>
        </div>
        <Badge tone="green">{t("Victoire")}</Badge>
      </div>
      <div className="ps-match-lineup">
        <div className="ps-match-champions" role="group" aria-label={t("Composition de l’équipe Horizon")}>
          {ALLIES.map((player) => <div key={player.role} role="img" aria-label={`${player.role} · ${player.champion}`}>
            <ChampionArt champion={player.champion} /><span>{player.role}</span>
          </div>)}
        </div>
        <div className="ps-kill-score" role="img" aria-label={t("{0} éliminations pour Horizon, {1} pour Aurore", [allyKills, allyDeaths])}>
          <strong>{allyKills}</strong><Swords size={18} aria-hidden="true" /><strong>{allyDeaths}</strong><span>{t("Éliminations")}</span>
        </div>
      </div>
      <div className="ps-match-facts" id="ps-selected-stats">
        <div>
          <strong>
            {formatGold(displayedGold)} <span>{t("or")}</span>
          </strong>
          <span>{t(seconds === MATCH_SECONDS ? "Écart final avec l’adversaire" : "Écart avec l’adversaire à cet instant")}</span>
        </div>
        <span className="ps-duration">
          <Clock3 size={15} aria-hidden="true" />
          <time>{time}</time>
        </span>
      </div>
      <div className="ps-chart">
        <div className="ps-chart-heading"><span className="ps-chart-label">{t("Écart d’or au fil de la partie")}</span><span className="ps-chart-hint">{t("Déplace le curseur")}</span></div>
        <div className="ps-chart-plot">
        <svg
          viewBox="0 0 650 228"
          preserveAspectRatio="none"
          role="img"
          aria-label={t("Courbe illustrative : un début disputé, puis un avantage de 4 000 or en fin de partie.")}
        >
          <defs>
            <linearGradient id="ps-graph-line" x1="0" y1="0" x2="1" y2="0">
              <stop stopColor="#67e8f9" />
              <stop offset=".55" stopColor="#a5b4fc" />
              <stop offset="1" stopColor="#e879f9" />
            </linearGradient>
            <linearGradient id="ps-graph-fill" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#a78bfa" stopOpacity=".22" />
              <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            className="ps-grid-line"
            d="M24 44H625M24 98H625M24 152H625M24 206H625"
          />
          <path
            d={`${GOLD_PATH}V206H24Z`}
            fill="url(#ps-graph-fill)"
          />
          <path
            className="ps-gold-line"
            d={GOLD_PATH}
          />
          <g
            className="ps-chart-cursor"
            transform={`translate(${graphX(seconds)}, 0)`}
          >
            <path d="M0 26V206" />
            <circle cy={graphY(gold)} r="12" className="ps-point-halo" />
            <circle cy={graphY(gold)} r="4.5" className="ps-point" />
          </g>
        </svg>
        <input className="ps-chart-slider" type="range" min="0" max={MATCH_SECONDS} step="15"
          value={seconds} onChange={(event) => setSeconds(Number(event.target.value))}
          aria-label={t("Moment de la partie")} aria-controls="ps-selected-stats ps-moment-note"
          aria-valuetext={`${t("{0}, {1} or par rapport à l’adversaire", [time, formatGold(displayedGold)])}${objective ? `, ${t(objective.name)}` : ""}`}
        />
        {OBJECTIVES.map((item) => (
          <div className="ps-chart-objective" key={item.id} data-objective={item.id}>
            <button type="button" aria-label={t("{0} à {1}", [t(item.name), item.time])}
              aria-pressed={seconds === item.seconds}
              aria-controls="ps-selected-stats ps-moment-note"
              title={`${t(item.name)} · ${item.time}`}
              onClick={() => setSeconds(item.seconds)}>
              <img src={`/assets/objectives/${item.id}.png`} width="28" height="28" alt="" />
              <span aria-hidden="true">{t(item.label)}</span>
            </button>
          </div>
        ))}
        </div>
        <div className="ps-chart-axis" aria-hidden="true">
          {[0, 600, 1200, MATCH_SECONDS].map((tick) => <span key={tick} data-time={tick}>{tick === 0 ? "0 min" : tick === MATCH_SECONDS ? formatTime(tick) : tick / 60}</span>)}
        </div>
      </div>
      <div
        className="ps-moments"
        role="group"
        aria-label={t("Explorer les moments de la partie")}
      >
        {MOMENTS.map((item) => (
          <button
            type="button"
            key={item.time}
            aria-pressed={seconds === item.seconds}
            aria-controls="ps-selected-stats ps-moment-note"
            onClick={() => setSeconds(item.seconds)}
          >
            <span>{item.time}</span>
            <strong>{t(item.name)}</strong>
          </button>
        ))}
      </div>
      <div className="ps-note" id="ps-moment-note" aria-live="polite">
        <MessageSquare size={18} aria-hidden="true" />
        <div>
          <span>{objective ? `${t(objective.name)} · ${active.time}` : t("À discuter ensemble · Séquence de {0}", [active.time])}</span>
          <p>{t(active.note)}</p>
          <small>{t(active.detail)}</small>
        </div>
      </div>
      <p className="ps-illustration-note">
        {t("Courbe, objectifs et notes illustratifs. Les chiffres seuls n’expliquent pas les décisions.")}
      </p>
      <details className="ps-match-detail">
        <summary>
          {t("Voir le bilan détaillé")} <ChevronRight size={16} aria-hidden="true" />
        </summary>
        <DemoMatchSummary />
      </details>
    </div>
  );
}

function DraftScene() {
  useLanguage();
  const [selected, setSelected] = useState(2);
  const active = PLAYERS[selected];
  return (
    <div className="ps-draft">
      <SceneSignature>{t("Draft & pool")}</SceneSignature>
      <div className="ps-scene-top">
        <div>
          <span className="ps-overline">{t("Horizon · Composition de travail")}</span>
          <h4>{t("Cinq picks. Une intention.")}</h4>
        </div>
        <span className="ps-side-label"><i /> {t("Côté bleu")}</span>
      </div>
      <div
        className="ps-draft-roster"
        role="group"
        aria-label={t("Choisir un rôle pour voir ses champions")}
      >
        {PLAYERS.map((player, index) => (
          <button
            type="button"
            key={player.role}
            data-role={player.role}
            aria-pressed={selected === index}
            aria-controls="ps-pool"
            onClick={() => setSelected(index)}
          >
            <ChampionArt champion={player.champion} loading className="ps-draft-art" />
            <span className="ps-roster-icon" aria-hidden="true">
              <RoleIcon role={player.role} />
            </span>
            <span>{player.role}</span>
            <strong>{player.champion}</strong>
            {selected === index && <Check className="ps-pick-check" size={15} aria-hidden="true" />}
          </button>
        ))}
      </div>
      <div className="ps-pool" id="ps-pool" aria-live="polite">
        <div className="ps-pool-heading">
          <h5>{t("Pool {0}", [active.role])}</h5>
          <span>{t("Deux options à discuter")}</span>
        </div>
        <div className="ps-pool-options">
          <div>
            <ChampionArt champion={active.champion} key={active.champion} />
            <strong>{active.champion}</strong>
            <span className="ps-status">
              <Check size={14} aria-hidden="true" />
              {t("Confiance")}
            </span>
          </div>
          <div>
            <ChampionArt champion={active.option} key={active.option} />
            <strong>{active.option}</strong>
            <span className="ps-status is-training">{t("En entraînement")}</span>
          </div>
        </div>
      </div>
      <div className="ps-note" aria-live="polite">
        <MessageSquare size={18} aria-hidden="true" />
        <div>
          <span>{t("Intention du staff · {0}", [active.role])}</span>
          <p>{t(active.draftNote)}</p>
          <small>
            {t("Une piste à tester ensemble au prochain scrim.")}
          </small>
        </div>
      </div>
    </div>
  );
}

function PlanningScene() {
  useLanguage();
  const [selected, setSelected] = useState(0);
  const active = SESSIONS[selected];
  return (
    <div className="ps-planning">
      <SceneSignature>{t("Le rendez-vous du cinq")}</SceneSignature>
      <div className="ps-scene-top">
        <div>
          <span className="ps-overline">{t("Semaine du 12 octobre")}</span>
          <h4>{t("La semaine de l’équipe.")}</h4>
        </div>
      </div>
      <div className="ps-days" role="group" aria-label={t("Choisir une séance")}>
        {SESSIONS.map((session, index) => (
          <button
            key={session.date}
            type="button"
            aria-pressed={selected === index}
            aria-controls="ps-session"
            onClick={() => setSelected(index)}
          >
            <span>{t(session.short)}</span>
            <strong>{session.date}</strong>
            <span>{t(index === 1 ? "Débrief" : "Scrim")}</span>
            <i aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="ps-session" id="ps-session" aria-live="polite">
        <div className="ps-session-clock">
          <strong>{active.time}</strong>
          <span>{active.end}</span>
        </div>
        <div className="ps-session-info">
          <span>
            {t("{0} {1} octobre", [t(active.day), active.date])}
          </span>
          <h5>{t(active.opponent)}</h5>
          <span className="ps-session-format">{t(active.name)}</span>
          <span className="ps-session-people">
            <Users size={16} aria-hidden="true" />
            {t(active.staff)}
          </span>
        </div>
      </div>
      <div className="ps-scrim-focus" aria-live="polite">
        <img src="/assets/objectives/dragon.png" width="40" height="40" alt="" />
        <div><span>{t("Objectif de séance")}</span><strong>{t(active.note)}</strong></div>
      </div>
      <ol className="ps-agenda" aria-label={t("Programme de la séance")} aria-live="polite">
        {active.agenda.map((step) => <li key={step}><span>{step.split(" · ")[0]}</span>{t(step.split(" · ")[1])}</li>)}
      </ol>
      <div className="ps-attendees">
        <div className="ps-ready-heading"><span>{t("Le cinq au rendez-vous")}</span><span><Check size={14} aria-hidden="true" /> {t("5 / 5 disponibles")}</span></div>
        <div>
          {PLAYERS.map((player) => (
            <span key={player.role} className="ps-ready-player" data-role={player.role}>
              <span aria-hidden="true">
                <RoleIcon role={player.role} />
              </span>
              <span>{player.role}</span>
              <Check size={13} aria-label={t("Disponible")} className="ps-ready-check" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function TeamScene() {
  useLanguage();
  const [selected, setSelected] = useState(2);
  const active = PLAYERS[selected];
  return (
    <section className="ps-team" aria-labelledby="ps-team-title">
      <div className="ps-team-copy">
        <h2 id="ps-team-title">
          {t("Cinq points de vue.")}
          <br />
          {t("Une équipe.")}
        </h2>
        <p>
          {t("Joueurs et staff apportent leur lecture. Le débrief devient un point de départ commun.")}
        </p>
        <span className="ps-role-invitation">
          {t("Choisis un rôle pour changer de perspective")}{" "}
          <ArrowRight size={17} aria-hidden="true" />
        </span>
      </div>
      <div
        className="ps-team-scene"
        data-selected-role={active.role}
      >
        <div
          className="ps-team-roles"
          role="group"
          aria-label={t("Les points de vue de l’équipe")}
        >
          {PLAYERS.map((player, index) => (
            <button
              type="button"
              key={player.role}
              data-role={player.role}
              aria-pressed={selected === index}
              aria-controls="ps-shared-note"
              onClick={() => setSelected(index)}
            >
              <span aria-hidden="true">
                <RoleIcon role={player.role} />
              </span>
              <span>{player.role}</span>
            </button>
          ))}
        </div>
        <svg
          className="ps-team-connections"
          viewBox="0 0 600 112"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {PLAYERS.map((player, index) => (
            <path
              key={player.role}
              pathLength="1"
              className={selected === index ? "is-active" : ""}
              data-role={player.role}
              d={
                index === 2
                  ? "M300 0V112"
                  : `M${60 + index * 120} 0V24C${60 + index * 120} 72 300 40 300 90V112`
              }
            />
          ))}
        </svg>
        <div className="ps-shared-note" id="ps-shared-note" aria-live="polite">
          <div className="ps-shared-note-heading">
            <MessageSquare aria-hidden="true" size={20} />
            <span>{t("Le débrief de l’équipe")}</span>
            <span className="ps-example">{t("Exemple fictif")}</span>
          </div>
          <div className="ps-shared-note-body">
            <span className="ps-role-topic">
              {active.role} <i aria-hidden="true" />
              {t(active.topic)}
            </span>
            <h3>{t(active.question)}</h3>
            <p>{t("Une observation à partager. Une consigne à choisir ensemble.")}</p>
          </div>
          <div className="ps-shared-note-bottom">
            <span className="ps-presence" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>{t("Les joueurs et le staff, dans le même espace.")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ProductStory({ reduced = false, navigate }) {
  useLanguage();
  const [selected, setSelected] = useState("analyse");
  const [keyboardChange, setKeyboardChange] = useState(false);
  const active = CHAPTERS.find((chapter) => chapter.id === selected);
  return (
    <div className={`ps-story${reduced ? " ps-reduced" : ""}`}>
      <section
        id="outils"
        className="ps-product"
        aria-labelledby="ps-product-title"
        tabIndex={-1}
      >
        <div className="ps-section-heading">
          <h2 id="ps-product-title">{t("La suite se joue ensemble.")}</h2>
          <p>{t("Du débrief au prochain entraînement.")}</p>
        </div>
        <div
          className="ps-chapters"
          role="group"
          aria-label={t("Explorer les outils NXT5")}
        >
          {CHAPTERS.map((chapter) => (
            <button
              type="button"
              key={chapter.id}
              id={`ps-choice-${chapter.id}`}
              aria-pressed={selected === chapter.id}
              aria-controls="ps-chapter-panel"
              onClick={(event) => {
                setKeyboardChange(event.detail === 0);
                setSelected(chapter.id);
              }}
            >
              <span className="ps-chapter-index" aria-hidden="true">
                <chapter.icon size={21} />
              </span>
              <span>
                <strong>{t(chapter.label)}</strong>
                <small>{t(chapter.hint)}</small>
              </span>
              <ArrowUpRight size={21} aria-hidden="true" />
            </button>
          ))}
        </div>
        <div
          id="ps-chapter-panel"
          role="region"
          aria-labelledby={`ps-choice-${selected}`}
          className={`ps-chapter-panel${keyboardChange ? " ps-keyboard-change" : ""}`}
          data-chapter={selected}
        >
          <div className="ps-chapter-copy" key={`${selected}-copy`}>
            <h3>{t(active.title)}</h3>
            <p>{t(active.copy)}</p>
            <StoryLink href="/demo" navigate={navigate} className="ps-text-link">
              {t(active.link)}
              <ArrowUpRight size={17} aria-hidden="true" />
            </StoryLink>
          </div>
          <div className="ps-scene" key={selected}>
            {selected === "analyse" ? (
              <AnalysisScene />
            ) : selected === "draft" ? (
              <DraftScene />
            ) : (
              <PlanningScene />
            )}
          </div>
        </div>
      </section>
      <TeamScene />
      <section className="ps-final" aria-labelledby="ps-final-title">
        <div className="ps-final-track" aria-hidden="true" />
        <div>
          <p>{t("La prochaine partie vous attend.")}</p>
          <h2 id="ps-final-title">
            {t("Entrez à cinq.")}
            <br />
            {t("Avancez ensemble.")}
          </h2>
        </div>
        <div className="ps-final-actions">
          <StoryLink className="ps-primary" href="/creer-un-compte" navigate={navigate}>
            {t("Créer mon espace")}
            <ArrowUpRight size={20} aria-hidden="true" />
          </StoryLink>
          <StoryLink className="ps-text-link" href="/demo" navigate={navigate}>
            {t("Commencer par la démo")}
            <ArrowRight size={17} aria-hidden="true" />
          </StoryLink>
        </div>
      </section>
    </div>
  );
}
