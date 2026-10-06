import React from "react";
import { ArrowRight, CalendarDays, Check, FileText, Swords, Users } from "lucide-react";
import { BeginnerCompass } from "../../components/layout/AppChrome.jsx";
import { Button, PageHeader, Surface } from "../../components/ui/Core.jsx";
import { canManageOnboarding } from "../../utils/onboarding.js";
import { sortTrendMatches } from "../../utils/trends.js";
import { matchDisplayName } from "../../utils/matches.js";
import { LinkButton, PublicTextLink } from "../public/PublicPages.jsx";
import "./home-workspace.css";

export default function HomeWorkspace({ data, currentTeam, currentMember, user, steps, onboarding, navigate }) {
  const manager = canManageOnboarding({ currentTeam, currentMember, user });
  const unfinished = steps.some(step => !step.done);
  const showStart = unfinished && !onboarding.dismissed;
  const matches = sortTrendMatches((data.matches || []).filter(row => row.team_id === currentTeam.id));
  const latest = matches[0];
  const reports = (data.reports || []).filter(row => row.team_id === currentTeam.id);
  return <div className="nxt5-home">
    <PageHeader eyebrow={currentTeam.name} title={showStart ? "On commence ici." : "On reprend ?"} subtitle={showStart ? undefined : "Les raccourcis utiles pour ta prochaine séance."} />
    {showStart ? <BeginnerCompass steps={steps} manager={manager} onNavigate={navigate} onClose={onboarding.dismiss} /> : <>
      <Surface glow className="nxt5-home-ready">
        {!unfinished && <p className="nxt5-home-status"><Check size={16} aria-hidden="true" />Tes premiers repères sont en place</p>}
        <h2>{latest ? "Votre dernière partie" : "Tout commence avec ton équipe"}</h2>
        <p>{latest ? matchDisplayName(latest) : manager ? "Ajoute une partie pour commencer à préparer votre débrief." : "Retrouve les joueurs et prépare la prochaine séance."}</p>
        <LinkButton href={latest ? `/games?match=${encodeURIComponent(latest.id)}` : manager ? "/games?import=1" : "/equipes"} navigate={navigate} icon={ArrowRight}>{latest ? "Reprendre la partie" : manager ? "Importer une partie" : "Voir mon équipe"}</LinkButton>
      </Surface>
      {unfinished && <div className="nxt5-home-resume"><div><strong>Besoin d’un point de départ ?</strong><p>Ton parcours t’attend, là où tu en étais.</p></div><Button type="button" variant="ghost" onClick={onboarding.resume}>Reprendre le démarrage</Button></div>}
      <nav className="nxt5-home-shortcuts" aria-label="Raccourcis du quotidien">
        {[
          { path: "/games", title: "Parties", text: "Retrouver une partie et son résumé", icon: Swords },
          { path: "/planning", title: "Planning", text: "Préparer la prochaine séance", icon: CalendarDays },
          { path: reports.length ? "/rapports" : "/equipes", title: reports.length ? "Débriefs" : "Équipe", text: reports.length ? "Retrouver les points à travailler" : "Retrouver les joueurs et le staff", icon: reports.length ? FileText : Users },
        ].map(({ path, title, text, icon: Icon }) => <PublicTextLink key={path} href={path} navigate={navigate} className="nxt5-home-shortcut"><Icon size={21} aria-hidden="true" /><span><strong>{title}</strong><span>{text}</span></span><ArrowRight size={17} aria-hidden="true" /></PublicTextLink>)}
      </nav>
      <PublicTextLink className="nxt5-home-guide" href="/guide" navigate={navigate}>Besoin d’aide ? Ouvrir le guide</PublicTextLink>
    </>}
  </div>;
}
