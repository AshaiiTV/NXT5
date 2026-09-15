import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Activity, ArrowDownRight, ArrowLeft, ArrowUpRight, BarChart3, CalendarDays, ChevronLeft, ChevronRight, Clock3, Download, Globe2, Info, Loader2, Monitor, MousePointer2, RefreshCw, Search, ShieldCheck, Target, Users } from "lucide-react";
import { useAdminQuery } from "../../hooks/useAdminQuery.js";
import { Badge, Button, PageHeader, SelectInput, SkeletonRows, Surface } from "../../components/ui/Core.jsx";
import { audienceCsv, audienceDate as date, audienceDecimal as decimal, audienceDelta, audienceDuration as duration, audienceNumber as n, audiencePercent as percent, audienceShare, countryLabel, DEVICE_LABELS, finiteNumber, GOAL_LABELS, isAudienceReport, selectAudiencePages, sourceLabel } from "./audience-metrics.js";
import "./audience.css";

function validateReport(data) {
  if (!isAudienceReport(data)) throw new Error("La réponse des statistiques est incomplète. Réessaie dans quelques instants.");
}

function Section({ title, description, icon: Icon, children, action, className = "" }) {
  return <Surface className={`audience-section ${className}`}><div className="audience-section-heading"><div><h3>{Icon && <Icon size={18} aria-hidden="true" />}{title}</h3>{description && <p>{description}</p>}</div>{action}</div>{children}</Surface>;
}

function Note({ children, alert = false, className = "" }) {
  return <div className={`audience-note ${alert ? "audience-note-error" : ""} ${className}`} role={alert ? "alert" : "status"}><Info size={18} aria-hidden="true" /><div>{children}</div></div>;
}

function Change({ value, previous, percentage = false, lowerIsBetter = false }) {
  const delta = audienceDelta(value, previous, { percentage, lowerIsBetter });
  const Icon = delta.label.startsWith("+") ? ArrowUpRight : delta.label.startsWith("−") ? ArrowDownRight : null;
  return <span className={`audience-change audience-change-${delta.tone}`}>{Icon && <Icon size={14} aria-hidden="true" />}{delta.label}<span className="sr-only"> par rapport à la période précédente</span></span>;
}

function Metric({ label, value, previous, format = n, note, icon: Icon, percentage = false }) {
  return <div className="audience-metric"><div className="audience-metric-heading"><h3>{label}</h3><Icon size={18} aria-hidden="true" /></div><strong>{format(value)}</strong><Change value={value} previous={previous} percentage={percentage} /><p>{note}</p></div>;
}

const CHART_W = 800;
const CHART_H = 220;
const CHART_PAD = 10;
function pointAt(rows, index, key, max) {
  return [CHART_PAD + (rows.length === 1 ? .5 : index / (rows.length - 1)) * (CHART_W - CHART_PAD * 2), CHART_H - CHART_PAD - finiteNumber(rows[index]?.[key]) / max * (CHART_H - CHART_PAD * 2)];
}

export function AudienceChart({ rows = [] }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const chartId = useId().replace(/:/g, "");
  const [visible, setVisible] = useState({ visitors: true, pageviews: true });
  const index = Math.max(0, rows.findIndex((row) => row.date === selectedDate));
  const selectedIndex = selectedDate && rows.some((row) => row.date === selectedDate) ? index : Math.max(0, rows.length - 1);
  const selected = rows[selectedIndex];
  const max = Math.max(1, ...rows.flatMap((row) => [visible.visitors ? finiteNumber(row.visitors) : 0, visible.pageviews ? finiteNumber(row.pageviews) : 0]));
  const select = (next) => setSelectedDate(rows[Math.max(0, Math.min(rows.length - 1, next))]?.date || null);
  const selectPointer = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width) select(Math.round(((event.clientX - bounds.left) / bounds.width * CHART_W - CHART_PAD) / (CHART_W - 2 * CHART_PAD) * (rows.length - 1)));
  };
  if (!rows.length) return <Note>Aucun relevé quotidien sur cette période.</Note>;
  const selectedX = pointAt(rows, selectedIndex, "visitors", max)[0];
  const path = (key) => rows.map((_, i) => `${i ? "L" : "M"}${pointAt(rows, i, key, max).join(",")}`).join(" ");
  return <div className="audience-chart">
    <div className="audience-chart-controls"><div className="audience-chart-legend" role="group" aria-label="Courbes affichées">{[["visitors", "Navigateurs", "cyan"], ["pageviews", "Pages vues", "violet"]].map(([key, label, color]) => <button key={key} type="button" aria-pressed={visible[key]} onClick={() => setVisible((current) => !current[key] || current[key === "visitors" ? "pageviews" : "visitors"] ? { ...current, [key]: !current[key] } : current)}><span className={`audience-dot audience-dot-${color}`} />{label}</button>)}</div><span className="audience-caption">Par jour · UTC</span></div>
    <div className="audience-chart-readout" aria-live="polite" aria-atomic="true"><span>{date(selected.date, { short: true })}</span><div><strong>{n(selected.visitors)} <small>navigateurs</small></strong><strong>{n(selected.pageviews)} <small>pages vues</small></strong></div></div>
    <div className="audience-chart-scale"><span>{n(max)}</span><span>Échelle commune · de 0 à {n(max)}</span></div>
    <svg className="audience-chart-svg" viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none" role="img" aria-labelledby={`${chartId}-title ${chartId}-description`} onPointerMove={selectPointer} onClick={selectPointer}>
      <title id={`${chartId}-title`}>Fréquentation quotidienne</title><desc id={`${chartId}-description`}>Navigateurs distincts et pages vues. Utilise le curseur sous le graphique pour lire chaque jour au clavier, ou ouvre le tableau des valeurs.</desc>
      <defs><linearGradient id={`${chartId}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#67e8f9" stopOpacity=".18" /><stop offset="100%" stopColor="#67e8f9" stopOpacity="0" /></linearGradient></defs>
      {[0, .25, .5, .75, 1].map((part) => <line key={part} x1={CHART_PAD} x2={CHART_W - CHART_PAD} y1={CHART_PAD + part * (CHART_H - CHART_PAD * 2)} y2={CHART_PAD + part * (CHART_H - CHART_PAD * 2)} stroke="#29394e" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />)}
      {visible.visitors && <path d={`${path("visitors")} L${pointAt(rows, rows.length - 1, "visitors", max)[0]},${CHART_H - CHART_PAD} L${pointAt(rows, 0, "visitors", max)[0]},${CHART_H - CHART_PAD} Z`} fill={`url(#${chartId}-fill)`} />}
      {visible.pageviews && <path d={path("pageviews")} fill="none" stroke="#a78bfa" strokeWidth="2" strokeDasharray="6 4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
      {visible.visitors && <path d={path("visitors")} fill="none" stroke="#67e8f9" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
      <line x1={selectedX} x2={selectedX} y1={CHART_PAD} y2={CHART_H - CHART_PAD} stroke="#cbd5e1" strokeOpacity=".45" vectorEffect="non-scaling-stroke" />
      {[["visitors", "#67e8f9"], ["pageviews", "#a78bfa"]].filter(([key]) => visible[key]).map(([key, color]) => <circle key={key} cx={selectedX} cy={pointAt(rows, selectedIndex, key, max)[1]} r="4" fill={color} stroke="#080f1e" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
    </svg>
    <div className="audience-chart-axis"><span>{date(rows[0].date, { short: true })}</span>{rows.length > 7 && <span>{date(rows[Math.floor(rows.length / 2)].date, { short: true })}</span>}<span>{date(rows.at(-1).date, { short: true })}</span></div>
    <label className="audience-chart-slider"><span>Explorer une journée <span>← → au clavier</span></span><input aria-label="Jour du graphique" aria-valuetext={`${date(selected.date)} : ${n(selected.visitors)} navigateurs, ${n(selected.pageviews)} pages vues`} type="range" min="0" max={Math.max(0, rows.length - 1)} step="1" value={selectedIndex} onChange={(event) => select(Number(event.target.value))} /></label>
    <details className="audience-details"><summary>Afficher les valeurs du graphique</summary><div className="audience-table-scroll" tabIndex={0} role="region" aria-label="Fréquentation quotidienne détaillée"><table className="audience-table"><thead><tr><th scope="col">Date UTC</th><th scope="col">Navigateurs</th><th scope="col">Sessions</th><th scope="col">Pages vues</th><th scope="col">Conversions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.date}><th scope="row">{date(row.date, { short: true })}</th><td>{n(row.visitors)}</td><td>{n(row.sessions)}</td><td>{n(row.pageviews)}</td><td>{n(row.conversions)}</td></tr>)}</tbody></table></div></details>
  </div>;
}

function Realtime({ data = {} }) {
  return <Section title="En ce moment" icon={Activity} className="audience-realtime" action={<Badge tone="cyan">{data.windowMinutes || 5} min</Badge>}>
    <div className="audience-live-number"><span className="audience-live-dot" /><strong>{n(data.visitors)}</strong><span>navigateurs actifs</span></div>
    <p className="audience-caption">Une activité reçue dans les {data.windowMinutes || 5} dernières minutes. Instantané à la dernière actualisation.</p>
    <div className="audience-realtime-pages"><h4>Pages actives</h4>{data.pages?.length ? data.pages.slice(0, 5).map((page) => <div key={page.path}><span>{page.path}</span><strong>{n(page.visitors)}</strong></div>) : <p className="audience-caption">Aucune page active pour le moment.</p>}</div>
    <p className="audience-caption audience-realtime-foot">{n(data.sessions)} sessions actives · filtres appliqués</p>
  </Section>;
}

function Pagination({ page, setPage, total, size = 10, label }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return <div className="audience-pagination"><span>{total ? `${(page - 1) * size + 1}–${Math.min(page * size, total)} sur ${n(total)}` : "0 résultat"}</span><div><Button type="button" variant="ghost" icon={ChevronLeft} aria-label={`${label} : page précédente`} disabled={page <= 1} onClick={() => setPage(page - 1)} /><span>{page} / {pages}</span><Button type="button" variant="ghost" icon={ChevronRight} aria-label={`${label} : page suivante`} disabled={page >= pages} onClick={() => setPage(page + 1)} /></div></div>;
}

function PopularPages({ rows, total }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("views");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => selectAudiencePages(rows, { search, sort }), [rows, search, sort]);
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 10)));
  return <Section title="Les pages qui comptent" icon={MousePointer2} description="Vues, navigateurs distincts et temps actif. Les chemins sont normalisés pour protéger les données personnelles." action={<Badge tone="cyan">{n(rows.length)} pages</Badge>}>
    <div className="audience-table-toolbar"><label className="audience-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Rechercher une page</span><input type="search" placeholder="Rechercher un chemin…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label><label className="audience-inline-select">Trier par<select aria-label="Trier les pages" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="views">Pages vues</option><option value="visitors">Navigateurs</option><option value="avgDurationSeconds">Temps actif</option><option value="exits">Sorties</option><option value="path">Chemin A → Z</option></select></label></div>
    {filtered.length ? <div className="audience-table-scroll" tabIndex={0} role="region" aria-label="Classement des pages"><table className="audience-table audience-pages-table"><thead><tr><th scope="col">Page</th><th scope="col">Vues</th><th scope="col">Navigateurs</th><th scope="col">Temps actif / vue</th><th scope="col">Sorties</th></tr></thead><tbody>{filtered.slice((safePage - 1) * 10, safePage * 10).map((row) => <tr key={row.path}><th scope="row"><span className="audience-page-path">{row.path}</span><span className="audience-page-bar" aria-hidden="true"><span style={{ width: `${audienceShare(row.views, total)}%` }} /></span></th><td><strong>{n(row.views)}</strong><small>{percent(audienceShare(row.views, total))}</small></td><td>{n(row.visitors)}</td><td>{duration(row.avgDurationSeconds)}</td><td>{n(row.exits)}</td></tr>)}</tbody></table></div> : <Note>{rows.length ? "Aucune page ne correspond à cette recherche." : "Aucune page vue sur cette période."}{search && <button className="audience-text-button" type="button" onClick={() => { setSearch(""); setPage(1); }}>Effacer la recherche</button>}</Note>}
    <Pagination page={safePage} setPage={setPage} total={filtered.length} label="Pages consultées" />
  </Section>;
}

function Acquisition({ rows = [], sessions }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...rows].sort((a, b) => finiteNumber(b.sessions) - finiteNumber(a.sessions));
  return <Section title="D’où viennent les visites ?" description="Source attribuée à l’arrivée de chaque session." icon={Globe2}>
    {!rows.length ? <Note>Aucune source enregistrée sur cette période.</Note> : <><div className="audience-ranking-header"><span>Source / référent</span><span>Sessions · conversions</span></div><div className="audience-ranking">{(expanded ? sorted : sorted.slice(0, 8)).map((row, i) => <div className="audience-ranking-row" key={row.source}><span className="audience-ranking-index">{String(i + 1).padStart(2, "0")}</span><div className="audience-ranking-content"><div><strong>{sourceLabel(row.source)}</strong><span>{n(row.sessions)} <small>· {n(row.conversions)} conv.</small></span></div><div className="audience-horizontal-track" aria-hidden="true"><span style={{ width: `${audienceShare(row.sessions, sessions)}%` }} /></div><small>{percent(audienceShare(row.sessions, sessions))} des sessions · {n(row.visitors)} navigateurs</small></div></div>)}</div>{rows.length > 8 && <button className="audience-text-button" type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>{expanded ? "Réduire les sources" : `Afficher les ${n(rows.length)} sources`}</button>}</>}
    <p className="audience-caption">« Direct / inconnu » inclut les arrivées sans source détectable. Les navigateurs peuvent appartenir à plusieurs sources.</p>
  </Section>;
}

function Goals({ goals = [], totals = {}, previous = {} }) {
  return <Section title="De la visite à l’action" icon={Target} description="Événements confirmés pendant les sessions avec consentement.">
    <div className="audience-conversion-summary"><strong>{n(totals.conversions)}</strong><div><span>sessions converties</span><p>Création de compte ou demande d’accès</p></div><Badge tone="purple">{percent(totals.conversionRate)}</Badge></div>
    <Change value={totals.conversions} previous={previous.conversions} />
    <div className="audience-goals">{goals.length ? goals.map((goal) => <div key={goal.name}><div><strong>{GOAL_LABELS[goal.name] || goal.name}</strong><small>{n(goal.sessions)} sessions · {percent(goal.conversionRate)} des sessions</small></div><strong>{n(goal.events)}<small>événements</small></strong></div>) : <p className="audience-caption">Aucun événement sur cette période.</p>}</div>
    <p className="audience-caption">Les actions peuvent se recouper. Le taux global compte chaque session convertie une seule fois. Ce tableau ne décrit pas un ordre de parcours.</p>
  </Section>;
}

function Campaigns({ rows = [] }) {
  const [page, setPage] = useState(1);
  const sorted = [...rows].sort((a, b) => finiteNumber(b.sessions) - finiteNumber(a.sessions));
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / 10)));
  return <Section title="Campagnes & liens partagés" description="Balises UTM présentes sur les liens d’arrivée : source, support et campagne." icon={BarChart3} action={<Badge tone="purple">UTM</Badge>}>
    {rows.length ? <><div className="audience-table-scroll" tabIndex={0} role="region" aria-label="Performances des campagnes"><table className="audience-table audience-campaigns-table"><thead><tr><th scope="col">Campagne</th><th scope="col">Source</th><th scope="col">Support</th><th scope="col">Sessions</th><th scope="col">Conversions</th><th scope="col">Taux</th></tr></thead><tbody>{sorted.slice((safePage - 1) * 10, safePage * 10).map((row, i) => <tr key={`${row.source}-${row.medium}-${row.campaign}-${i}`}><th scope="row">{row.campaign || "Sans nom"}</th><td>{row.source || "Non renseignée"}</td><td>{row.medium || "Non renseigné"}</td><td>{n(row.sessions)}</td><td>{n(row.conversions)}</td><td>{percent(audienceShare(row.conversions, row.sessions))}</td></tr>)}</tbody></table></div><Pagination page={safePage} setPage={setPage} total={rows.length} label="Campagnes" /></> : <div className="audience-campaign-empty"><p>Aucune campagne UTM observée.</p><span>Ajoute <code>utm_source</code>, <code>utm_medium</code> et <code>utm_campaign</code> à tes liens partagés pour comparer leur contribution.</span></div>}
  </Section>;
}

function Breakdown({ title, rows = [], field, total, label = (value) => value || "Non déterminé", tone = "cyan" }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...rows].sort((a, b) => finiteNumber(b.sessions) - finiteNumber(a.sessions));
  return <div className={`audience-breakdown audience-breakdown-${tone}`}><h4>{title}</h4>{rows.length ? <>{(expanded ? sorted : sorted.slice(0, 5)).map((row) => <div className="audience-breakdown-row" key={row[field]}><div><span>{label(row[field])}</span><strong>{percent(audienceShare(row.sessions, total))}</strong></div><div className="audience-horizontal-track" aria-hidden="true"><span style={{ width: `${audienceShare(row.sessions, total)}%` }} /></div><small>{n(row.sessions)} sessions</small></div>)}{rows.length > 5 && <button className="audience-text-button" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? "Réduire" : `Tout afficher (${n(rows.length)})`}<span className="sr-only"> : {title}</span></button>}</> : <p className="audience-caption">Aucune donnée.</p>}</div>;
}

const WEEK = [[1, "Lundi"], [2, "Mardi"], [3, "Mercredi"], [4, "Jeudi"], [5, "Vendredi"], [6, "Samedi"], [0, "Dimanche"]];
export function AudienceHeatmap({ rows = [] }) {
  const [active, setActive] = useState(0);
  const nodes = useRef([]);
  const map = new Map(rows.map((row) => [`${row.weekday}-${row.hour}`, finiteNumber(row.pageviews)]));
  const max = Math.max(1, ...map.values());
  const activeDay = WEEK[Math.floor(active / 24)];
  const current = map.get(`${activeDay[0]}-${active % 24}`) || 0;
  function move(event, index) {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % 168;
    if (event.key === "ArrowLeft") next = (index + 167) % 168;
    if (event.key === "ArrowDown") next = (index + 24) % 168;
    if (event.key === "ArrowUp") next = (index + 144) % 168;
    if (event.key === "Home") next = event.ctrlKey ? 0 : Math.floor(index / 24) * 24;
    if (event.key === "End") next = event.ctrlKey ? 167 : Math.floor(index / 24) * 24 + 23;
    if (next !== undefined) { event.preventDefault(); setActive(next); nodes.current[next]?.focus(); }
  }
  return <Section title="Quand le site est-il consulté ?" icon={CalendarDays} description="Pages vues cumulées par jour de la semaine et heure UTC sur la période.">
    <div className="audience-heatmap-readout" aria-live="polite" aria-atomic="true"><span>{activeDay[1]} · {active % 24} h–{active % 24 + 1} h UTC</span><strong>{n(current)} pages vues</strong></div>
    <div className="audience-heatmap-scroll"><div className="audience-heatmap" role="group" aria-label="Carte des consultations par heure. Flèches pour se déplacer."><span />{Array.from({ length: 24 }, (_, hour) => <span className="audience-heatmap-hour" key={`hour-${hour}`}>{hour % 3 === 0 ? `${hour} h` : ""}</span>)}{WEEK.map(([weekday, label], dayIndex) => <React.Fragment key={weekday}><span className="audience-heatmap-day">{label.slice(0, 3)}.</span>{Array.from({ length: 24 }, (_, hour) => {
      const value = map.get(`${weekday}-${hour}`) || 0;
      const index = dayIndex * 24 + hour;
      const level = value ? Math.max(1, Math.ceil(value / max * 4)) : 0;
      return <button key={`${weekday}-${hour}`} ref={(node) => { nodes.current[index] = node; }} type="button" tabIndex={active === index ? 0 : -1} className={`audience-heatmap-cell audience-heatmap-level-${level}`} aria-label={`${label}, ${hour} h à ${hour + 1} h UTC : ${n(value)} pages vues`} onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onClick={() => setActive(index)} onKeyDown={(event) => move(event, index)} aria-pressed={active === index} />;
    })}</React.Fragment>)}</div></div>
    <div className="audience-heatmap-footer"><span>Survole, touche ou utilise les flèches du clavier.</span><span>0 <span className="audience-heatmap-key" aria-hidden="true">{[0, 1, 2, 3, 4].map((level) => <i key={level} className={`audience-heatmap-level-${level}`} />)}</span> {n(max === 1 && !rows.some((row) => row.pageviews) ? 0 : max)} vues</span></div>
  </Section>;
}

function Engagement({ totals, previous }) {
  const values = [["Temps actif / session", "avgDurationSeconds", duration, "Temps où le site est visible et actif", false], ["Pages / session", "pagesPerSession", decimal, "Vues par session mesurée", false], ["Taux d’engagement", "engagementRate", percent, `${n(totals.engagedSessions)} sessions engagées`, true], ["Taux de rebond", "bounceRate", percent, "Sessions sans engagement", true]];
  return <Section title="L’attention derrière les visites" icon={Clock3} description="Des repères complémentaires au volume de trafic."><div className="audience-engagement">{values.map(([label, key, format, note, percentage]) => <div key={key}><h4>{label}</h4><strong>{format(totals[key])}</strong><Change value={totals[key]} previous={previous[key]} percentage={percentage} lowerIsBetter={key === "bounceRate"} /><p>{note}</p></div>)}</div><p className="audience-caption">Une session est engagée après au moins 10 secondes actives, 2 pages vues ou une conversion. Les visites refusant les cookies d’audience ne sont pas mesurées.</p></Section>;
}

/** Pure data view, also used to verify populated states without inventing production data. */
export function AudienceReport({ report }) {
  const totals = report.totals;
  const previous = report.previous || {};
  return <div className="audience-content">
    <div className="audience-metrics">
      <Metric label="Navigateurs distincts" value={totals.visitors} previous={previous.visitors} icon={Users} note={`${n(totals.returningVisitors)} déjà observés avant cette période`} />
      <Metric label="Sessions" value={totals.sessions} previous={previous.sessions} icon={MousePointer2} note="Une nouvelle visite après 30 min d’inactivité" />
      <Metric label="Pages vues" value={totals.pageviews} previous={previous.pageviews} icon={BarChart3} note={`${decimal(totals.pagesPerSession)} pages par session`} />
      <Metric label="Taux de conversion" value={totals.conversionRate} previous={previous.conversionRate} format={percent} icon={Target} percentage note={`${n(totals.conversions)} sessions avec compte créé ou demande d’accès`} />
    </div>
    {finiteNumber(totals.sessions) === 0 && <Note className="audience-empty"><strong>Aucune visite mesurée sur cette période.</strong><p>Les statistiques apparaîtront après les premières visites avec consentement. Si des filtres sont actifs, essaie une vue plus large. Aucun historique antérieur à l’installation n’est reconstitué.</p></Note>}
    <div className="audience-main-grid"><Section title="Le rythme des visites" description="L’évolution quotidienne des navigateurs distincts et des pages vues." icon={Activity}><AudienceChart rows={report.timeseries} /></Section><Realtime data={report.realtime} /></div>
    <Engagement totals={totals} previous={previous} />
    <PopularPages rows={report.pages || []} total={totals.pageviews} />
    <div className="audience-two-columns"><Acquisition rows={report.sources} sessions={totals.sessions} /><Goals goals={report.goals} totals={totals} previous={previous} /></div>
    <Campaigns rows={report.campaigns} />
    <Section title="Les contextes de consultation" icon={Monitor} description="Répartition des sessions, avec les filtres sélectionnés."><div className="audience-breakdowns"><Breakdown title="Appareils" rows={report.devices} field="device" total={totals.sessions} label={(value) => DEVICE_LABELS[value] || value || "Inconnu"} /><Breakdown title="Navigateurs" rows={report.browsers} field="browser" total={totals.sessions} tone="violet" /><Breakdown title="Pays" rows={report.countries} field="country" total={totals.sessions} label={countryLabel} /></div><p className="audience-caption">Le pays, lorsqu’il est disponible, est une localisation approximative fournie par l’hébergement. Aucune adresse IP n’est stockée dans ces statistiques.</p></Section>
    <AudienceHeatmap rows={report.heatmap} />
    <details className="audience-methodology"><summary><ShieldCheck size={18} aria-hidden="true" />Comprendre ces chiffres et leur périmètre</summary><div><p><strong>Seulement les visites consenties.</strong> Le refus et le retrait du consentement arrêtent la collecte. Ces chiffres ne représentent pas toute la fréquentation du site.</p><p><strong>Un navigateur n’est pas une personne.</strong> Un identifiant pseudonyme distingue les navigateurs. Changer d’appareil, effacer ses cookies ou renouveler son consentement peut créer un nouvel identifiant. Les navigateurs distincts ne s’additionnent pas entre journées ou sources.</p><p><strong>Comparer des périodes équivalentes.</strong> Les écarts se rapportent aux {report.period?.days} jours précédents, avec les mêmes filtres. Les taux sont comparés en points. La journée actuelle est encore en cours.</p><p><strong>Conservation limitée.</strong> Les événements sont conservés au maximum {report.retentionDays || 180} jours. Les navigateurs revenus sont ceux déjà observés avant la période, dans cet historique disponible. Les durées sont indicatives : une fermeture brutale ou un blocage réseau peut empêcher le dernier relevé.</p></div></details>
  </div>;
}

export default function AudiencePage({ navigate }) {
  const [days, setDays] = useState(30);
  const [device, setDevice] = useState("all");
  const [source, setSource] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [exportError, setExportError] = useState("");
  const params = new URLSearchParams({ days: String(days), device, source });
  const { data: report, loading, error, errorDetails, refresh } = useAdminQuery(`admin-audience?${params}`, { validate: validateReport, timeoutMs: 25000 });
  const previousSources = useRef([]);
  if (report?.filters?.sources) previousSources.current = report.filters.sources;
  useEffect(() => {
    setExportError("");
  }, [days, device, source]);
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = globalThis.setInterval(() => { if (typeof document === "undefined" || document.visibilityState !== "hidden") void refresh().catch(() => {}); }, 60000);
    return () => globalThis.clearInterval(timer);
  }, [autoRefresh, refresh]);
  const sources = [...new Set([...previousSources.current, ...(source !== "all" ? [source] : [])])].filter((value) => value !== "all").sort();
  const currentError = error ? { message: error, code: errorDetails?.code } : null;
  function exportReport() {
    if (!report) return;
    setExportError("");
    let url;
    try {
      const blob = new Blob([audienceCsv(report, { device, source })], { type: "text/csv;charset=utf-8;" });
      url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `nxt5-frequentation-${days}j-${String(report.generatedAt || "").slice(0, 10)}.csv`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
    } catch { setExportError("Le téléchargement n’a pas pu démarrer. Réessaie depuis ton navigateur."); }
    finally { if (url) globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
  return <div className="nxt5-data-dense audience-dashboard">
    <PageHeader eyebrow="Administration · Audience" title="Fréquentation" subtitle="Comprends ce qui attire les visiteurs, retient leur attention et les amène à agir.">
      {navigate && <Button type="button" variant="ghost" icon={ArrowLeft} onClick={() => navigate("/admin")}>Administration</Button>}
      <Button type="button" variant="ghost" icon={Download} disabled={!report || loading} onClick={exportReport}>Exporter CSV</Button>
      <Button type="button" variant="ghost" icon={loading ? Loader2 : RefreshCw} disabled={loading} onClick={() => { setExportError(""); void refresh().catch(() => {}); }}>{loading ? "Actualisation…" : "Actualiser"}</Button>
    </PageHeader>
    <div className="audience-status"><span><ShieldCheck size={15} aria-hidden="true" />Accès administrateur · visites avec consentement</span><span>{report ? `Actualisé le ${date(report.generatedAt, { short: true, time: true })} UTC` : "Statistiques de fréquentation"}</span></div>
    <Surface className="audience-section audience-filters"><div className="audience-filter-top"><div><h3>Période d’analyse</h3><div className="audience-periods" role="group" aria-label="Période d’analyse">{[7, 30, 90].map((value) => <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)}>{value} jours</button>)}</div></div><SelectInput label="Appareil" value={device} onChange={setDevice}><option value="all">Tous les appareils</option>{["desktop", "mobile", "tablet"].map((value) => <option key={value} value={value}>{DEVICE_LABELS[value]}</option>)}</SelectInput><SelectInput label="Source" value={source} onChange={setSource}><option value="all">Toutes les sources</option>{sources.map((value) => <option key={value} value={value}>{sourceLabel(value)}</option>)}</SelectInput></div><div className="audience-filter-bottom"><div><CalendarDays size={15} aria-hidden="true" /><p>{report ? <>{date(report.period.from, { short: true })} → {date(report.period.to, { short: true })} UTC<span>Comparaison : {date(report.comparison?.from, { short: true })} → {date(report.comparison?.to, { short: true })}</span></> : <>Les {days} derniers jours · journées UTC</>}</p></div><label className="audience-auto-refresh"><input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />Actualiser toutes les 60 s</label></div></Surface>
    <div className="audience-scope"><ShieldCheck size={17} aria-hidden="true" /><p><strong>Une audience mesurée avec accord.</strong> Les visiteurs qui refusent les cookies restent hors de ces statistiques. Un navigateur distinct ne représente pas nécessairement une personne.</p></div>
    {exportError && <Note alert>{exportError}</Note>}
    {currentError && <Note alert><strong>{currentError.code === "AUDIENCE_SCHEMA_MISSING" ? "La collecte d’audience reste à initialiser." : "Les statistiques ne sont pas disponibles."}</strong><p>{currentError.code === "AUDIENCE_SCHEMA_MISSING" ? "La migration de la base de données doit être appliquée pour activer le tableau de bord. Aucune valeur fictive n’est affichée." : currentError.message}</p>{report && <p>Les chiffres ci-dessous proviennent de la dernière actualisation réussie pour ces filtres.</p>}<Button type="button" variant="ghost" disabled={loading} onClick={() => { void refresh().catch(() => {}); }}>Réessayer</Button></Note>}
    {!report && loading && <div role="status" aria-label="Chargement des statistiques de fréquentation"><p className="audience-loading-label">Chargement de la fréquentation…</p><SkeletonRows count={4} /></div>}
    {report && <div aria-busy={loading}><AudienceReport report={report} /></div>}
  </div>;
}
