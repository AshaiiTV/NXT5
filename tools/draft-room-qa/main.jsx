import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DraftRoomWorkspace } from '../../src/components/draft/LiveDraftRoom.jsx';
import '../../src/index.css';

const teamId = '00000000-0000-4000-8000-0000000000aa';
const readRoute = () => ({ path: window.location.pathname, search: window.location.search });

function DraftRoomQA() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const sync = () => setRoute(readRoute());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  const navigate = to => { window.history.pushState(null, '', to); setRoute(readRoute()); };
  return <main className="mx-auto w-full max-w-6xl px-4 py-6">
    <DraftRoomWorkspace teamId={teamId} teamName="Équipe Test" matches={[]} route={route} navigate={navigate} />
  </main>;
}

createRoot(document.getElementById('root')).render(<DraftRoomQA />);
