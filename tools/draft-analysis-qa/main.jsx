import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AmbientBackground, Sidebar, Topbar } from '../../src/components/layout/AppChrome.jsx';
import { TrendsPage } from '../../src/pages/workspace/TrendsPage.jsx';
import { GameWorkspace } from '../../src/pages/workspace/GameWorkspace.jsx';
import { getFixture, getOpponentFixture, scenarios, opponentScenarios, team, teamId } from './fixtures.mjs';
import '../../src/index.css';

const scenarioKey = 'nxt5:local-qa-scenario';
const requestedScenario = new URLSearchParams(window.location.search).get('qa');
let scenario = requestedScenario || 'full';
try { scenario = requestedScenario || sessionStorage.getItem(scenarioKey) || 'full'; sessionStorage.setItem(scenarioKey, scenario); } catch { /* Storage is optional. */ }
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, options = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, window.location.href);
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/.netlify/functions/')) return nativeFetch(input, options);
  const headers = new Headers(typeof input === 'string' ? {} : input.headers);
  new Headers(options.headers).forEach((value, name) => headers.set(name, value));
  headers.set('X-NXT5-QA-Scenario', scenario);
  headers.set('X-NXT5-QA-Surface', window.location.pathname === '/games' ? 'opponents' : 'drafts');
  return nativeFetch(input, { ...options, headers });
};
const readRoute = () => {
  const path = window.location.pathname === '/' ? '/tendances' : window.location.pathname;
  const search = new URLSearchParams(window.location.search);
  if (path === '/tendances' && !search.has('rubrique')) search.set('rubrique', 'drafts');
  if (path === '/games' && scenario === 'empty-dossier' && search.get('view') === 'teams' && !search.has('opponent')) search.set('opponent', 'qa-no-drafts');
  return { path, search: `?${search}` };
};
const user = { id: 'qa-user', name: 'Coach · QA locale' };
const noOp = () => {};

function DraftAnalysisQA() {
  const [route, setRoute] = useState(readRoute);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const gamesPage = route.path === '/games';
  const fixture = useMemo(() => gamesPage ? getOpponentFixture(scenario) : getFixture(scenario), [gamesPage]);
  const [data, setData] = useState(fixture.data);
  const [toast, setToast] = useState(null);
  const active = gamesPage ? 'matches' : 'trends';
  const currentMember = { user_id: user.id, team_id: teamId, role: fixture.scenario === 'readonly' ? 'player' : 'owner' };
  const refreshAll = async () => { setData(fixture.data); };
  useEffect(() => { const update = () => setRoute(readRoute()); window.addEventListener('popstate', update); return () => window.removeEventListener('popstate', update); }, []);
  useEffect(() => { setData(fixture.data); setToast(null); }, [fixture]);
  return <div className="relative min-h-screen text-white">
    <AmbientBackground />
    <a className="nxt5-workspace-skip" href="#workspace-content">Aller au contenu</a>
    <Sidebar active={active} setActive={noOp} open={sidebarOpen} setOpen={setSidebarOpen}
      collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} user={user}
      currentMember={currentMember} currentTeamId={fixture.data.selectedTeamId}
      onLogout={noOp} roleLabel={role => role} />
    <div className={`nxt5-app-shell relative z-10 min-w-0 ${sidebarCollapsed ? 'is-sidebar-collapsed' : 'is-sidebar-expanded'}`}
      style={{ '--nxt5-sidebar-space': sidebarCollapsed ? '5rem' : '16.5rem' }}>
      <Topbar active={active} setOpen={setSidebarOpen} currentTeam={fixture.data.selectedTeamId ? team : null}
        teams={[team]} onSelectTeam={noOp} onCreateTeam={noOp} onManageTeam={noOp} />
      <main id="workspace-content" tabIndex={-1} className="nxt5-workspace-main">
        <aside aria-label="Configuration QA locale" style={{ marginBottom: 24, padding: 12, border: '1px solid var(--nxt5-border)', borderRadius: 10, fontSize: 14, lineHeight: 1.6 }}>
          <strong>Données fictives · vérification locale</strong>
          <p>{gamesPage ? 'Les vrais écrans Parties et Équipes utilisent six adversaires, quatorze parties et six groupes inventés.' : 'Les vrais composants de l’application utilisent 12 drafts et 5 joueurs inventés.'} Aucun compte ni partie réelle.</p>
          <nav aria-label="Vues QA locales" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
            <a href="/tendances?rubrique=drafts&qa=full">Analyses des drafts</a><a href="/games?view=teams&qa=full">Équipes adverses</a>
          </nav>
          <label style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            <span>Scénario QA</span>
            <select value={fixture.scenario} onChange={event => { window.location.href = `${gamesPage ? '/games?view=teams' : '/tendances?rubrique=drafts'}&qa=${encodeURIComponent(event.target.value)}`; }}
              style={{ maxWidth: '100%', padding: '8px 12px', border: '1px solid var(--nxt5-border)', borderRadius: 10, color: 'var(--nxt5-text)', background: 'var(--nxt5-surface)', fontSize: 16 }}>
              {(gamesPage ? opponentScenarios : scenarios).map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </aside>
        {toast && <p role="status">{toast.title} {toast.text}</p>}
        {gamesPage ? <GameWorkspace data={data} setData={setData} selectedTeamId={fixture.data.selectedTeamId}
          currentMember={currentMember} user={user} route={route} refreshAll={refreshAll} pushToast={setToast} />
          : <TrendsPage data={data} selectedTeamId={fixture.data.selectedTeamId} />}
      </main>
    </div>
  </div>;
}
createRoot(document.getElementById('root')).render(<DraftAnalysisQA />);
