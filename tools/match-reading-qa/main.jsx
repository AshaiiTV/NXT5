import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AmbientBackground, Sidebar, Topbar } from '../../src/components/layout/AppChrome.jsx';
import { MatchDataPanel } from '../../src/pages/workspace/GameWorkspace.jsx';
import { getFixture, scenarios, teamId } from './fixtures.mjs';
import { setLanguage } from '../../src/i18n/locale.js';
import '../../src/index.css';

const params = new URLSearchParams(window.location.search);
const fixture = getFixture(params.get('qa'));
if (['fr', 'en', 'es'].includes(params.get('lang'))) setLanguage(params.get('lang'));
if (params.get('performance') === '1') document.documentElement.classList.add('nxt5-low-gpu');
const user = { id: 'qa-local-user', name: 'Coach · exemple fictif' };
const currentMember = { user_id: user.id, team_id: teamId, role: 'owner' };
const noOp = () => {};

function MatchReadingQA() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(params.get('sidebar') === 'collapsed');
  const [notice, setNotice] = useState('');
  const matchRef = useRef(null);
  useEffect(() => {
    const requested = params.get('open');
    const indices = requested === 'both' ? [1, 2] : requested === 'points' ? [1] : requested === 'timeline' ? [2] : [];
    const disclosures = matchRef.current?.querySelectorAll('.games-analysis-disclosure') || [];
    indices.forEach(index => { if (disclosures[index]) disclosures[index].open = true; });
  }, []);
  const chooseScenario = event => {
    const next = new URL(window.location.href);
    next.searchParams.set('qa', event.target.value);
    window.location.href = next.href;
  };
  return <div className="relative min-h-screen text-white">
    <AmbientBackground />
    <a className="nxt5-workspace-skip" href="#workspace-content">Aller au contenu</a>
    <Sidebar active="matches" setActive={noOp} open={sidebarOpen} setOpen={setSidebarOpen}
      collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} user={user}
      currentMember={currentMember} currentTeamId={teamId} onLogout={noOp} roleLabel={role => role} />
    <div className={`nxt5-app-shell relative z-10 min-w-0 ${sidebarCollapsed ? 'is-sidebar-collapsed' : 'is-sidebar-expanded'}`}
      style={{ '--nxt5-sidebar-space': sidebarCollapsed ? '5rem' : '16.5rem' }}>
      <Topbar active="matches" setOpen={setSidebarOpen} currentTeam={fixture.team} teams={[fixture.team]}
        onSelectTeam={noOp} onCreateTeam={noOp} onManageTeam={noOp} />
      <main id="workspace-content" tabIndex={-1} className="nxt5-workspace-main">
        <aside aria-label="Configuration QA locale" style={{ marginBottom: 20, padding: '12px 16px', border: '1px solid var(--nxt5-border)', borderRadius: 10, fontSize: 14, lineHeight: 1.6 }}>
          <strong>Données fictives · vérification locale</strong>
          <details style={{ marginTop: 4 }}><summary style={{ cursor: 'pointer', minHeight: 28 }}>Configurer le scénario</summary>
            <p>Vrais composants NXT5, 10 joueurs inventés et 27 relevés synthétiques. Aucune API de compte ou de partie réelle.</p>
            <label style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}>Scénario
              <select value={fixture.scenario} onChange={chooseScenario} style={{ maxWidth: '100%', padding: '8px 12px', color: 'var(--nxt5-text)', background: 'var(--nxt5-field)', border: '1px solid var(--nxt5-border)', borderRadius: 10, fontSize: 16 }}>
                {scenarios.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </details>
        </aside>
        {notice && <p role="status">{notice}</p>}
        <div ref={matchRef} className="nxt5-games-page">
          <MatchDataPanel match={fixture.match} teamName={fixture.team.name}
            onReview={() => setNotice('Ouverture du débrief simulée : aucune donnée réelle ni enregistrement.')} />
        </div>
      </main>
    </div>
  </div>;
}

createRoot(document.getElementById('root')).render(<MatchReadingQA />);
