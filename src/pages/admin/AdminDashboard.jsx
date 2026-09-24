import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BarChart3, ChevronLeft, ChevronRight, Loader2, Mail, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { Badge, Button, PageHeader, SelectInput, SkeletonRows, Surface, TextInput } from "../../components/ui/Core.jsx";
import { importStatus, rate, selectTeams } from "./admin-metrics.js";
import "./admin-dashboard.css";

const number = new Intl.NumberFormat("fr-FR");
const n = (value) => number.format(Number(value || 0));
const VIEWS = {
  overview: { title: "Vue d’ensemble", subtitle: "Repère les équipes qui démarrent, celles qui importent et celles à accompagner." },
  teams: { title: "Équipes", subtitle: "Retrouve une équipe, ses imports et l’état de sa configuration." },
  usage: { title: "Usage du produit", subtitle: "Vois quelles fonctions les équipes utilisent et quelles informations restent à compléter." },
  reminders: { title: "Rappels e-mail", subtitle: "Consulte les envois enregistrés et les retours des comptes inactifs." },
};
const FILTERS = [["all", "Toutes"], ["recent", "Import récent"], ["quiet", "Sans import depuis 30 j"], ["never", "Aucun import"], ["empty", "Sans profils"]];
const FEATURES = [["matches", "Import de parties"], ["roster", "Joueurs et encadrement"], ["reports", "Débriefs"], ["planning", "Planning"], ["compositions", "Compositions"], ["championPool", "Champions déclarés"], ["goals", "Objectifs joueurs"], ["archives", "Archives"]];

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
  return <div className="admin-search-field"><TextInput label={label} icon={Search} type="search" value={value} onChange={onChange} placeholder={placeholder} /></div>;
}

export function ImportChart({ rows = [], field = "matches", label = "parties importées" }) {
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
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    let current = true;
    setDetail(null); setError("");
    apiFetch(`admin-dashboard?view=team&teamId=${encodeURIComponent(teamId)}`, { timeoutMs: 20000 })
      .then((result) => { if (current) setDetail(result); })
      .catch((err) => { if (current) setError(err.message || "Impossible de charger cette équipe."); });
    return () => { current = false; };
  }, [teamId, revision, retry]);
  const totals = detail?.totals || {};
  const matches = detail?.matches || {};
  return <div className="admin-stack"><div><Button variant="ghost" icon={ArrowLeft} onClick={onBack}>Retour aux équipes</Button></div>
    <h2 ref={heading} tabIndex={-1} className="admin-detail-title">{detail?.team?.name || "Fiche équipe"}{detail?.team?.tag && <span> [{detail.team.tag}]</span>}</h2>
    {error ? <Message error>{error} <Button variant="ghost" onClick={() => setRetry((value) => value + 1)}>Réessayer</Button></Message> : !detail ? <SkeletonRows count={3} /> : <>
      <p className="admin-caption">{detail.team.region || "Région non renseignée"} · Créée le {date(detail.team.createdAt)} · Dernier import : {date(detail.team.lastMatchAt)}</p>
      <div className="admin-metrics"><Metric label="Parties importées · 30 j" value={matches.last30d} note={`${n(matches.last7d)} sur les 7 derniers jours`} /><Metric label="Parties enregistrées" value={totals.matches} note="Depuis la création de l’équipe" /><Metric label="Comptes membres" value={totals.members} note="Comptes ayant accès à cette équipe" /><Metric label="Joueurs et encadrement" value={totals.players} note="Joueurs et staff, liés ou non à un compte" /></div>
      <Section title="Imports de l’équipe" description="30 derniers jours · date d’ajout sur NXT5, pas date de la partie."><ImportChart rows={detail.daily} /></Section>
      <div className="admin-columns">
        <Section title="Configuration et données" description="Des éléments vérifiables pour comprendre l’état de l’équipe.">
          <Coverage label="Rôles titulaires couverts" value={totals.mainRolesCovered} total={5} unit="rôles" />
          <Coverage label="Profils liés à un compte" value={totals.linkedPlayers} total={totals.players} unit="profils" />
          <Coverage label="Parties avec une version du jeu" value={matches.withPatch} total={totals.matches} unit="parties" />
          <Coverage label="Parties avec une durée" value={matches.withDuration} total={totals.matches} unit="parties" />
          <p className="admin-caption">Un effectif incomplet ou une fonction inutilisée ne signifie pas que l’équipe rencontre un problème.</p>
        </Section>
        <Section title="Fonctions utilisées" description="Volumes enregistrés, sans accès au contenu des équipes."><dl className="admin-facts">{[["Débriefs", totals.reports], ["Compositions", totals.compositions], ["Champions déclarés", totals.championPoolEntries], ["Objectifs", totals.goals], ["Archives", totals.archives], ["Profils avec disponibilités cette semaine", totals.playersPlannedCurrentWeek]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{n(value)}</dd></div>)}</dl></Section>
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
    <div className="admin-toolbar"><SearchField label="Rechercher une équipe" placeholder="Nom, tag ou région…" value={search} onChange={setSearch} /><SelectInput label="Trier par" value={sort} onChange={setSort}><option value="latest">Dernier import</option><option value="volume">Nombre total de parties</option><option value="name">Nom de l’équipe</option></SelectInput></div>
    <div className="admin-filters" role="group" aria-label="Filtrer les équipes">{FILTERS.map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>
    <p className="admin-caption">« Import récent » = au moins une partie ajoutée sur les 30 derniers jours. Ce n’est pas une mesure des connexions ni de toute l’activité de l’équipe.</p>
    {directory.length < Number(dashboard.totals?.teams) && <Message>La recherche et les filtres portent sur les {n(directory.length)} équipes les plus récemment créées ou ayant importé, sur {n(dashboard.totals.teams)} au total.</Message>}
    <p className="admin-result-count" role="status">{n(teams.length)} équipe{teams.length > 1 ? "s" : ""}{search || filter !== "all" ? " correspondant aux filtres" : " dans le répertoire"}</p><div className="admin-team-list">{teams.slice((safePage - 1) * 10, safePage * 10).map((team) => {
      const status = importStatus(team, dashboard.generatedAt);
      return <button key={team.id} type="button" className="admin-team-row" onClick={() => setSelectedTeamId(team.id)} aria-label={`Voir les données de ${team.name}`}><div className="admin-team-identity"><strong>{team.name}</strong><span>{team.tag || "Sans tag"} · {team.region || "Région non renseignée"}</span></div><div><Badge tone={status.tone}>{status.label}</Badge><small>Dernier import : {date(team.lastActivityAt)}</small></div><div className="admin-team-volume"><strong>{n(team.matches)} parties</strong><small>{n(team.players)} profils</small></div><ChevronRight size={18} aria-hidden="true" /></button>;
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
  const chartLabel = { matches: "parties importées", teams: "équipes créées", users: "comptes créés" }[field];
  return <div className="admin-stack">
    <div className="admin-metrics"><Metric label="Équipes avec imports · 30 j" value={recentTeams} note={`${n(totals.teams)} équipes au total · ${rate(recentTeams, totals.teams)}`} /><Metric label="Parties importées · 30 j" value={growth.matches} note={`${n(dashboard.growth?.days7?.matches)} sur les 7 derniers jours`} /><Metric label="Nouveaux comptes · 30 j" value={growth.users} note={`${n(totals.users)} comptes au total`} /><Metric label="Nouvelles équipes · 30 j" value={growth.teams} note={`${n(dashboard.growth?.days7?.teams)} sur les 7 derniers jours`} /></div>
    <Section title="Où regarder en priorité" description="Des groupes à explorer pour comprendre l’adoption. Aucun message n’est envoyé depuis cette vue."><div className="admin-priorities">{[["never", noImports, "N’ont jamais importé", "Comprendre le démarrage des équipes"], ["quiet", quietTeams, "N’ont plus importé depuis 30 j", "Consulter les derniers imports"], ["empty", dashboard.attention?.teamsWithoutPlayers, "N’ont encore aucun profil", "Voir les équipes à configurer"]].map(([id, value, label, description]) => <button key={id} type="button" onClick={() => openTeams(id)}><strong>{n(value)}</strong><div><b>{label}</b><span>{description}</span></div><ArrowRight size={18} aria-hidden="true" /></button>)}</div></Section>
    <div className="admin-columns admin-overview-columns"><Section title="Évolution des créations et imports" description="Choisis une mesure, puis une journée pour en lire la valeur. Les jours suivent le fuseau UTC."><div className="admin-toolbar"><div className="admin-filters" role="group" aria-label="Mesure du graphique">{[["matches", "Imports"], ["teams", "Équipes"], ["users", "Comptes"]].map(([id, label]) => <button key={id} type="button" aria-pressed={field === id} onClick={() => setField(id)}>{label}</button>)}</div><SelectInput label="Période du graphique" value={period} onChange={(value) => setPeriod(Number(value))}><option value={7}>7 jours</option><option value={30}>30 jours</option></SelectInput></div><p className="admin-chart-total"><strong>{n(rows.reduce((sum, row) => sum + Number(row[field] || 0), 0))}</strong> {chartLabel} sur la période</p><ImportChart key={`${field}-${period}`} rows={rows} field={field} label={chartLabel} /></Section>
      <Section title="Repères de suivi" description="Les chiffres à relier à l’usage du produit."><dl className="admin-facts"><div><dt>Comptes vérifiés</dt><dd>{n(dashboard.accountFunnel?.verified)} / {n(totals.users)}</dd></div><div><dt>Comptes membres d’une équipe</dt><dd>{n(dashboard.accountFunnel?.usersInTeam)} / {n(totals.users)}</dd></div><div><dt>Équipes ayant enregistré un débrief</dt><dd>{n(dashboard.adoption?.reports)} / {n(totals.teams)}</dd></div><div><dt>Rappels éligibles à l’envoi</dt><dd>{n(dashboard.inactivityReminders?.awaitingDelivery)}</dd></div></dl><div className="admin-stack admin-shortcuts"><Button variant="ghost" icon={BarChart3} onClick={() => openTab("usage")}>Examiner l’usage des fonctions</Button><Button variant="ghost" icon={Mail} onClick={() => openTab("reminders")}>Voir les destinataires des rappels</Button></div></Section></div>
  </div>;
}

function Usage({ dashboard }) {
  const totals = dashboard.totals || {};
  const health = dashboard.matchHealth || {};
  return <div className="admin-stack"><div className="admin-columns"><Section title="Quelles fonctions sont adoptées ?" description="Équipes avec au moins une donnée enregistrée dans chaque fonction, depuis leur création. Cela ne mesure pas leur fréquence d’utilisation.">{FEATURES.map(([key, label]) => <Coverage key={key} label={label} value={dashboard.adoption?.[key]} total={totals.teams} />)}</Section><Section title="Les comptes rejoignent-ils une équipe ?" description="États actuels des comptes. Ces catégories peuvent se recouper ; ce n’est pas un parcours chronologique."><Coverage label="Adresse e-mail vérifiée" value={dashboard.accountFunnel?.verified} total={totals.users} unit="comptes" /><Coverage label="Membre d’au moins une équipe" value={dashboard.accountFunnel?.usersInTeam} total={totals.users} unit="comptes" /><Coverage label="Lié à un profil de l’équipe" value={dashboard.accountFunnel?.usersLinkedToPlayer} total={totals.users} unit="comptes" /><p className="admin-caption">Un compte staff peut utiliser NXT5 sans être lié à un profil joueur.</p></Section></div><Section title="Les imports sont-ils exploitables ?" description="Vérifie si les informations de base sont présentes. Cela ne garantit pas l’exactitude de toutes les statistiques."><div className="admin-columns"><Coverage label="Version du jeu renseignée" value={health.matchesWithPatch} total={totals.matches} unit="parties" /><Coverage label="Durée renseignée et positive" value={health.matchesWithDuration} total={totals.matches} unit="parties" /></div><p className="admin-caption">{n(health.imports24h)} imports sur les dernières 24 h · {n(totals.matches)} parties enregistrées au total.</p></Section></div>;
}

function Reminders({ data = {} }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search, filter]);
  const recent = data.recent || [];
  const rows = recent.filter((row) => `${row.name || ""} ${row.accountName || ""} ${row.recipientEmail || ""}`.toLocaleLowerCase("fr").includes(search.trim().toLocaleLowerCase("fr")) && (filter === "all" || (filter === "returned" ? row.returnedAfterReminder : !row.returnedAfterReminder)));
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / 10)));
  return <div className="admin-stack"><div className="admin-metrics"><Metric label="Envois · 30 j" value={data.deliveries30d} note="Envois enregistrés sur 30 jours" /><Metric label="Comptes destinataires" value={data.recipients} note="Comptes distincts dans le journal" /><Metric label="Éligibles à l’envoi" value={data.awaitingDelivery} note="90 j d’inactivité, e-mail vérifié, rappel activé" /><Metric label="Envois conservés" value={data.deliveries} note="Journal conservé pendant 12 mois" /></div><Section title="À qui les rappels ont-ils été envoyés ?" description="Un rappel par période de 90 jours d’inactivité. Les adresses ci-dessous sont réservées à l’administrateur plateforme."><div className="admin-toolbar"><SearchField label="Rechercher un destinataire" placeholder="Nom, compte ou adresse e-mail…" value={search} onChange={setSearch} /><SelectInput label="Retour sur NXT5" value={filter} onChange={setFilter}><option value="all">Tous les destinataires</option><option value="returned">Revenus depuis l’envoi</option><option value="waiting">Pas de retour enregistré</option></SelectInput></div>
      <p className="admin-caption">{n(recent.length)} derniers envois disponibles sur {n(data.deliveries)} conservés. La recherche porte sur cette liste. Un envoi enregistré ne confirme ni la livraison dans la boîte mail, ni sa lecture.</p>
      {rows.length ? <div className="admin-table-scroll nxt5-responsive-scroll" role="region" aria-label="Journal des destinataires" tabIndex={0}><table className="admin-table"><thead><tr>{["Destinataire", "Inactif depuis", "Envoi enregistré", "Retour sur NXT5"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.slice((safePage - 1) * 10, safePage * 10).map((row) => <tr key={row.id}><td><strong>{row.name || row.accountName || "Compte"}</strong><span className="admin-email">{row.recipientEmail}</span></td><td>{date(row.inactiveSinceAt)}</td><td>{date(row.sentAt, true)}</td><td><Badge tone={row.returnedAfterReminder ? "green" : "slate"}>{row.returnedAfterReminder ? "Revenu depuis l’envoi" : "Pas de retour enregistré"}</Badge></td></tr>)}</tbody></table></div> : <Message>{recent.length ? "Aucun destinataire ne correspond à ces critères." : "Aucun rappel n’a encore été enregistré."}{recent.length > 0 && <Button variant="ghost" onClick={() => { setSearch(""); setFilter("all"); }}>Réinitialiser les filtres</Button>}</Message>}
      <Pagination page={safePage} setPage={setPage} total={rows.length} label="rappels" /><p className="admin-caption">Le retour est déduit d’une activité du compte après l’envoi ; il ne prouve pas que le rappel a provoqué ce retour.</p>
    </Section></div>;
}

export default function AdminDashboard({ view = "overview", teamFilter = "all", onNavigate }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const request = useRef(0);
  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true); setError("");
    try {
      const result = await apiFetch("admin-dashboard", { timeoutMs: 20000 });
      if (id === request.current) { setDashboard(result); setRevision((value) => value + 1); }
    } catch (err) { if (id === request.current) setError(err.message || "Impossible de charger le dashboard."); }
    finally { if (id === request.current) setLoading(false); }
  }, []);
  useEffect(() => { load(); return () => { request.current += 1; }; }, [load]);
  const activeView = Object.hasOwn(VIEWS, view) ? view : "overview";
  const { title, subtitle } = VIEWS[activeView];
  const openTeams = (filter) => onNavigate?.(`/admin/equipes?filtre=${encodeURIComponent(filter)}`);
  const openTab = (target) => onNavigate?.(target === "reminders" ? "/admin/rappels" : "/admin/usage");
  return <div className="nxt5-data-dense admin-dashboard">
    <PageHeader eyebrow={activeView === "reminders" ? "Configuration" : "Pilotage"} title={title} subtitle={subtitle}><Button variant="ghost" icon={loading ? Loader2 : RefreshCw} disabled={loading} onClick={load}>{loading ? "Actualisation…" : "Actualiser"}</Button></PageHeader>
    <div className="admin-status"><span><ShieldCheck size={15} aria-hidden="true" /> Accès administrateur · lecture seule</span><span>{dashboard ? `Actualisé le ${date(dashboard.generatedAt, true)}` : error ? "Données indisponibles" : "Chargement des données…"}</span></div>
    {error && <Message error>{error}{dashboard && " Les données affichées sont celles de la dernière actualisation réussie."}<Button variant="ghost" disabled={loading} onClick={load}>Réessayer</Button></Message>}
    {!dashboard ? loading && <SkeletonRows count={4} /> : <>
      {activeView === "overview" && <Overview dashboard={dashboard} openTeams={openTeams} openTab={openTab} />}
      {activeView === "teams" && <TeamDirectory dashboard={dashboard} initialFilter={teamFilter} revision={revision} />}
      {activeView === "usage" && <Usage dashboard={dashboard} />}
      {activeView === "reminders" && <Reminders data={dashboard.inactivityReminders} />}
    </>}
  </div>;
}
