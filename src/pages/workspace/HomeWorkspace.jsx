import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays, FileText, Swords, Target, Upload, Users } from "lucide-react";
import { BeginnerCompass } from "../../components/layout/AppChrome.jsx";
import { Badge, Button, PageHeader } from "../../components/ui/Core.jsx";
import { RoleIcon, TeamAvatar } from "../../components/brand/BrandAssets.jsx";
import GlassScene from "../../components/brand/GlassScene.jsx";
import { ROLES } from "../../../shared/roles.js";
import { rosterPlayersByStatus } from "../../utils/roster.js";
import { getHomeContext, homeMatchTimestamp } from "../../utils/home-context.js";
import { matchDisplayName } from "../../utils/matches.js";
import { LinkButton, PublicTextLink } from "../public/PublicPages.jsx";
import "./home-workspace.css";

const matchPath = match => `/games?match=${encodeURIComponent(match.id)}`;
const reportPath = report => `/rapports?report=${encodeURIComponent(report.id)}`;
const reviewPath = match => `/rapports?match=${encodeURIComponent(match.id)}&compose=1`;
const countLabel = (count, singular, plural = `${singular}s`) => `${count} ${t(count > 1 ? plural : singular)}`;

function dateLabel(timestamp, options = {}) {
  if (timestamp == null || !Number.isFinite(timestamp)) return "Date non renseignée";
  const format = { day: "numeric", month: "short", year: "numeric", ...options };
  try { return new Intl.DateTimeFormat(getLocale(), format).format(timestamp); }
  catch { delete format.timeZone; return new Intl.DateTimeFormat(getLocale(), format).format(timestamp); }
}

function sessionDate(event) {
  return dateLabel(event.startsAt, { weekday: "long", hour: "2-digit", minute: "2-digit", ...(event.timezone ? { timeZone: event.timezone, timeZoneName: "short" } : {}) });
}

const goalMetricLabels = {
  deaths: "Morts par partie", kp: "Participation aux éliminations (KP)", kda: "Ratio KDA",
  vision: "Score de vision par partie", cs10: "Sbires et monstres à 10 minutes (CS)",
};

function HomeGoals({ context, navigate }) {
  const { linkedPlayer, playerGoals, botGoals } = context;
  if (!linkedPlayer || !playerGoals.length && !botGoals.length) return null;
  return <section className="nxt5-home-goals" aria-labelledby="nxt5-home-goals-title">
    <div className="nxt5-home-goals-heading">
      <div><div className="nxt5-home-section-heading"><Target size={20} aria-hidden="true" /><h3 id="nxt5-home-goals-title">{t("Tes objectifs")}</h3></div><p className="nxt5-home-section-intro">{t("Les objectifs en cours de ton profil lié.")}</p></div>
      {context.importPlayers.some(player => player.id === linkedPlayer.id) && <PublicTextLink href={`/mon-profil/coaching?player=${encodeURIComponent(linkedPlayer.id)}`} navigate={navigate} className="nxt5-home-text-link">{t("Ouvrir mon suivi")}<ArrowRight size={16} aria-hidden="true" /></PublicTextLink>}
    </div>
    <ul className="nxt5-home-goal-list">
      {playerGoals.map(goal => <li key={`player:${goal.id}`}>
        <div><h4>{goal.title}</h4><p>{t(goalMetricLabels[goal.metric])} {goal.operator === "lte" ? "≤" : "≥"} {new Intl.NumberFormat(getLocale()).format(Number(goal.target_value))}{goal.metric === "kp" ? "%" : ""} · {t("{0}/{1} parties", [goal.required_successes, goal.sample_size])}</p></div>
        <Badge tone="cyan">{t("Suivi joueur")}</Badge>
      </li>)}
      {botGoals.map(goal => {
        const dueAt = goal.due_at ? homeMatchTimestamp({ date: goal.due_at }) : null;
        return <li key={`bot:${goal.id}`}><div><h4>{goal.title}</h4>{dueAt !== null && <p>{t("Échéance : {0}", [dateLabel(dueAt)])}</p>}</div><Badge tone="purple">{t("Consigne du staff")}</Badge></li>;
      })}
    </ul>
  </section>;
}

function HomePlayerDebrief({ context, navigate }) {
  const { linkedPlayer, playerDebrief } = context;
  const { group, report, sections = [] } = playerDebrief || {};
  const orderedSections = [...sections].sort((a, b) => Number(a.source === "analysis") - Number(b.source === "analysis"));
  return <section className="nxt5-home-section nxt5-home-player-debrief" aria-labelledby="nxt5-home-player-debrief-title">
    <div className="nxt5-home-section-heading"><FileText size={20} aria-hidden="true" /><h3 id="nxt5-home-player-debrief-title">{t("Ton dernier débrief")}</h3></div>
    {linkedPlayer ? <>
      <p className="nxt5-home-debrief-player">{t("Pour {0}", [linkedPlayer.name || linkedPlayer.riot_id || linkedPlayer.role])}</p>
      {group && <p className="nxt5-home-debrief-group">{t("Dernier groupe : {0}", [group.name || t("Groupe de parties")])}</p>}
      {orderedSections.length ? <div className="nxt5-home-debrief-sections">
        {orderedSections.map((section, index) => <details key={`${report.id}:${index}`} className="nxt5-home-debrief-section" open={index === 0}>
          <summary><span><small>{section.source === "analysis" ? t("Analyse enregistrée") : t("Notes de l’équipe")}</small><strong>{section.heading}</strong></span></summary>
          <ul>{section.lines.map((line, lineIndex) => <li key={lineIndex}>{line}</li>)}</ul>
        </details>)}
      </div> : <p className="nxt5-home-section-intro">{!group ? t("Aucun groupe de parties n’est encore disponible.") : !report ? t("Le débrief de ce groupe n’est pas encore disponible.") : t("Ce débrief ne contient pas encore de passage attribuable à ton profil.")}</p>}
      {report && <PublicTextLink href={reportPath(report)} navigate={navigate} className="nxt5-home-text-link">{t("Relire le débrief")}<ArrowRight size={16} aria-hidden="true" /></PublicTextLink>}
    </> : <>
      <p className="nxt5-home-section-intro">{t("Demande à ton responsable de relier ton compte à ton profil joueur pour retrouver ici tes remarques de débrief.")}</p>
      <PublicTextLink href="/mon-equipe" navigate={navigate} className="nxt5-home-text-link">{t("Voir mon équipe")}<ArrowRight size={16} aria-hidden="true" /></PublicTextLink>
    </>}
  </section>;
}

function homeFocus(context, now, historyComplete) {
  const { matches, latestMatch, latestMatchAt, recentMatches, unreviewedRecentMatches, nextEvent, canImport, canReview, linkedPlayer } = context;
  if (!matches.length) return {
    kind: "start", title: "Prépare les premières parties de ton équipe.", subtitle: "Retrouve les parties, les débriefs et le planning de ton équipe.",
    label: "Pour commencer", heading: canImport ? "Ajoute votre première partie" : "Prends tes repères dans l’équipe",
    text: canImport ? "Importe une partie pour retrouver son résumé et préparer votre premier débrief. Tu peux créer les profils joueurs pendant l’import." : "Retrouve les joueurs et le planning. Les parties apparaîtront ici dès leur ajout par le staff.",
    href: canImport ? "/games?import=1" : linkedPlayer ? `/mon-profil?player=${encodeURIComponent(linkedPlayer.id)}` : "/mon-equipe",
    action: canImport ? "Importer une partie" : linkedPlayer ? "Ouvrir mon profil" : "Voir mon équipe", icon: canImport ? Upload : Users,
  };
  if (nextEvent && nextEvent.startsAt <= now + 48 * 60 * 60 * 1000) return {
    kind: "session", title: nextEvent.inProgress ? "Votre séance est en cours." : "Votre prochaine séance approche.",
    subtitle: "Retrouve le programme et les derniers repères de l’équipe.", label: nextEvent.inProgress ? "En ce moment" : "Dans les prochaines 48 heures",
    heading: nextEvent.title || "Séance de l’équipe", text: sessionDate(nextEvent), href: "/planning", action: "Ouvrir le planning", icon: CalendarDays,
  };
  const pending = unreviewedRecentMatches[0];
  if (pending) return {
    kind: "review", title: canReview ? "Place au débrief." : "Retrouve les dernières parties de ton équipe.",
    subtitle: historyComplete ? `${countLabel(unreviewedRecentMatches.length, "partie récente", "parties récentes")} sans débrief enregistré.` : "Retrouve les parties, les débriefs et le planning de ton équipe.",
    label: canReview ? "Votre prochain débrief" : "Votre dernière activité", heading: matchDisplayName(pending, "Partie de l’équipe"),
    text: canReview ? "Reprends cette partie, note un point à garder et une action à travailler ensemble." : "Ouvre le résumé pour retrouver le résultat et les points à discuter avec l’équipe.",
    href: canReview ? reviewPath(pending) : matchPath(pending), action: canReview ? "Préparer le débrief" : "Voir la partie", icon: canReview ? FileText : Swords,
    secondary: canReview ? { href: matchPath(pending), label: "Voir la partie" } : null,
  };
  if (recentMatches.length) {
    const recent = recentMatches[0];
    const report = context.reportForMatch(recent);
    const draft = report?.discord_status === "draft";
    return {
      kind: "active", title: draft ? "Ton débrief est en cours." : "Reprends le dernier débrief de ton équipe.", subtitle: "Retrouve le débrief de votre dernière partie et les points à travailler pour la suite.",
      label: draft ? "Brouillon · staff uniquement" : "À reprendre ensemble", heading: report?.title || matchDisplayName(recent, "Votre dernière partie"),
      text: draft ? "Reprends ce brouillon avant de le partager avec l’équipe." : "Relis les observations de l’équipe avant la prochaine séance.",
      href: report ? reportPath(report) : matchPath(recent), action: report ? draft ? "Reprendre le débrief" : "Relire le débrief" : "Voir la partie", icon: FileText,
    };
  }
  const datedHistory = latestMatchAt != null && latestMatchAt <= now;
  return {
    kind: "quiet", title: "Prépare la prochaine séance.",
    subtitle: datedHistory ? "Aucune partie récente dans l’espace de l’équipe sur les 14 derniers jours." : "Retrouve votre historique et prépare la prochaine séance.",
    label: "Pour reprendre", heading: canImport ? "Ajoute votre prochaine partie" : "Consulte le planning de ton équipe",
    text: canImport ? "Si ton équipe a rejoué depuis, importe la partie pour préparer son débrief." : "Consulte le planning et retrouve les points à travailler dans vos dernières parties.",
    href: canImport ? "/games?import=1" : "/planning", action: canImport ? "Importer une partie" : "Ouvrir le planning", icon: canImport ? Upload : CalendarDays,
    secondary: { href: matchPath(latestMatch), label: "Revoir la dernière partie" },
  };
}

export default function HomeWorkspace({ data = {}, currentTeam, currentMember, user, steps = [], onboarding = {}, navigate, loading = false, apiError = "", now: suppliedNow }) {
  useLanguage();
  const [clock, setClock] = useState(() => Date.now());
  const [guideKey, setGuideKey] = useState(null);
  const guideTrigger = useRef(null);
  const heroRef = useRef(null);
  useEffect(() => {
    if (suppliedNow != null) return undefined;
    const timer = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [suppliedNow]);
  // A team's personal guide must never stay open when switching teams/accounts.
  const contextKey = `${currentTeam?.id || ""}:${user?.id || ""}`;
  useEffect(() => { setGuideKey(null); }, [contextKey]);
  const now = suppliedNow == null ? clock : homeMatchTimestamp({ date: suppliedNow }) ?? clock;
  const context = getHomeContext({ data, currentTeam, currentMember, user, now });
  if (!currentTeam) return null;
  const historyComplete = data.historyComplete !== false && !data.pagination?.hasMore;
  const focus = homeFocus(context, now, historyComplete);
  // The first page is enough for the latest activity. The historical count is
  // supplied by the server and must not shrink to the currently loaded page.
  const serverTotal = data.selectedTeamId === currentTeam.id ? data.totals?.games ?? data.pagination?.total : null;
  const totalMatches = Number.isSafeInteger(Number(serverTotal)) && Number(serverTotal) >= context.matches.length ? Number(serverTotal) : context.matches.length;
  const unfinished = steps.some(step => !step.done);
  const showStart = unfinished && ((!context.matches.length && !onboarding.dismissed) || guideKey === contextKey);
  const startIsPrimary = showStart && !context.matches.length;
  const closeStart = () => { setGuideKey(null); onboarding.dismiss?.(); guideTrigger.current?.focus(); };
  const openStart = () => { setGuideKey(contextKey); onboarding.resume?.(); };
  const nextEvent = context.nextEvent;
  const FocusIcon = focus.icon;
  const mainRoster = rosterPlayersByStatus(context.players, "MAIN");
  const shortcuts = [
    { path: "/games", title: "Parties", text: totalMatches ? `${countLabel(totalMatches, "partie")} dans votre historique` : "Retrouver les premières parties importées", icon: Swords },
    { path: "/planning", title: "Planning", text: nextEvent ? "Retrouver vos séances et disponibilités" : "Organiser la prochaine séance", icon: CalendarDays },
    context.reports.length ? { path: "/rapports", title: "Débriefs", text: `${countLabel(context.reports.length, "débrief")} pour préparer la suite`, icon: FileText }
      : { path: "/mon-equipe", title: "Mon équipe", text: context.importPlayers.length ? `${countLabel(context.importPlayers.length, "joueur")} · retrouver l’effectif et le staff` : "Faire connaissance avec ton équipe", icon: Users },
  ];

  return <div className="nxt5-home" data-home-state={focus.kind}>
    <div ref={heroRef} className="nxt5-home-hero">
      <div className="nxt5-home-identity">
        <div className="nxt5-home-team-brand">
          <span className="nxt5-home-team-mark" aria-hidden="true"><TeamAvatar team={currentTeam} className="nxt5-home-team-image" /></span>
          <p className="nxt5-home-team-name">{currentTeam.name}</p>
        </div>
        <PageHeader title={t(focus.title)} subtitle={t(focus.subtitle)} />
        {!startIsPrimary && <section className="nxt5-home-ready" aria-labelledby="nxt5-home-focus-title">
          <p className="nxt5-home-status"><FocusIcon size={18} aria-hidden="true" />{t(focus.label)}</p>
          <h3 id="nxt5-home-focus-title">{["start", "quiet"].includes(focus.kind) ? t(focus.heading) : focus.heading}</h3>
          <p className="nxt5-home-focus-description">{t(focus.text)}</p>
          <div className="nxt5-home-actions">
            <LinkButton href={focus.href} navigate={navigate} icon={ArrowRight}>{t(focus.action)}</LinkButton>
            {focus.secondary && <PublicTextLink href={focus.secondary.href} navigate={navigate} className="nxt5-home-text-link">{t(focus.secondary.label)}<ArrowRight size={16} aria-hidden="true" /></PublicTextLink>}
          </div>
        </section>}
      </div>
      <div className="nxt5-home-hero-art" aria-hidden="true">
        <span className="nxt5-home-hero-orbit" />
        <GlassScene className="nxt5-home-glass-scene" pointerTargetRef={heroRef} pointerStrength={1} />
        <div className="nxt5-home-hero-roles">{ROLES.map(role => <span key={role}><RoleIcon role={role} className="nxt5-home-hero-role-icon" /><span>{role}</span></span>)}</div>
      </div>
    </div>
    {(loading || apiError) && <p className="nxt5-home-data-status" role="status">{loading ? t("Actualisation de l’équipe…") : t("Cet aperçu reprend les dernières données chargées. Réessaie l’actualisation pour le mettre à jour.")}</p>}
    {startIsPrimary && <BeginnerCompass steps={steps} manager={context.manager} onNavigate={navigate} onClose={closeStart} />}
    {mainRoster.length > 0 && <nav className="nxt5-home-lineup" aria-label={t("Titulaires")}>
      {ROLES.map(role => {
        const player = mainRoster.find(member => String(member.role).toUpperCase() === role);
        return player ? <PublicTextLink key={role} href={`/mon-profil?player=${encodeURIComponent(player.id)}`} navigate={navigate} className="nxt5-home-lineup-player"><span className="nxt5-home-lineup-role" aria-hidden="true"><RoleIcon role={role} /></span><span><small>{role}</small><strong>{player.name}</strong></span><ArrowRight className="nxt5-home-lineup-arrow" size={15} aria-hidden="true" /></PublicTextLink> : <span key={role} className="nxt5-home-lineup-player is-empty"><span className="nxt5-home-lineup-role" aria-hidden="true"><RoleIcon role={role} /></span><span><small>{role}</small><strong>—</strong></span></span>;
      })}
    </nav>}

    <HomeGoals context={context} navigate={navigate} />

    <div className={`nxt5-home-overview${context.showPlayerDebrief ? "" : " nxt5-home-overview--wide"}`}>
      <section className="nxt5-home-section" aria-labelledby="nxt5-home-games-title">
        <div className="nxt5-home-section-heading"><Swords size={20} aria-hidden="true" /><h3 id="nxt5-home-games-title">{context.matches.length ? t("Dernières parties") : t("Les premières parties de ton équipe")}</h3></div>
        {context.matches.length ? <>
          {historyComplete && <p className="nxt5-home-section-intro">{t(countLabel(context.recentMatches.length, "partie"))}{t(" sur les 14 derniers jours")}</p>}
          <ul className="nxt5-home-games">
            {context.matches.slice(0, 3).map(match => {
              const report = context.reportForMatch(match);
              return <li key={match.id} data-result={match.result === "Victoire" ? "win" : match.result === "Défaite" ? "loss" : undefined}>
                <PublicTextLink className="nxt5-home-game-link" href={matchPath(match)} navigate={navigate}>
                  <span><strong>{matchDisplayName(match, "Partie de l’équipe")}</strong><span className="nxt5-home-game-meta">{t(dateLabel(homeMatchTimestamp(match)))} · {report ? report.discord_status === "draft" ? t("Brouillon de débrief") : t("Débrief disponible") : t("Sans débrief")}</span></span>
                  {match.result && <Badge tone={match.result === "Victoire" ? "green" : match.result === "Défaite" ? "red" : "slate"}>{t(match.result)}</Badge>}
                  <ArrowRight size={16} aria-hidden="true" />
                </PublicTextLink>
              </li>;
            })}
          </ul>
        </> : <>
          <p className="nxt5-home-section-intro">{context.importPlayers.length ? t("{0} dans l’effectif. Les premières parties et leurs débriefs apparaîtront ici.", [t(countLabel(context.importPlayers.length, "joueur"))]) : t("Les joueurs, les parties et les prochaines séances apparaîtront ici après leur ajout.")}</p>
          <PublicTextLink href={context.canManageRoster ? "/gestion-equipe?section=roster" : "/mon-equipe"} navigate={navigate} className="nxt5-home-text-link">{context.canManageRoster ? t("Compléter l’effectif") : t("Voir mon équipe")}<ArrowRight size={16} aria-hidden="true" /></PublicTextLink>
        </>}
      </section>
      {context.showPlayerDebrief && <HomePlayerDebrief context={context} navigate={navigate} />}
    </div>

    {unfinished && !startIsPrimary && <div className="nxt5-home-learning">
      <div className="nxt5-home-resume"><div><strong>{t("Besoin de prendre tes repères ?")}</strong><p>{t("Reprends les étapes de démarrage.")}</p></div><Button ref={guideTrigger} type="button" variant="ghost" aria-expanded={showStart} aria-controls="nxt5-home-learning-content" onClick={showStart ? closeStart : openStart}>{showStart ? t("Masquer le démarrage") : t("Reprendre le démarrage")}</Button></div>
      <div id="nxt5-home-learning-content">{showStart && <BeginnerCompass steps={steps} manager={context.manager} onNavigate={navigate} onClose={closeStart} />}</div>
    </div>}
    <nav className="nxt5-home-shortcuts" aria-label={t("Raccourcis du quotidien")}>
      {shortcuts.map(({ path, title, text, icon: Icon }) => <PublicTextLink key={path} href={path} navigate={navigate} className="nxt5-home-shortcut"><Icon size={21} aria-hidden="true" /><span><strong>{t(title)}</strong><span>{t(text)}</span></span><ArrowRight size={17} aria-hidden="true" /></PublicTextLink>)}
    </nav>
    <PublicTextLink className="nxt5-home-guide" href="/guide" navigate={navigate}>{t("Besoin d’aide ? Ouvrir le guide")}</PublicTextLink>
  </div>;
}
