import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Nxt5Wordmark } from '../../src/components/brand/BrandAssets.jsx';
import { GameWorkspace } from '../../src/pages/workspace/GameWorkspace.jsx';
import { TrendsPage } from '../../src/pages/workspace/TrendsPage.jsx';
import { apiFetch } from '../../src/api/client.js';
import '../../src/index.css';
import './preview.css';

const teamId = '00000000-0000-4000-8000-000000000010';
const user = { id: '00000000-0000-4000-8000-000000000001' };
const readRoute = () => ({ path: window.location.pathname === '/' ? '/games' : window.location.pathname,
  search: window.location.pathname === '/' ? '?view=teams' : window.location.search });
function Prototype() {
  const [route, setRoute] = useState(readRoute);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const refreshAll = async () => { try { setData(await apiFetch('prototype-data')); setError(''); } catch (failure) { setError(failure.message); } };
  useEffect(() => { refreshAll(); const update = () => setRoute(readRoute()); window.addEventListener('popstate', update); return () => window.removeEventListener('popstate', update); }, []);
  return <div className="drafter-prototype-shell">
    <header className="drafter-prototype-header"><Nxt5Wordmark className="h-10 w-32" />
      <div><strong>Prototype local · Parties et drafts</strong><p>Équipe et partie de démonstration. Les données sont conservées sur cet ordinateur.</p></div>
    </header>
    <nav className="drafter-prototype-nav" aria-label="Navigation du prototype"><a href="/games?view=teams" aria-current={route.path === '/games' ? 'page' : undefined}>Parties</a><a href="/tendances?rubrique=drafts" aria-current={route.path === '/tendances' ? 'page' : undefined}>Analyses</a></nav>
    {toast && <p role="status">{toast.title} {toast.text}</p>}
    <main>{error ? <p role="alert">{error}</p> : !data ? <p role="status">Chargement…</p> : route.path === '/tendances'
      ? <TrendsPage data={data} selectedTeamId={teamId} />
      : <GameWorkspace data={data} setData={setData} selectedTeamId={teamId} user={user} currentMember={{ team_id: teamId, user_id: user.id, role: 'owner' }} refreshAll={refreshAll} pushToast={setToast} route={route} />}</main>
  </div>;
}
createRoot(document.getElementById('root')).render(<Prototype />);
