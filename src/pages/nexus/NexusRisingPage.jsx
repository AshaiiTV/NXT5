import React, { lazy, Suspense, useEffect, useState } from "react";
import { ArrowRight, LogIn, RefreshCw, ShieldCheck, Trophy, Users } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { buildLoginRedirect } from "../../app/routing.js";
import { Nxt5Wordmark } from "../../components/brand/BrandAssets.jsx";
import { Badge, Button, SelectInput, SkeletonRows, Surface, TabNav } from "../../components/ui/Core.jsx";
import LanguageSwitcher from "../../i18n/LanguageSwitcher.jsx";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { getLocale } from "../../i18n/locale.js";
import { NexusStandings, NexusPlayoffs, NexusSwissByes } from "./NexusTournament.jsx";
import NexusComingSoon from "./NexusComingSoon.jsx";
import "./nexus-rising.css";

const NexusWorkspace = lazy(() => import("./NexusWorkspace.jsx"));
const NexusRegistration = lazy(() => import("./NexusRegistration.jsx"));
const stat = value => typeof value === "number" && Number.isFinite(value) ? value : "—";

export default function NexusRisingPage({ user, navigate }) {
  useLanguage();
  const [overviewResult, setOverview] = useState(null);
  const accountId = user?.id || "";
  const isPlatformAdmin = user?.is_platform_admin === true;
  const currentResult = isPlatformAdmin && overviewResult?.accountId === accountId ? overviewResult.data : null;
  const overview = currentResult?.access === "staff" ? currentResult : null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [manage, setManage] = useState(false);
  const [selected, setSelected] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [tab, setTab] = useState("schedule");
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [guard, setGuard] = useState({ dirty: false, busy: false });
  const [leaveRequested, setLeaveRequested] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(isPlatformAdmin); setError(""); setOverview(null); setSelected(""); setManage(false); setRegistrationOpen(false); setLeaveRequested(false);
    if (!isPlatformAdmin) return () => controller.abort();
    apiFetch("nexus-overview", { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) {
        setOverview({ accountId, data: result.access === "staff" ? result : {access:"coming_soon"} });
        setSeasonId(current => result.access === "staff" ? result.seasons?.some(item => item.id === current) ? current : result.seasons?.[0]?.id || "" : "");
      }
    }).catch(issue => { if (!controller.signal.aborted) {if(issue.status===401 || issue.status===403)setOverview({accountId,data:{access:"coming_soon"}});else setError(issue.message || t("Chargement impossible. Réessaie."));} }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user?.id, isPlatformAdmin, refresh]);
  const season = overview?.seasons?.find(item => item.id === seasonId);
  const fixtures = (overview?.fixtures || []).filter(item => !seasonId || item.seasonId === seasonId);
  const standings = (overview?.standings || []).filter(item => item.seasonId === seasonId);
  const playoff = overview?.playoffs?.find(item => item.seasonId === seasonId);
  const fixture = user && overview?.fixtures?.find(item => item.id === selected && item.canViewDetails === true);
  const staff = isPlatformAdmin && overview?.access === "staff";
  const signedIn = !!user;
  const directElimination=["single_elimination","double_elimination"].includes(season?.format);
  const seasonTabs=[{id:"schedule",label:"Calendrier"},...(!directElimination?[{id:"standings",label:"Classement"}]:[]),...(directElimination || season?.playoffEnabled !== false?[{id:"playoffs",label:"Playoffs"}]:[])];
  function openCalendar() {
    if (guard.busy) return;
    if (guard.dirty) setLeaveRequested("calendar");
    else { setManage(false); setSelected(""); if (manage) setRefresh(value=>value+1); }
  }
  function openAccount() {
    if (guard.busy) return;
    if (guard.dirty) setLeaveRequested("account");
    else navigate("/accueil");
  }
  function loseAccess() { setManage(false);setRegistrationOpen(false);setSelected("");setOverview({accountId,data:{access:"coming_soon"}}); }

  if (!staff) return <NexusComingSoon user={user} navigate={navigate} verifying={isPlatformAdmin && !currentResult && loading} error={isPlatformAdmin && !currentResult ? error : ""} onRetry={()=>setRefresh(value=>value+1)} />;

  return <div className="nexus-page"><a className="nexus-skip" href="#nexus-content">{t("Aller au contenu")}</a>
    <header className="nexus-header"><a href="/nexus-rising" className="nexus-brand" aria-label="Nexus Rising" onClick={event => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); openCalendar(); }}><Trophy size={26} aria-hidden="true" /><span translate="no">Nexus Rising<small>{t("Ligue amateur · EUW")}</small></span></a><div className="nexus-header-actions"><a href="/" className="nexus-nxt5" aria-label={t("Accueil NXT5")}><Nxt5Wordmark className="h-7 w-20 object-contain" /></a><LanguageSwitcher />{signedIn ? <Button variant="ghost" disabled={guard.busy} onClick={openAccount}>{user.name || t("Mon compte")}</Button> : <Button variant="ghost" icon={LogIn} onClick={() => navigate(buildLoginRedirect("/nexus-rising"))}>{t("Connexion NXT5")}</Button>}</div></header>
    <main id="nexus-content" className="nexus-main" tabIndex={-1}>
      <div className="nexus-toolbar"><Badge tone={staff ? "purple" : signedIn ? "cyan" : "slate"}>{t(staff ? "Espace staff" : signedIn ? "Compte NXT5 connecté" : "Accès invité")}</Badge>{staff && <Button variant="ghost" icon={manage ? Trophy : ShieldCheck} disabled={guard.busy} onClick={() => { if (manage) openCalendar(); else setManage(true); }}>{t(manage ? "Voir le calendrier" : "Gérer les rencontres")}</Button>}</div>
      {leaveRequested && <div className="nexus-message" role="alert"><p>{t("Quitter cette rubrique abandonnera tes modifications.")}</p><div className="nexus-actions"><Button variant="ghost" disabled={guard.busy} onClick={() => setLeaveRequested(false)}>{t("Rester sur cette page")}</Button><Button variant="ghost" disabled={guard.busy} onClick={() => { const destination = leaveRequested; setLeaveRequested(false); if (destination === "account") navigate("/accueil"); else {setManage(false);setRefresh(value=>value+1);} }}>{t("Quitter sans enregistrer")}</Button></div></div>}
      {manage && staff ? <Suspense fallback={<div role="status" aria-label={t("Chargement de l’espace staff")}><SkeletonRows count={3} /></div>}><NexusWorkspace onNavigationState={setGuard} onSessionExpired={loseAccess} /></Suspense> : <>
        <div className="nexus-intro"><div><p className="nexus-eyebrow">{season?.name || "Nexus Rising"}</p><h1>{t("La saison, partie après partie.")}</h1><p>{t("Retrouve les rencontres Nexus Rising et les résultats validés par le staff.")}</p></div><div className="nexus-member-note"><Users size={22} aria-hidden="true" /><p>{t(signedIn ? "Si tu fais partie d’une équipe NXT5 inscrite à Nexus Rising, les statistiques détaillées de ses rencontres s’affichent ici." : "Le calendrier et les résultats sont accessibles sans compte. Connecte ton compte NXT5 pour consulter les statistiques de ton équipe participante.")}</p></div></div>
        <div className="nexus-season-bar">{!!overview?.seasons?.length && <SelectInput label={t("Saison")} value={seasonId} onChange={value => { setSeasonId(value); setSelected(""); setTab("schedule"); }}>{overview.seasons.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput>}{signedIn && <Button variant="ghost" icon={Users} onClick={() => setRegistrationOpen(value => !value)}>{t("Inscrire mon équipe")}</Button>}</div>
        {registrationOpen && signedIn && <Suspense fallback={<div role="status"><SkeletonRows count={2} /></div>}><NexusRegistration onClose={() => setRegistrationOpen(false)} onAccessLost={loseAccess} /></Suspense>}
        {season && <TabNav items={seasonTabs} activeId={tab} onChange={value => { setTab(value); setSelected(""); }} label="Vues de la saison" idPrefix="nexus-season" panelId="nexus-season-panel" />}
        {season && tab !== "schedule" && <div id="nexus-season-panel" role="tabpanel" aria-labelledby={`nexus-season-tab-${tab}`} className="nexus-season-panel">{tab === "standings" ? <>{standings.length ? standings.map(group=><NexusStandings key={group.groupId || "all"} standings={group}/>) : <NexusStandings/>}<NexusSwissByes season={season} standings={standings}/></> : <NexusPlayoffs fixtures={fixtures} bracket={playoff?.bracket} teams={standings.flatMap(group=>group.rows)} />}</div>}
        {tab === "schedule" && <NexusSwissByes season={season} standings={standings}/>}
        {error && <div className="nexus-message nexus-error" role="alert"><p>{error}</p><Button variant="ghost" icon={RefreshCw} onClick={() => setRefresh(value => value + 1)}>{t("Réessayer")}</Button></div>}
        {loading && <div role="status" aria-label={t("Chargement des rencontres")}><SkeletonRows count={3} /></div>}
        {!loading && !error && tab === "schedule" && !fixtures.length && <div id="nexus-season-panel" role={season ? "tabpanel" : undefined} aria-labelledby={season ? "nexus-season-tab-schedule" : undefined}><Surface variant="reading" className="nexus-card nexus-empty"><Trophy size={30} aria-hidden="true" /><h2>{t("Le calendrier se prépare")}</h2><p>{t("Les rencontres apparaîtront ici dès leur création par le staff.")}</p></Surface></div>}
        {tab === "schedule" && !!fixtures.length && <section id="nexus-season-panel" role={season ? "tabpanel" : undefined} aria-labelledby={season ? "nexus-season-tab-schedule" : undefined} className="nexus-schedule" aria-label={t("Calendrier Nexus Rising")}>{fixtures.map(item => <Surface variant="reading" key={item.id} className="nexus-card nexus-match-card"><div className="nexus-section-title"><p className="nexus-eyebrow">{item.label}</p><span className="nexus-muted">{item.startsAt ? new Date(item.startsAt).toLocaleString(getLocale()) : t("À programmer")}</span></div><h2>{item.teamA}<span className="nexus-versus">vs</span>{item.teamB}</h2>{!item.games?.length ? <p className="nexus-muted">{t("Résultat à venir")}</p> : <ul className="nexus-results">{item.games.map(game => <li key={game.gameId}><span>{Number.isInteger(game.gameNumber) ? t("Partie {0}", [game.gameNumber]) : game.gameId}</span><strong>{game.winner === "A" ? item.teamA : game.winner === "B" ? item.teamB : "—"}</strong><Badge tone="green">{t("Victoire")}</Badge><span>{Math.floor(game.duration / 60)}:{String(Math.round(game.duration % 60)).padStart(2, "0")}</span></li>)}</ul>}{signedIn && item.canViewDetails === true && <Button variant="ghost" icon={ArrowRight} onClick={() => setSelected(item.id)}>{t("Statistiques de mon équipe")}</Button>}</Surface>)}</section>}
        {fixture && <section className="nexus-detail" aria-label={t("Statistiques de mon équipe")}><div className="nexus-section-title"><h2>{fixture.label}</h2><Button variant="ghost" onClick={() => setSelected("")}>{t("Fermer")}</Button></div>{!fixture.statistics?.length ? <p className="nexus-muted">{t("Aucune statistique validée pour cette rencontre.")}</p> : fixture.statistics.map(game => <Surface variant="reading" key={game.gameId} className="nexus-card"><h3>{game.gameId}</h3><div className="nexus-stats" role="region" aria-label={t("Statistiques de la partie")} tabIndex={0}><table><thead><tr>{["Joueur", "Champion", "K / D / A", "CS", "Gold", "Dégâts", "Vision"].map(label => <th scope="col" key={label}>{t(label)}</th>)}</tr></thead><tbody>{game.participants.map((player, index) => <tr key={player.riotId || index}><th scope="row">{player.riotId}</th><td>{player.championName || "—"}</td><td>{stat(player.kills)} / {stat(player.deaths)} / {stat(player.assists)}</td><td>{typeof player.totalMinionsKilled === "number" && typeof player.neutralMinionsKilled === "number" ? player.totalMinionsKilled + player.neutralMinionsKilled : "—"}</td><td>{stat(player.goldEarned)}</td><td>{stat(player.totalDamageDealtToChampions)}</td><td>{stat(player.visionScore)}</td></tr>)}</tbody></table></div></Surface>)}</section>}
      </>}
    </main><footer className="nexus-footer"><span>{t("Nexus Rising est une ligue amateur indépendante, non affiliée à Riot Games.")}</span><a href="/confidentialite">{t("Confidentialité")}</a><a href="/contact">{t("Contact")}</a></footer>
  </div>;
}
