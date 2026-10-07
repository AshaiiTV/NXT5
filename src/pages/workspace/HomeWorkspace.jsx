import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays, FileText, Swords, Upload, Users } from "lucide-react";
import { BeginnerCompass } from "../../components/layout/AppChrome.jsx";
import { Badge, Button, PageHeader, Surface } from "../../components/ui/Core.jsx";
import { getHomeContext, homeMatchTimestamp } from "../../utils/home-context.js";
import { matchDisplayName } from "../../utils/matches.js";
import { LinkButton, PublicTextLink } from "../public/PublicPages.jsx";
import "./home-workspace.css";

const matchPath = match => `/games?match=${encodeURIComponent(match.id)}`;
const reportPath = report => `/rapports?report=${encodeURIComponent(report.id)}`;
const reviewPath = match => `/rapports?match=${encodeURIComponent(match.id)}&compose=1`;
const countLabel = (count, singular, plural = `${singular}s`) => `${count} ${count > 1 ? plural : singular}`;

function dateLabel(timestamp, options = {}) {
  if (timestamp == null || !Number.isFinite(timestamp)) return "Date non renseignée";
  const format = { day: "numeric", month: "short", year: "numeric", ...options };
  try { return new Intl.DateTimeFormat("fr-FR", format).format(timestamp); }
  catch { delete format.timeZone; return new Intl.DateTimeFormat("fr-FR", format).format(timestamp); }
}

function sessionDate(event) {
  return dateLabel(event.startsAt, { weekday: "long", hour: "2-digit", minute: "2-digit", ...(event.timezone ? { timeZone: event.timezone, timeZoneName: "short" } : {}) });
}

function homeFocus(context, now) {
  const { matches, latestMatch, latestMatchAt, recentMatches, unreviewedRecentMatches, nextEvent, canImport, canReview, linkedPlayer } = context;
  if (!matches.length) return {
    kind: "start", title: "Les premiers pas de votre équipe.", subtitle: "Un espace pour vos parties, vos débriefs et vos prochaines séances.",
    label: "Pour commencer", heading: canImport ? "Ajoute votre première partie" : "Prends tes repères dans l’équipe",
    text: canImport ? "Importe une partie pour retrouver son résumé et préparer votre premier débrief. Tu peux créer les profils joueurs pendant l’import." : "Retrouve les joueurs et le planning. Les parties apparaîtront ici dès leur ajout par le staff.",
    href: canImport ? "/games?import=1" : linkedPlayer ? `/mon-profil?player=${encodeURIComponent(linkedPlayer.id)}` : "/equipes",
    action: canImport ? "Importer une partie" : linkedPlayer ? "Ouvrir mon profil" : "Voir mon équipe", icon: canImport ? Upload : Users,
  };
  if (nextEvent && nextEvent.startsAt <= now + 48 * 60 * 60 * 1000) return {
    kind: "session", title: nextEvent.inProgress ? "Votre séance est en cours." : "Votre prochaine séance approche.",
    subtitle: "Retrouve le programme et les derniers repères de l’équipe.", label: nextEvent.inProgress ? "En ce moment" : "Dans les prochaines 48 heures",
    heading: nextEvent.title || "Séance de l’équipe", text: sessionDate(nextEvent), href: "/planning", action: "Ouvrir le planning", icon: CalendarDays,
  };
  const pending = unreviewedRecentMatches[0];
  if (pending) return {
    kind: "review", title: canReview ? "Place au débrief." : "Vos dernières parties vous attendent.",
    subtitle: `${countLabel(unreviewedRecentMatches.length, "partie récente", "parties récentes")} sans débrief enregistré.`,
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
      kind: "active", title: draft ? "Votre débrief prend forme." : "Gardez le fil de votre jeu.", subtitle: "Retrouve le débrief de votre dernière partie et les points à travailler pour la suite.",
      label: draft ? "Brouillon · staff uniquement" : "À reprendre ensemble", heading: report?.title || matchDisplayName(recent, "Votre dernière partie"),
      text: draft ? "Reprends ce brouillon avant de le partager avec l’équipe." : "Relis les observations de l’équipe avant la prochaine séance.",
      href: report ? reportPath(report) : matchPath(recent), action: report ? draft ? "Reprendre le débrief" : "Relire le débrief" : "Voir la partie", icon: FileText,
    };
  }
  const datedHistory = latestMatchAt != null && latestMatchAt <= now;
  return {
    kind: "quiet", title: "On prépare la suite ?",
    subtitle: datedHistory ? "Aucune partie récente dans l’espace de l’équipe sur les 14 derniers jours." : "Retrouve votre historique et prépare la prochaine séance.",
    label: "Pour reprendre", heading: canImport ? "Ajoute votre prochaine partie" : "Retrouve le rythme de l’équipe",
    text: canImport ? "Vous avez rejoué depuis ? Ajoute la partie pour repartir sur un débrief à jour." : "Consulte le planning et retrouve les points à travailler dans vos dernières parties.",
    href: canImport ? "/games?import=1" : "/planning", action: canImport ? "Importer une partie" : "Ouvrir le planning", icon: canImport ? Upload : CalendarDays,
    secondary: { href: matchPath(latestMatch), label: "Revoir la dernière partie" },
  };
}

export default function HomeWorkspace({ data = {}, currentTeam, currentMember, user, steps = [], onboarding = {}, navigate, loading = false, apiError = "", now: suppliedNow }) {
  const [clock, setClock] = useState(() => Date.now());
  const [guideKey, setGuideKey] = useState(null);
  const guideTrigger = useRef(null);
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
  const focus = homeFocus(context, now);
  const unfinished = steps.some(step => !step.done);
  const showStart = unfinished && ((!context.matches.length && !onboarding.dismissed) || guideKey === contextKey);
  const startIsPrimary = showStart && !context.matches.length;
  const closeStart = () => { setGuideKey(null); onboarding.dismiss?.(); guideTrigger.current?.focus(); };
  const openStart = () => { setGuideKey(contextKey); onboarding.resume?.(); };
  const latestReport = context.latestReport;
  const nextEvent = context.nextEvent;
  const FocusIcon = focus.icon;
  const shortcuts = [
    { path: "/games", title: "Parties", text: context.matches.length ? `${countLabel(context.matches.length, "partie")} dans votre historique` : "Retrouver les premières parties importées", icon: Swords },
    { path: "/planning", title: "Planning", text: nextEvent ? "Retrouver vos séances et disponibilités" : "Organiser la prochaine séance", icon: CalendarDays },
    context.reports.length ? { path: "/rapports", title: "Débriefs", text: `${countLabel(context.reports.length, "débrief")} pour préparer la suite`, icon: FileText }
      : { path: "/equipes", title: "Équipe", text: context.importPlayers.length ? `${countLabel(context.importPlayers.length, "joueur")} · retrouver l’effectif et le staff` : "Faire connaissance avec ton équipe", icon: Users },
  ];

  return <div className="nxt5-home" data-home-state={focus.kind}>
    <PageHeader eyebrow={currentTeam.name} title={focus.title} subtitle={focus.subtitle}>
      {context.canImport && context.matches.length > 0 && focus.kind !== "quiet" && <LinkButton href="/games?import=1" navigate={navigate} icon={Upload} variant="ghost">Importer une partie</LinkButton>}
    </PageHeader>
    {(loading || apiError) && <p className="nxt5-home-data-status" role="status">{loading ? "Actualisation de l’équipe…" : "Cet aperçu reprend les dernières données chargées. Réessaie l’actualisation pour le mettre à jour."}</p>}
    {startIsPrimary ? <BeginnerCompass steps={steps} manager={context.manager} onNavigate={navigate} onClose={closeStart} /> : <Surface glow className="nxt5-home-ready">
      <p className="nxt5-home-status"><FocusIcon size={18} aria-hidden="true" />{focus.label}</p>
      <h3>{focus.heading}</h3>
      <p className="nxt5-home-focus-description">{focus.text}</p>
      <div className="nxt5-home-actions">
        <LinkButton href={focus.href} navigate={navigate} icon={ArrowRight}>{focus.action}</LinkButton>
        {focus.secondary && <PublicTextLink href={focus.secondary.href} navigate={navigate} className="nxt5-home-text-link">{focus.secondary.label}<ArrowRight size={16} aria-hidden="true" /></PublicTextLink>}
      </div>
    </Surface>}

    <div className="nxt5-home-overview">
      <section className="nxt5-home-section" aria-labelledby="nxt5-home-games-title">
        <div className="nxt5-home-section-heading"><Swords size={20} aria-hidden="true" /><h3 id="nxt5-home-games-title">{context.matches.length ? "Dernières parties" : "Votre équipe prend ses marques"}</h3></div>
        {context.matches.length ? <>
          <p className="nxt5-home-section-intro">{countLabel(context.recentMatches.length, "partie")} sur les 14 derniers jours</p>
          <ul className="nxt5-home-games">
            {context.matches.slice(0, 3).map(match => {
              const report = context.reportForMatch(match);
              return <li key={match.id}>
                <PublicTextLink className="nxt5-home-game-link" href={matchPath(match)} navigate={navigate}>
                  <span><strong>{matchDisplayName(match, "Partie de l’équipe")}</strong><span className="nxt5-home-game-meta">{dateLabel(homeMatchTimestamp(match))} · {report ? report.discord_status === "draft" ? "Brouillon de débrief" : "Débrief disponible" : "Sans débrief"}</span></span>
                  {match.result && <Badge tone={match.result === "Victoire" ? "green" : match.result === "Défaite" ? "red" : "slate"}>{match.result}</Badge>}
                  <ArrowRight size={16} aria-hidden="true" />
                </PublicTextLink>
              </li>;
            })}
          </ul>
        </> : <>
          <p className="nxt5-home-section-intro">{context.importPlayers.length ? `${countLabel(context.importPlayers.length, "joueur")} dans l’effectif. Les premières parties et leurs débriefs prendront place ici.` : "Retrouve ici les joueurs, les parties et les prochains rendez-vous de l’équipe au fur et à mesure."}</p>
          <PublicTextLink href={context.canManageRoster ? "/gestion-equipe?section=roster" : "/equipes"} navigate={navigate} className="nxt5-home-text-link">{context.canManageRoster ? "Compléter l’effectif" : "Voir mon équipe"}<ArrowRight size={16} aria-hidden="true" /></PublicTextLink>
        </>}
      </section>
      <section className="nxt5-home-section" aria-labelledby="nxt5-home-next-title">
        <div className="nxt5-home-section-heading">{focus.kind === "session" && latestReport ? <FileText size={20} aria-hidden="true" /> : <CalendarDays size={20} aria-hidden="true" />}<h3 id="nxt5-home-next-title">{focus.kind === "session" ? "Pour préparer la séance" : "Prochaine séance"}</h3></div>
        {focus.kind === "session" ? <>
          <p className="nxt5-home-section-intro">{latestReport ? latestReport.discord_status === "draft" ? "Un brouillon de débrief attend le staff avant d’être partagé avec l’équipe." : "Reprends les points du dernier débrief avant de vous retrouver." : "Retrouve les joueurs et vos disponibilités pour cette séance."}</p>
          {latestReport && <p className="nxt5-home-session-title">{latestReport.title || "Dernier débrief de l’équipe"}</p>}
          <PublicTextLink href={latestReport ? reportPath(latestReport) : "/equipes"} navigate={navigate} className="nxt5-home-text-link">{latestReport ? latestReport.discord_status === "draft" ? "Reprendre le débrief" : "Relire le débrief" : "Voir mon équipe"}<ArrowRight size={16} aria-hidden="true" /></PublicTextLink>
        </> : <>
          {nextEvent ? <><p className="nxt5-home-session-title">{nextEvent.title || "Séance de l’équipe"}</p><p className="nxt5-home-section-intro">{sessionDate(nextEvent)}</p></> : <p className="nxt5-home-section-intro">Aucune séance à venir dans le planning.{context.linkedPlayer ? " Renseigne tes disponibilités pour aider l’équipe à se retrouver." : " Ouvre le planning pour retrouver les disponibilités de l’équipe."}</p>}
          <PublicTextLink href="/planning" navigate={navigate} className="nxt5-home-text-link">{nextEvent ? "Voir le planning" : context.linkedPlayer ? "Donner mes disponibilités" : "Ouvrir le planning"}<ArrowRight size={16} aria-hidden="true" /></PublicTextLink>
        </>}
      </section>
    </div>

    {unfinished && !startIsPrimary && <div className="nxt5-home-learning">
      <div className="nxt5-home-resume"><div><strong>Besoin de prendre tes repères ?</strong><p>Retrouve tes premières étapes, à ton rythme.</p></div><Button ref={guideTrigger} type="button" variant="ghost" aria-expanded={showStart} aria-controls="nxt5-home-learning-content" onClick={showStart ? closeStart : openStart}>{showStart ? "Masquer le démarrage" : "Reprendre le démarrage"}</Button></div>
      <div id="nxt5-home-learning-content">{showStart && <BeginnerCompass steps={steps} manager={context.manager} onNavigate={navigate} onClose={closeStart} />}</div>
    </div>}
    <nav className="nxt5-home-shortcuts" aria-label="Raccourcis du quotidien">
      {shortcuts.map(({ path, title, text, icon: Icon }) => <PublicTextLink key={path} href={path} navigate={navigate} className="nxt5-home-shortcut"><Icon size={21} aria-hidden="true" /><span><strong>{title}</strong><span>{text}</span></span><ArrowRight size={17} aria-hidden="true" /></PublicTextLink>)}
    </nav>
    <PublicTextLink className="nxt5-home-guide" href="/guide" navigate={navigate}>Besoin d’aide ? Ouvrir le guide</PublicTextLink>
  </div>;
}
