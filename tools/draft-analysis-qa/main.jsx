import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AmbientBackground, Sidebar, Topbar } from '../../src/components/layout/AppChrome.jsx';
import { TrendsPage } from '../../src/pages/workspace/TrendsPage.jsx';
import { getFixture, scenarios, team, teamId } from './fixtures.mjs';
import '../../src/index.css';

const scenario = new URLSearchParams(window.location.search).get('qa') || 'full';
const fixture = getFixture(scenario);
const user = { id: 'qa-user', name: 'Coach · QA locale' };
const noOp = () => {};

function DraftAnalysisQA() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  return <div className="relative min-h-screen text-white">
    <AmbientBackground />
    <a className="nxt5-workspace-skip" href="#workspace-content">Aller au contenu</a>
    <Sidebar active="trends" setActive={noOp} open={sidebarOpen} setOpen={setSidebarOpen}
      collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} user={user}
      currentMember={{ user_id: user.id, team_id: teamId, role: 'owner' }} currentTeamId={fixture.data.selectedTeamId}
      onLogout={noOp} roleLabel={role => role} />
    <div className={`nxt5-app-shell relative z-10 min-w-0 ${sidebarCollapsed ? 'is-sidebar-collapsed' : 'is-sidebar-expanded'}`}
      style={{ '--nxt5-sidebar-space': sidebarCollapsed ? '5rem' : '16.5rem' }}>
      <Topbar active="trends" setOpen={setSidebarOpen} currentTeam={fixture.data.selectedTeamId ? team : null}
        teams={[team]} onSelectTeam={noOp} onCreateTeam={noOp} onManageTeam={noOp} />
      <main id="workspace-content" tabIndex={-1} className="nxt5-workspace-main">
        <aside aria-label="Configuration QA locale" style={{ marginBottom: 24, padding: 12, border: '1px solid var(--nxt5-border)', borderRadius: 10, fontSize: 14, lineHeight: 1.6 }}>
          <strong>Données fictives · vérification locale</strong>
          <p>Les vrais composants de l’application utilisent 12 drafts et 5 joueurs inventés. Aucun compte ni partie réelle.</p>
          <label style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            <span>Scénario QA</span>
            <select value={fixture.scenario} onChange={event => { window.location.href = `/tendances?rubrique=drafts&qa=${encodeURIComponent(event.target.value)}`; }}
              style={{ maxWidth: '100%', padding: '8px 12px', border: '1px solid var(--nxt5-border)', borderRadius: 10, color: 'var(--nxt5-text)', background: 'var(--nxt5-surface)', fontSize: 16 }}>
              {scenarios.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </aside>
        <TrendsPage data={fixture.data} selectedTeamId={fixture.data.selectedTeamId} />
      </main>
    </div>
  </div>;
}
createRoot(document.getElementById('root')).render(<DraftAnalysisQA />);
