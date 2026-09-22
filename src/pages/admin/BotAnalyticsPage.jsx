import React, { useEffect, useId, useMemo, useState } from "react";
import { Activity, BarChart3, Bot, CheckCheck, ChevronLeft, ChevronRight, Hash, RefreshCw, Search, Server, Terminal } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { Badge, Button, PageHeader, SelectInput, SkeletonRows, Surface, TextInput } from "../../components/ui/Core.jsx";
import "./bot-analytics.css";

const number = value => value == null ? "—" : new Intl.NumberFormat("fr-FR").format(value);
const date = (value, time = false) => value && Number.isFinite(new Date(value).getTime())
  ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", ...(time ? { hour: "2-digit", minute: "2-digit" } : {}), timeZone: "UTC" }).format(new Date(value)) : "—";
const STATES = { succeeded: ["Confirmé", "green"], completed: ["Traitée", "cyan"], failed: ["Échec", "red"], blocked: ["Bloqué", "red"], retry_wait: ["Nouvel essai prévu", "yellow"], uncertain: ["À vérifier", "yellow"], sending: ["Envoi en cours", "cyan"], processing: ["En cours", "cyan"], withdrawn: ["Retiré", "slate"], active: ["Active", "green"], paused: ["En pause", "yellow"], disconnected: ["Déconnectée", "slate"], pending: ["À relier", "slate"] };
function Status({ value }) { const [label, tone] = STATES[value] || ["État inconnu", "slate"]; return <Badge tone={tone}>{label}</Badge>; }
function Section({ title, description, icon: Icon, children }) {
  return <Surface className="bot-section"><div className="bot-section-heading"><h3><Icon size={19} aria-hidden="true" />{title}</h3>{description && <p>{description}</p>}</div>{children}</Surface>;
}

function isReport(data, days) {
  if (!data || typeof data.schemaReady !== "boolean") return false;
  if (!data.schemaReady) return true;
  const metrics = ["publications", "successfulDeliveries", "commands", "guilds", "failedDeliveries", "uncertainDeliveries", "connectionTests", "connections", "activeConnections", "pausedConnections", "channels", "queuedJobs", "blockedJobs"];
  return data.period?.days === days && data.summary && metrics.every(key => Number.isFinite(data.summary[key]))
    && (data.summary.successRate === null || Number.isFinite(data.summary.successRate))
    && Array.isArray(data.coverage?.notes) && Number.isFinite(Date.parse(data.coverage.commandsFrom))
    && ["daily", "commands", "guilds", "recentActivity"].every(key => Array.isArray(data[key]));
}

function useBotReport(days) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ days, data: null, error: "", loading: true });
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setState(previous => ({ days, data: previous.days === days ? previous.data : null, error: "", loading: true }));
    apiFetch(`admin-discord-analytics?days=${days}`, { signal: controller.signal }).then(data => {
      if (!isReport(data, days)) throw new Error("Les statistiques reçues sont incomplètes. Réessaie dans quelques instants.");
      if (current) setState({ days, data, error: "", loading: false });
    }).catch(error => {
      if (current) setState(previous => ({ ...previous, loading: false, data: [401, 403].includes(error.status) ? null : previous.data, error: error.message || "Impossible de charger les statistiques du bot." }));
    });
    return () => { current = false; controller.abort(); };
  }, [days, revision]);
  return { ...(state.days === days ? state : { data: null, error: "", loading: true }), refresh: () => setRevision(value => value + 1) };
}

function Metric({ label, value, note, icon: Icon }) {
  return <div className="bot-metric"><div><span>{label}</span><Icon size={18} aria-hidden="true" /></div><strong>{value}</strong><p>{note}</p></div>;
}

export function BotDailyChart({ rows }) {
  const [chosen, setChosen] = useState(null);
  const chartId = useId();
  const index = Math.max(0, rows.findIndex(row => row.date === chosen));
  const selectedIndex = chosen && rows.some(row => row.date === chosen) ? index : rows.length - 1;
  const selected = rows[selectedIndex];
  const max = Math.max(1, ...rows.map(row => row.successfulDeliveries));
  if (!rows.length) return <p className="bot-empty">Aucune activité quotidienne disponible.</p>;
  return <div className="bot-chart">
    <div className="bot-chart-readout" aria-live="polite"><span>{date(selected.date)}</span><strong>{number(selected.successfulDeliveries)} envois confirmés</strong><span>{number(selected.publications)} publications · {number(selected.failedDeliveries)} tentatives en échec</span></div>
    <div className="bot-chart-scale"><span>Envois confirmés par jour · UTC</span><span>Échelle : 0–{number(max)}</span></div>
    <svg viewBox="0 0 800 170" preserveAspectRatio="none" role="img" aria-labelledby={chartId} className="bot-chart-svg">
      <title id={chartId}>Évolution des envois confirmés. Les valeurs sont disponibles dans le tableau sous le graphique.</title>
      {[0, .5, 1].map(part => <line key={part} x1="0" x2="800" y1={5 + part * 160} y2={5 + part * 160} stroke="#293D52" strokeDasharray="4 5" />)}
      {rows.map((row, i) => <rect key={row.date} x={(i + .15) * 800 / rows.length} y={165 - row.successfulDeliveries / max * 160} width={.7 * 800 / rows.length} height={row.successfulDeliveries / max * 160} fill={i === selectedIndex ? "#a78bfa" : "#67e8f9"} />)}
    </svg>
    <div className="bot-chart-axis"><span>{date(rows[0].date)}</span><span>{date(rows.at(-1).date)}</span></div>
    <label className="bot-chart-slider">Explorer une journée<input type="range" aria-label="Jour du graphique" aria-valuetext={`${date(selected.date)} : ${number(selected.successfulDeliveries)} envois confirmés`} min="0" max={rows.length - 1} step="1" value={selectedIndex} onChange={event => setChosen(rows[Number(event.target.value)].date)} /></label>
    <details className="bot-details"><summary>Voir les données quotidiennes</summary><div className="bot-table-scroll nxt5-responsive-scroll" role="region" aria-label="Données quotidiennes du bot" tabIndex={0}><table className="bot-table"><thead><tr><th scope="col">Date UTC</th><th scope="col">Publications</th><th scope="col">Envois confirmés</th><th scope="col">Tentatives en échec</th><th scope="col">Commandes</th></tr></thead><tbody>{rows.map(row => <tr key={row.date}><th scope="row">{date(row.date)}</th><td>{number(row.publications)}</td><td>{number(row.successfulDeliveries)}</td><td>{number(row.failedDeliveries)}</td><td>{row.commands == null ? "Non conservées" : number(row.commands)}</td></tr>)}</tbody></table></div></details>
  </div>;
}

function Guilds({ rows }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const words = normalize(search).trim().split(/\s+/).filter(Boolean);
    return rows.filter(row => { const text = normalize([row.guildId, row.guildName, ...row.teams.map(team => team.teamName), ...row.destinations.flatMap(channel => [channel.channelId, channel.channelName, ...channel.teamNames])].join(" ")); return words.every(word => text.includes(word)); });
  }, [rows, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const current = Math.min(page, pages);
  return <Section title="Où le bot est utilisé" description="Serveurs reliés à NXT5 ou présents dans l’historique de la période. Ouvre un serveur pour voir ses équipes et salons." icon={Server}>
    <TextInput type="search" label="Rechercher un serveur, une équipe ou un salon" icon={Search} placeholder="Nom d’équipe, salon ou identifiant Discord…" value={search} onChange={value => { setSearch(value); setPage(1); }} />
    <p className="bot-caption" role="status">{number(filtered.length)} serveurs trouvés{search && <button type="button" className="bot-reset" onClick={() => { setSearch(""); setPage(1); }}>Effacer la recherche</button>}</p>
    <div className="bot-guilds">{filtered.slice((current - 1) * 10, current * 10).map(guild => <details key={guild.guildId} className="bot-guild">
      <summary><span className="bot-guild-name"><strong>{guild.guildName || "Serveur Discord"}</strong><span>ID {guild.guildId}</span></span><span className="bot-guild-teams">{guild.teams.map(team => team.teamName).join(" · ") || "Aucune équipe actuellement reliée"}</span><span className="bot-guild-volume"><strong>{number(guild.publications)}</strong> publications</span><ChevronRight size={18} aria-hidden="true" /></summary>
      <div className="bot-guild-body"><dl className="bot-inline-stats"><div><dt>Envois confirmés</dt><dd>{number(guild.successfulDeliveries)}</dd></div><div><dt>Tentatives en échec</dt><dd>{number(guild.failedDeliveries)}</dd></div><div><dt>Commandes · 7 j max.</dt><dd>{number(guild.commands)}</dd></div><div><dt>Dernière activité · UTC</dt><dd>{date(guild.lastActivityAt, true)}</dd></div></dl>
        <h4>Équipes actuellement reliées</h4>{guild.teams.length ? <ul className="bot-team-list">{guild.teams.map(team => <li key={team.teamId}><span>{team.teamName}</span><Status value={team.status} /></li>)}</ul> : <p className="bot-caption">Ce serveur apparaît dans l’historique, sans liaison actuelle.</p>}
        <h4>Salons et utilisation</h4>{guild.destinations.length ? <ul className="bot-destinations">{guild.destinations.map(channel => <li key={channel.channelId}><Hash size={16} aria-hidden="true" /><div><strong>{channel.channelName || `Salon ${channel.channelId}`}</strong><p>{channel.teamNames.join(" · ")}</p><p>{number(channel.publications)} publications · {number(channel.successfulDeliveries)} envois confirmés · {number(channel.failedDeliveries)} tentatives en échec</p><p>ID {channel.channelId} · {channel.currentlyConfigured ? channel.enabled ? "Au moins une règle activée" : "Toutes les règles désactivées" : "Présent dans l’historique uniquement"}{channel.automatic && " · Automatisation selon les équipes"}</p></div></li>)}</ul> : <p className="bot-caption">Aucun salon configuré ni utilisé sur cette période.</p>}
      </div>
    </details>)}</div>
    {!filtered.length && <p className="bot-empty">{search ? "Aucun serveur ne correspond à cette recherche." : "Aucun serveur relié ni usage enregistré sur cette période."}</p>}
    {pages > 1 && <div className="bot-pagination"><span>Page {current} / {pages}</span><div><Button variant="ghost" icon={ChevronLeft} disabled={current === 1} onClick={() => setPage(current - 1)}>Précédent</Button><Button variant="ghost" icon={ChevronRight} disabled={current === pages} onClick={() => setPage(current + 1)}>Suivant</Button></div></div>}
  </Section>;
}

function Commands({ rows, coverage }) {
  const max = Math.max(1, ...rows.map(row => row.count));
  return <Section title="Commandes Discord" icon={Terminal} description={`Depuis le ${date(coverage.commandsFrom, true)} UTC · 7 jours maximum conservés.`}>
    {rows.length ? <ul className="bot-command-list">{rows.map(row => <li key={row.name}><div><strong>/nxt {row.name}</strong><span>{number(row.count)} utilisations</span></div><div className="bot-command-track" aria-hidden="true"><span style={{ width: `${row.count / max * 100}%` }} /></div><p>{number(row.completed)} traitées · {number(row.failed)} en échec · {number(row.processing)} en cours</p></li>)}</ul> : <p className="bot-empty">Aucune commande enregistrée sur la période conservée.</p>}
    <p className="bot-caption">Une commande traitée a été prise en charge par le bot ; elle n’a pas forcément modifié une connexion. La réception de sa réponse dans Discord n’est pas mesurée. Les suggestions de saisie ne sont pas comptées.</p>
  </Section>;
}

export default function BotAnalyticsPage({ route = {}, navigate }) {
  const requested = Number(new URLSearchParams(route.search).get("days"));
  const days = [7, 30, 90].includes(requested) ? requested : 30;
  const { data, loading, error, refresh } = useBotReport(days);
  const ready = data?.schemaReady === true;
  const summary = data?.summary;
  return <div className="bot-analytics" data-admin-view="bot">
    <PageHeader eyebrow="Pilotage · Discord" title="Statistiques du bot" subtitle="Suis l’utilisation de NXT5 sur Discord : serveurs, commandes et publications de games."><Button type="button" variant="ghost" icon={RefreshCw} onClick={refresh} disabled={loading}>{loading ? "Actualisation…" : "Actualiser"}</Button></PageHeader>
    <div className="bot-toolbar"><SelectInput label="Période des publications" value={String(days)} onChange={value => navigate?.(`/admin/bot-discord?days=${value}`)}>{[7, 30, 90].map(value => <option key={value} value={value}>{value} derniers jours</option>)}</SelectInput>{ready && <p>Du {date(data.period.from)} au {date(data.period.to)} · UTC<br />Actualisé le {date(data.generatedAt, true)} UTC</p>}</div>
    {error && <div className="bot-notice bot-notice-error" role="alert"><strong>{data ? "L’actualisation a échoué. Les dernières données restent affichées." : "Statistiques indisponibles."}</strong><p>{error}</p><Button type="button" variant="ghost" onClick={refresh} disabled={loading}>Réessayer</Button></div>}
    {loading && !data && <div role="status" aria-label="Chargement des statistiques du bot"><SkeletonRows count={4} /></div>}
    {data?.schemaReady === false && <Surface><div className="bot-empty"><Bot size={28} aria-hidden="true" /><h3>Le suivi Discord n’est pas encore disponible</h3><p>Le stockage du bot doit être initialisé avant de consulter ses statistiques.</p></div></Surface>}
    {ready && <>
      <Surface className="bot-section"><div className="bot-metrics">
        <Metric label="Publications diffusées" value={number(summary.publications)} icon={Bot} note="Une game par salon, comptée une fois sur la période." />
        <Metric label="Envois confirmés" value={number(summary.successfulDeliveries)} icon={CheckCheck} note="Inclut les mises à jour et les nouvelles tentatives réussies." />
        <Metric label="Commandes reçues" value={number(summary.commands)} icon={Terminal} note="Sur les 7 derniers jours maximum, hors suggestions de saisie." />
        <Metric label="Serveurs reliés" value={number(summary.guilds)} icon={Server} note="Actuellement. Un serveur partagé compte une seule fois." />
      </div></Surface>
      <div className="bot-notice"><Activity size={18} aria-hidden="true" /><p><strong>{summary.successRate == null ? "Aucun taux de réussite disponible" : `${number(summary.successRate)} % de tentatives terminées confirmées`}</strong> · {number(summary.failedDeliveries)} tentatives en échec · {number(summary.uncertainDeliveries)} à vérifier · {number(summary.connectionTests)} tests de connexion séparés des publications.</p></div>
      <Section title="Implantation et suivi actuel" icon={Hash} description="État des liaisons et de la file d’envoi à la dernière actualisation, quelle que soit la période choisie.">
        <dl className="bot-inline-stats bot-current-stats"><div><dt>Équipes reliées</dt><dd>{number(summary.connections)}</dd></div><div><dt>Liaisons actives</dt><dd>{number(summary.activeConnections)}</dd></div><div><dt>Équipes en pause</dt><dd>{number(summary.pausedConnections)}</dd></div><div><dt>Salons configurés</dt><dd>{number(summary.channels)}</dd></div><div><dt>À traiter / en cours</dt><dd>{number(summary.queuedJobs)}</dd></div><div><dt>Envois bloqués</dt><dd>{number(summary.blockedJobs)}</dd></div></dl>
      </Section>
      <div className="bot-columns"><Section title="Évolution de l’utilisation" icon={BarChart3} description="Envois confirmés, mises à jour comprises. Les tests de connexion sont exclus."><BotDailyChart rows={data.daily} /></Section><Commands rows={data.commands} coverage={data.coverage} /></div>
      <Guilds rows={data.guilds} />
      <Section title="Activité récente" icon={Activity} description="Les dernières opérations conservées sur la période. Les tests sont identifiés séparément.">
        {data.recentActivity.length ? <ol className="bot-activity">{data.recentActivity.map(item => <li key={`${item.kind}-${item.id}`}><div><strong>{item.kind === "command" ? `/nxt ${item.commandName}` : item.kind === "connection_test" ? "Test de connexion" : "Tentative de publication"}</strong><p>{[item.teamName, item.channelName ? `#${item.channelName}` : item.channelId ? `Salon ${item.channelId}` : null].filter(Boolean).join(" · ") || "Commande du serveur"}</p><p>Serveur {item.guildId}</p>{item.errorCode && <p className="bot-error-code">Code : {item.errorCode}</p>}</div><time dateTime={item.at}>{date(item.at, true)} UTC</time><Status value={item.status} /></li>)}</ol> : <p className="bot-empty">Aucune activité enregistrée sur cette période.</p>}
      </Section>
      <details className="bot-details bot-method"><summary>Comprendre les chiffres et l’historique disponible</summary><div><p>Une publication correspond à une game diffusée dans un salon. Plusieurs envois peuvent mettre à jour cette même publication. Les tentatives échouées et les tests fictifs ne créent pas de publication diffusée.</p><p>Le taux de réussite compare les tentatives confirmées aux tentatives terminées (confirmées et en échec). Les opérations en cours ou à vérifier restent hors de ce calcul.</p><p>Les serveurs reliés décrivent les connexions enregistrées dans NXT5, pas toutes les installations possibles du bot sur Discord. Les noms de serveurs ne sont pas enregistrés : leurs identifiants et les noms des équipes et salons permettent de les retrouver.</p>{data.coverage.notes.map(note => <p key={note}>{note}</p>)}</div></details>
    </>}
  </div>;
}
