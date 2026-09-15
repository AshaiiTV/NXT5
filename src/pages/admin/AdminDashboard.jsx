import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BarChart3, ChevronLeft, ChevronRight, Loader2, Mail, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { useAdminQuery } from "../../hooks/useAdminQuery.js";
import { Badge, Button, PageHeader, SkeletonRows, Surface } from "../../components/ui/Core.jsx";
import { importStatus, rate, selectTeams } from "./admin-metrics.js";
import "./admin-dashboard.css";

const number = new Intl.NumberFormat("fr-FR");
const n = (value) => number.format(Number(value || 0));
const VIEWS = {
  overview: { title: "Vue d’ensemble", subtitle: "Les chiffres essentiels et les équipes à explorer pour suivre NXT5." },
  teams: { title: "Équipes", subtitle: "Retrouve une équipe, ses imports et l’état de sa configuration." },
  usage: { title: "Usage du produit", subtitle: "Mesure l’adoption des fonctions, la configuration des comptes et la qualité des imports." },
  reminders: { title: "Rappels e-mail", subtitle: "Consulte les envois enregistrés et les retours des comptes inactifs." },
};
const FILTERS = [["all", "Toutes"], ["recent", "Import récent"], ["quiet", "Sans import depuis 30 j"], ["never", "Aucun import"], ["empty", "Sans roster"]];
const FEATURES = [["matches", "Import de matchs"], ["roster", "Roster"], ["reports", "Reviews"], ["planning", "Planning"], ["compositions", "Compositions"], ["championPool", "Champion pool"], ["goals", "Objectifs joueurs"], ["archives", "Archives"]];

function date(value, time = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", ...(time ? { timeStyle: "short" } : {}) }).format(new Date(value));
}

function Section({ title, description, children, action }) {
  return <Surface className="admin-section"><div className="admin-section-heading"><div><h3>{title}</h3>{description && <p>{description}</p>}</div>{action}</div>{children}</Surface>;
}

function Metric({ label, value, note }) {
  return <div className="admin-metric"><p>{label}</p><strong>{n(value)}</strong><span>{note}</span></div>;
}

function Message({ children, error = false }) {
  return <div className={error ? "admin-message admin-error" : "admin-message"} role={error ? "alert" : "status"}>{children}</div>;
}

function Pagination({ page, setPage, total, size = 10, label }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return <div className="admin-pagination"><span>{total ? `${(page - 1) * size + 1}–${Math.min(page * size, total)} sur ${n(total)}` : "0 résultat"}</span><div><Button variant="ghost" icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label={`Page précédente : ${label}`} /><span>Page {page} / {pages}</span><Button variant="ghost" icon={ChevronRight} disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label={`Page suivante : ${label}`} /></div></div>;
}

function SearchField({ value, onChange, label, placeholder }) {
  return <label className="admin-search"><span className="sr-only">{label}</span><Search size={17} aria-hidden="true" /><input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

export function ImportChart({ rows = [], field = "matches", label = "matchs importés" }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const selected = rows.find((row) => row.date === selectedDate) || rows.at(-1);
  const max = Math.max(1, ...rows.map((row) => Number(row[field] || 0)));
  if (!rows.length) return <Message>Aucune donnée disponible pour cette période.</Message>;
  return <div className="admin-chart">
    <div className="admin-chart-readout" aria-live="polite" aria-atomic="true"><span>{date(selected.date)}</span><strong>{n(selected[field])} {label}</strong></div>
    <div className="admin-chart-scale"><span>{n(max)}</span><span>Échelle : {label} / jour</span></div>
    <div className="admin-chart-bars" role="group" aria-label={`${label} par jour`}>
      {rows.map((row) => <button key={row.date} type="button" aria-pressed={row.date === selected.date} aria-label={`${date(row.date)} : ${n(row[field])} ${label}`} onMouseEnter={() => setSelectedDate(row.date)} onFocus={() => setSelectedDate(row.date)} onClick={() => setSelectedDate(row.date)}><span style={{ height: `${Number(row[field] || 0) / max * 100}%` }} /></button>)}
    </div>
    <div className="admin-chart-axis"><span>{date(rows[0].date)}</span><span>{date(rows.at(-1).date)}</span></div>
    <p className="admin-caption">Survole, touche ou sélectionne une journée au clavier. Les jours à zéro restent à zéro.</p>
  </div>;
}

function Coverage({ label, value, total, unit = "équipes" }) {
  const width = Number(total) > 0 ? Math.min(100, Number(value || 0) / Number(total) * 100) : 0;
  return <div className="admin-coverage"><div><span>{label}</span><strong>{n(value)} / {n(total)} <span>{unit} · {rate(value, total)}</span></strong></div><div className="admin-progress" aria-hidden="true"><span style={{ width: `${width}%` }} /></div></div>;
}

function TeamDetail({ teamId, revision, onBack }) {
  const { data: detail, loading, error, refresh } = useAdminQuery(`admin-dashboard?view=team&teamId=${encodeURIComponent(teamId)}`);
  const heading = useRef(null);
  const previousRevision = useRef(revision);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    if (previousRevision.current !== revision) void refresh().catch(() => {});
    previousRevision.current = revision;
  }, [revision, refresh]);
  const totals = detail?.totals || {};
  const matches = detail?.matches || {};
  return <div className="admin-stack"><div><Button variant="ghost" icon={ArrowLeft} onClick={onBack}>Retour aux équipes</Button></div>
    <h2 ref={heading} tabIndex={-1} className="admin-detail-title">{detail?.team?.name || "Fiche équipe"}{detail?.team?.tag && <span> [{detail.team.tag}]</span>}</h2>
    {error && <Message error>{error}{detail && " Les données affichées sont celles de la dernière actualisation réussie."} <Button variant="ghost" disabled={loading} onClick={() => { void refresh().catch(() => {}); }}>Réessayer</Button></Message>}
    {!detail ? loading && <SkeletonRows count={3} /> : <>
      <p className="admin-caption">{detail.team.region || "Région non renseignée"} · Créée le {date(detail.team.createdAt)} · Dernier import : {date(detail.team.lastMatchAt)}</p>
      <div className="admin-metrics"><Metric label="Matchs importés · 30 j" value={matches.last30d} note={`${n(matches.last7d)} sur les 7 derniers jours`} /><Metric label="Matchs enregistrés" value={totals.matches} note="Depuis la création de l’équipe" /><Metric label="Comptes membres" value={totals.members} note="Comptes ayant accès à cette équipe" /><Metric label="Profils dans le roster" value={totals.players} note="Joueurs et staff, liés ou non à un compte" /></div>
      <Section title="Imports de l’équipe" description="30 derniers jours · date d’ajout sur NXT5, pas date de la partie."><ImportChart rows={detail.daily} /></Section>
      <div className="admin-columns">
        <Section title="Configuration et données" description="Des éléments vérifiables pour comprendre l’état de l’équipe.">
          <Coverage label="Rôles titulaires couverts" value={totals.mainRolesCovered} total={5} unit="rôles" />
          <Coverage label="Profils liés à un compte" value={totals.linkedPlayers} total={totals.players} unit="profils" />
          <Coverage label="Matchs avec un patch" value={matches.withPatch} total={totals.matches} unit="matchs" />
          <Coverage label="Matchs avec une durée" value={matches.withDuration} total={totals.matches} unit="matchs" />
          <p className="admin-caption">Un roster incomplet ou une fonction inutilisée ne signifie pas que l’équipe rencontre un problème.</p>
        </Section>
        <Section title="Fonctions utilisées" description="Volumes enregistrés, sans accès au contenu des équipes."><dl className="admin-facts">{[["Reviews", totals.reports], ["Compositions", totals.compositions], ["Entrées du champion pool", totals.championPoolEntries], ["Objectifs", totals.goals], ["Archives", totals.archives], ["Profils avec disponibilités cette semaine", totals.playersPlannedCurrentWeek]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{n(value)}</dd></div>)}</dl></Section>
      </div>
    </>}
  </div>;
}

function TeamDirectory({ dashboard, initialFilter = "all", revision }) {
  const [filter, setFilter] = useState(initialFilter);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("latest");
  const [page, setPage] = useState(1);
  const directory = dashboard.teamDirectory || [];
  const teams = selectTeams(directory, { search, filter, sort, referenceDate: dashboard.generatedAt });
  const safePage = Math.min(page, Math.max(1, Math.ceil(teams.length / 10)));
  const title = useRef(null);
  const returnFocus = useRef(false);
  useEffect(() => { setFilter(initialFilter); setSelectedTeamId(""); }, [initialFilter]);
  useEffect(() => { setPage(1); }, [search, filter, sort]);
  useEffect(() => { if (!selectedTeamId && returnFocus.current) { title.current?.focus(); returnFocus.current = false; } }, [selectedTeamId]);
  if (selectedTeamId) return <TeamDetail teamId={selectedTeamId} revision={revision} onBack={() => { returnFocus.current = true; setSelectedTeamId(""); }} />;
  return <Section title={<span tabIndex={-1} ref={title}>Comprendre chaque équipe</span>} description="Repère les équipes qui importent, celles qui n’ont pas commencé et celles dont les imports se sont arrêtés.">
    <div className="admin-toolbar"><SearchField label="Rechercher une équipe" placeholder="Nom, tag ou région…" value={search} onChange={setSearch} /><label className="admin-select">Trier par<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="latest">Dernier import</option><option value="volume">Volume total de matchs</option><option value="name">Nom de l’équipe</option></select></label></div>
    <div className="admin-filters" role="group" aria-label="Filtrer les équipes">{FILTERS.map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>
    <p className="admin-caption">« Import récent » = au moins un match ajouté sur les 30 derniers jours. Ce n’est pas une mesure des connexions ni de toute l’activité de l’équipe.</p>
    {directory.length < Number(dashboard.totals?.teams) && <Message>La recherche et les filtres portent sur les {n(directory.length)} équipes les plus récemment créées ou ayant importé, sur {n(dashboard.totals.teams)} au total.</Message>}
    <div className="admin-team-list">{teams.slice((safePage - 1) * 10, safePage * 10).map((team) => {
      const status = importStatus(team, dashboard.generatedAt);
      return <button key={team.id} type="button" className="admin-team-row" onClick={() => setSelectedTeamId(team.id)} aria-label={`Voir les données de ${team.name}`}><div className="admin-team-identity"><strong>{team.name}</strong><span>{team.tag || "Sans tag"} · {team.region || "Région non renseignée"}</span></div><div><Badge tone={status.tone}>{status.label}</Badge><small>Dernier import : {date(team.lastActivityAt)}</small></div><div className="admin-team-volume"><strong>{n(team.matches)} matchs</strong><small>{n(team.players)} profils</small></div><ChevronRight size={18} aria-hidden="true" /></button>;
    })}</div>
    {!teams.length && <Message>{directory.length ? "Aucune équipe ne correspond à ces critères." : "Aucune équipe créée pour le moment."}{directory.length > 0 && <Button variant="ghost" onClick={() => { setSearch(""); setFilter("all"); }}>Réinitialiser les filtres</Button>}</Message>}
    <Pagination page={safePage} setPage={setPage} total={teams.length} label="équipes" />
  </Section>;
}

function Overview({ dashboard, openTeams, openTab }) {
  const [field, setField] = useState("matches");
  const [period, setPeriod] = useState(30);
  const totals = dashboard.totals || {};
  const recentTeams = Number(dashboard.activity?.activeTeams30d || 0);
  const importedTeams = Number(dashboard.adoption?.matches || 0);
  const quietTeams = Math.max(0, importedTeams - recentTeams);
  const noImports = Math.max(0, Number(totals.teams || 0) - importedTeams);
  const growth = dashboard.growth?.days30 || {};
  const rows = (dashboard.daily || []).slice(-period);
  const chartLabel = { matches: "matchs importés", teams: "équipes créées", users: "comptes créés" }[field];
  return <div className="admin-stack">
    <div className="admin-metrics"><Metric label="Équipes avec imports · 30 j" value={recentTeams} note={`${n(totals.teams)} équipes au total · ${rate(recentTeams, totals.teams)}`} /><Metric label="Matchs importés · 30 j" value={growth.matches} note={`${n(dashboard.growth?.days7?.matches)} sur les 7 derniers jours`} /><Metric label="Nouveaux comptes · 30 j" value={growth.users} note={`${n(totals.users)} comptes au total`} /><Metric label="Nouvelles équipes · 30 j" value={growth.teams} note={`${n(dashboard.growth?.days7?.teams)} sur les 7 derniers jours`} /></div>
    <Section title="Où regarder en priorité" description="Des groupes à explorer pour comprendre l’adoption. Aucun message n’est envoyé depuis cette vue."><div className="admin-priorities">{[["never", noImports, "N’ont jamais importé", "Comprendre le démarrage des équipes"], ["quiet", quietTeams, "N’ont plus importé depuis 30 j", "Consulter les derniers imports"], ["empty", dashboard.attention?.teamsWithoutPlayers, "N’ont pas de roster", "Voir les équipes à configurer"]].map(([id, value, label, description]) => <button key={id} type="button" onClick={() => openTeams(id)}><strong>{n(value)}</strong><div><b>{label}</b><span>{description}</span></div><ArrowRight size={18} aria-hidden="true" /></button>)}</div></Section>
    <div className="admin-columns admin-overview-columns"><Section title="Évolution des créations et imports" description="Une mesure à la fois, sur des journées calendaires UTC."><div className="admin-toolbar"><div className="admin-filters" role="group" aria-label="Mesure du graphique">{[["matches", "Imports"], ["teams", "Équipes"], ["users", "Comptes"]].map(([id, label]) => <button key={id} type="button" aria-pressed={field === id} onClick={() => setField(id)}>{label}</button>)}</div><label className="admin-select"><span className="sr-only">Période du graphique</span><select value={period} onChange={(event) => setPeriod(Number(event.target.value))}><option value={7}>7 jours</option><option value={30}>30 jours</option></select></label></div><p className="admin-chart-total"><strong>{n(rows.reduce((sum, row) => sum + Number(row[field] || 0), 0))}</strong> {chartLabel} sur la période</p><ImportChart key={`${field}-${period}`} rows={rows} field={field} label={chartLabel} /></Section>
      <Section title="Repères de suivi" description="Les chiffres à relier à l’usage du produit."><dl className="admin-facts"><div><dt>Comptes vérifiés</dt><dd>{n(dashboard.accountFunnel?.verified)} / {n(totals.users)}</dd></div><div><dt>Comptes membres d’une équipe</dt><dd>{n(dashboard.accountFunnel?.usersInTeam)} / {n(totals.users)}</dd></div><div><dt>Équipes ayant enregistré une review</dt><dd>{n(dashboard.adoption?.reports)} / {n(totals.teams)}</dd></div><div><dt>Rappels éligibles à l’envoi</dt><dd>{n(dashboard.inactivityReminders?.awaitingDelivery)}</dd></div></dl><div className="admin-stack admin-shortcuts"><Button variant="ghost" icon={BarChart3} onClick={() => openTab("usage")}>Examiner l’usage des fonctions</Button><Button variant="ghost" icon={Mail} onClick={() => openTab("reminders")}>Voir les destinataires des rappels</Button></div></Section></div>
  </div>;
}

function Usage({ dashboard }) {
  const totals = dashboard.totals || {};
  const health = dashboard.matchHealth || {};
  return <div className="admin-stack"><div className="admin-columns"><Section title="Quelles fonctions sont adoptées ?" description="Équipes avec au moins une donnée enregistrée dans chaque fonction, depuis leur création. Cela ne mesure pas leur fréquence d’utilisation.">{FEATURES.map(([key, label]) => <Coverage key={key} label={label} value={dashboard.adoption?.[key]} total={totals.teams} />)}</Section><Section title="Les comptes rejoignent-ils une équipe ?" description="États actuels des comptes. Ces catégories peuvent se recouper ; ce n’est pas un parcours chronologique."><Coverage label="Adresse e-mail vérifiée" value={dashboard.accountFunnel?.verified} total={totals.users} unit="comptes" /><Coverage label="Membre d’au moins une équipe" value={dashboard.accountFunnel?.usersInTeam} total={totals.users} unit="comptes" /><Coverage label="Lié à un profil du roster" value={dashboard.accountFunnel?.usersLinkedToPlayer} total={totals.users} unit="comptes" /><p className="admin-caption">Un compte staff peut utiliser NXT5 sans être lié à un profil joueur.</p></Section></div><Section title="Les imports sont-ils exploitables ?" description="Complétude des matchs enregistrés. Ces contrôles ne garantissent pas l’exactitude de toutes les statistiques."><div className="admin-columns"><Coverage label="Patch renseigné" value={health.matchesWithPatch} total={totals.matches} unit="matchs" /><Coverage label="Durée renseignée et positive" value={health.matchesWithDuration} total={totals.matches} unit="matchs" /></div><p className="admin-caption">{n(health.imports24h)} imports sur les dernières 24 h · {n(totals.matches)} matchs enregistrés au total.</p></Section></div>;
}

function Reminders({ data = {} }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search, filter]);
  const recent = data.recent || [];
  const rows = recent.filter((row) => `${row.name || ""} ${row.accountName || ""} ${row.recipientEmail || ""}`.toLocaleLowerCase("fr").includes(search.trim().toLocaleLowerCase("fr")) && (filter === "all" || (filter === "returned" ? row.returnedAfterReminder : !row.returnedAfterReminder)));
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / 10)));
  return <div className="admin-stack"><div className="admin-metrics"><Metric label="Envois · 30 j" value={data.deliveries30d} note="Envois enregistrés sur 30 jours" /><Metric label="Comptes destinataires" value={data.recipients} note="Comptes distincts dans le journal" /><Metric label="Éligibles à l’envoi" value={data.awaitingDelivery} note="90 j d’inactivité, e-mail vérifié, rappel activé" /><Metric label="Envois conservés" value={data.deliveries} note="Journal conservé pendant 12 mois" /></div><Section title="À qui les rappels ont-ils été envoyés ?" description="Un rappel par période de 90 jours d’inactivité. Les adresses ci-dessous sont réservées à l’administrateur plateforme."><div className="admin-toolbar"><SearchField label="Rechercher un destinataire" placeholder="Nom, compte ou adresse e-mail…" value={search} onChange={setSearch} /><label className="admin-select">Retour sur NXT5<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Tous les destinataires</option><option value="returned">Revenus depuis l’envoi</option><option value="waiting">Pas de retour enregistré</option></select></label></div>
      <p className="admin-caption">{n(recent.length)} derniers envois disponibles sur {n(data.deliveries)} conservés. La recherche porte sur cette liste. Un envoi enregistré ne confirme ni la livraison dans la boîte mail, ni sa lecture.</p>
      {rows.length ? <div className="admin-table-scroll" role="region" aria-label="Journal des destinataires" tabIndex={0}><table className="admin-table"><thead><tr>{["Destinataire", "Inactif depuis", "Envoi enregistré", "Retour sur NXT5"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.slice((safePage - 1) * 10, safePage * 10).map((row) => <tr key={row.id}><td><strong>{row.name || row.accountName || "Compte"}</strong><span className="admin-email">{row.recipientEmail}</span></td><td>{date(row.inactiveSinceAt)}</td><td>{date(row.sentAt, true)}</td><td><Badge tone={row.returnedAfterReminder ? "green" : "slate"}>{row.returnedAfterReminder ? "Revenu depuis l’envoi" : "Pas de retour enregistré"}</Badge></td></tr>)}</tbody></table></div> : <Message>{recent.length ? "Aucun destinataire ne correspond à ces critères." : "Aucun rappel n’a encore été enregistré."}</Message>}
      <Pagination page={safePage} setPage={setPage} total={rows.length} label="rappels" /><p className="admin-caption">Le retour est déduit d’une activité du compte après l’envoi ; il ne prouve pas que le rappel a provoqué ce retour.</p>
    </Section></div>;
}

export default function AdminDashboard({ view = "overview", teamFilter = "all", onNavigate }) {
  const activeView = Object.hasOwn(VIEWS, view) ? view : "overview";
  const { data: dashboard, loading, error, refresh, invalidate } = useAdminQuery(`admin-dashboard?view=${activeView}`);
  const [revision, setRevision] = useState(0);
  const load = () => {
    if (activeView === "teams") {
      invalidate("admin-dashboard?view=team&");
      setRevision(value => value + 1);
    }
    void refresh().catch(() => {});
  };
  const { title, subtitle } = VIEWS[activeView];
  const openTeams = (filter) => onNavigate?.(`/admin/equipes?filtre=${encodeURIComponent(filter)}`);
  const openTab = (target) => onNavigate?.(target === "reminders" ? "/admin/rappels" : "/admin/usage");
  return <div className="nxt5-data-dense admin-dashboard">
    <PageHeader eyebrow={activeView === "reminders" ? "Configuration" : "Pilotage"} title={title} subtitle={subtitle}><Button variant="ghost" icon={loading ? Loader2 : RefreshCw} disabled={loading} onClick={load}>{loading ? "Actualisation…" : "Actualiser"}</Button></PageHeader>
    <div className="admin-status"><span><ShieldCheck size={15} /> Accès administrateur · lecture seule</span><span>{dashboard ? `Actualisé le ${date(dashboard.generatedAt, true)}` : "Chargement des données…"}</span></div>
    {error && <Message error>{error}{dashboard && " Les données affichées sont celles de la dernière actualisation réussie."}<Button variant="ghost" disabled={loading} onClick={load}>Réessayer</Button></Message>}
    {!dashboard ? loading && <SkeletonRows count={4} /> : <>
      {activeView === "overview" && <Overview dashboard={dashboard} openTeams={openTeams} openTab={openTab} />}
      {activeView === "teams" && <TeamDirectory dashboard={dashboard} initialFilter={teamFilter} revision={revision} />}
      {activeView === "usage" && <Usage dashboard={dashboard} />}
      {activeView === "reminders" && <Reminders data={dashboard.inactivityReminders} />}
    </>}
  </div>;
}
