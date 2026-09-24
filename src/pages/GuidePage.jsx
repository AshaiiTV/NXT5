import React, { useMemo } from "react";
import { Activity, AlertTriangle, ArrowRight, BarChart3, BookOpen, CalendarDays, Crown, FileText, MessageCircleQuestion, Settings, Sparkles, Swords, Users } from "lucide-react";
import "./guide.css";
import { cx } from "../app/helpers.js";
import { Badge, Button, PageHeader } from "../components/ui/Core.jsx";

const GUIDE_SECTIONS = [
  { id: "getting-started", label: "Premiers pas", icon: BookOpen, title: "De ta première équipe au premier débrief", intro: "Commence par les joueurs. Une fois leurs profils ajoutés, tu peux importer une partie et préparer la discussion en équipe.", path: "/equipes", action: "Voir mon équipe", steps: ["Créer ou rejoindre une équipe depuis Équipe.", "Ajouter les joueurs et vérifier leur rôle et leur compte de jeu.", "Dans Parties, importer le fichier d’une première partie.", "Lire le résumé, puis noter les points à travailler dans Débriefs."] },
  { id: "teams-and-roster", label: "Équipe", icon: Users, title: "Ajouter les joueurs de ton équipe", intro: "Chaque joueur a un profil pour retrouver ses parties. Le responsable de l’équipe ou le staff autorisé ajoute et modifie ces profils.", path: "/gestion-equipe?section=roster", action: "Ouvrir la gestion des joueurs", steps: ["Créer les profils des titulaires et des remplaçants dans la gestion des joueurs.", "Vérifier le rôle et le Riot ID, c’est-à-dire le pseudo et le tag du compte de jeu.", "Associer chaque compte NXT5 au profil du bon joueur lorsqu’il rejoint l’équipe.", "Vérifier les accès accordés aux membres avant de partager une invitation."] },
  { id: "imports-and-games", label: "Importer", icon: Swords, title: "Ajouter ta première partie", intro: "NXT5 Importer est l’application qui récupère le fichier de la partie. Tu l’ajoutes ensuite dans NXT5 pour consulter ses données.", path: "/games?import=1", action: "Importer une partie", steps: ["Exporter la partie avec la dernière version de NXT5 Importer.", "Dans Parties, ouvrir Importer une partie et choisir le fichier exporté, au format JSON.", "Confirmer le côté de ton équipe, bleu ou rouge, et le poste des dix joueurs.", "Associer les cinq joueurs alliés à leurs profils, puis valider l’import."] },
  { id: "statistics", label: "Lire une partie", icon: BarChart3, title: "Comprendre une partie, étape par étape", intro: "Commence par son résumé. Les détails servent à vérifier une observation, puis à en discuter avec l’équipe.", path: "/games", action: "Ouvrir les parties", steps: ["Dans Parties, rechercher puis ouvrir la partie à revoir.", "Lire le résultat et les principaux écarts entre les équipes.", "Ouvrir les détails utiles : statistiques, objectifs ou chronologie des événements.", "Revenir aux faits avant de noter une conclusion dans le débrief."] },
  { id: "reviews", label: "Débriefs", icon: FileText, title: "Garder les points à travailler", intro: "Un débrief, aussi appelé review, relie vos observations à une partie et aide à préparer la prochaine séance.", path: "/rapports", action: "Ouvrir les débriefs", steps: ["Partir d’une partie ou d’un groupe de parties lié au débrief.", "Décrire un fait précis : ce qui s’est passé et à quel moment.", "Choisir ensemble une action à travailler, avec les joueurs concernés.", "Revenir sur les prochaines parties pour vérifier si cette action a changé."] },
  { id: "trends", label: "Analyses", icon: Activity, title: "Repérer ce qui revient dans vos parties", intro: "Analyses compare plusieurs parties. Une répétition peut donner une piste de travail ; elle ne suffit pas à expliquer une action isolée.", path: "/tendances", action: "Ouvrir les analyses", steps: ["Choisir une période et une catégorie de parties comparables.", "Vérifier combien de parties sont analysées avant de lire le taux de victoire.", "Repérer les écarts qui reviennent selon les rôles et les moments de jeu.", "Rouvrir les parties concernées pour vérifier l’observation."] },
  { id: "champion-pool", label: "Champions joués", icon: Crown, title: "Déclarer les champions maîtrisés", intro: "Le champion pool est la liste des champions qu’un joueur prépare. Son niveau indique sa maîtrise actuelle.", path: "/draft/pool", action: "Choisir les champions", steps: ["Choisir le joueur et son rôle dans Draft, puis Champion Pool.", "Ajouter les champions et indiquer leur niveau de maîtrise.", "Distinguer les champions prêts à jouer de ceux encore en entraînement.", "Mettre la liste à jour après les séances de travail."] },
  { id: "compositions", label: "Compositions", icon: Sparkles, title: "Préparer les choix de champions", intro: "La draft est la phase de choix des champions. Une composition rassemble les cinq champions et leur plan de jeu.", path: "/draft/compositions", action: "Ouvrir les compositions", steps: ["Choisir Nos drafts pour ton équipe ou Leurs drafts pour les adversaires.", "Placer un champion par rôle, parmi ceux que les joueurs peuvent jouer.", "Écrire ce que la composition doit réussir : par exemple, préparer les combats autour des objectifs.", "Préparer une variante si un champion est indisponible."] },
  { id: "planning", label: "Planning", icon: CalendarDays, title: "Organiser la prochaine séance", intro: "Rassemble les disponibilités avant de confirmer un entraînement, un match ou un débrief.", path: "/planning", action: "Ouvrir le planning", steps: ["Choisir la bonne semaine.", "Renseigner les créneaux où tu es disponible.", "Créer l’événement : Scrim pour un entraînement, Match ou Review pour un débrief.", "Vérifier les présences avant de confirmer la séance avec l’équipe."] },
  { id: "player-profile", label: "Mon profil", icon: Activity, title: "Suivre ta progression", intro: "Le profil regroupe les parties, les champions, les objectifs et les notes du coach pour un joueur.", path: "/mon-profil", action: "Ouvrir mon profil", steps: ["Vérifier que ton compte est lié au bon profil joueur.", "Lire la synthèse, puis ouvrir l’historique pour retrouver une partie.", "Consulter les champions joués et les confrontations avec les adversaires.", "Retrouver les objectifs et les notes du coach dans Suivi."] },
  { id: "permissions-and-account", label: "Accès et compte", icon: Settings, title: "Comprendre les actions disponibles", intro: "Ton rôle dans l’équipe détermine ce que tu peux consulter ou modifier.", path: "/parametres", action: "Voir les paramètres", steps: ["Vérifier ton rôle dans l’équipe.", "Gérer ton compte et tes connexions dans Paramètres.", "Le responsable de l’équipe gère les rôles depuis Gestion équipe.", "Lui demander de vérifier tes droits si une action nécessaire reste bloquée."] },
  { id: "troubleshooting", label: "Dépannage", icon: AlertTriangle, title: "Résoudre un problème courant", intro: "Vérifie d’abord l’équipe sélectionnée, le profil joueur et le fichier utilisé pour l’import.", path: "/parametres", action: "Ouvrir les paramètres", steps: ["Recharger la page une fois.", "Vérifier l’équipe et le profil affichés.", "Si l’import échoue, réexporter le fichier avec la dernière version de NXT5 Importer.", "Conserver le message d’erreur exact pour demander de l’aide."] },
];

const FIRST_WORDS = [
  ["Roster", "Les joueurs de l’équipe, titulaires et remplaçants."],
  ["Scrim", "Une partie d’entraînement contre une autre équipe."],
  ["Draft", "Le choix des champions et la préparation des compositions."],
  ["Champion pool", "Les champions qu’un joueur maîtrise ou travaille."],
  ["Review", "Le débrief d’une partie : observations et points à travailler."],
];

export default function GuidePage({ route, navigate, onOpenAssistant }) {
  const requestedSection = new URLSearchParams(route?.search || "").get("section") || "getting-started";
  const current = useMemo(() => GUIDE_SECTIONS.find((section) => section.id === requestedSection) || GUIDE_SECTIONS[0], [requestedSection]);
  const CurrentIcon = current.icon;
  const selectSection = (id) => navigate?.(`/guide?section=${encodeURIComponent(id)}`);

  return <div className="min-w-0">
    <PageHeader eyebrow="Guide NXT5" title="Que veux-tu faire ?" subtitle="Choisis une rubrique pour retrouver les étapes et accéder au bon écran.">
      <Button icon={MessageCircleQuestion} onClick={() => onOpenAssistant?.(`Aide-moi sur la section ${current.label} du guide.`)}>Question à l’assistant</Button>
    </PageHeader>
    <div className="nxt5-guide-layout">
      <nav aria-label="Sommaire du guide" className="nxt5-guide-nav">
        <label className="nxt5-guide-mobile-label">Rubrique du guide<select value={current.id} onChange={(event) => selectSection(event.target.value)}>{GUIDE_SECTIONS.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}</select></label>
        <div className="nxt5-guide-menu">
          {GUIDE_SECTIONS.map((section, index) => { const Icon = section.icon; const active = section.id === current.id; return <button key={section.id} type="button" onClick={() => selectSection(section.id)} aria-current={active ? "page" : undefined} className={cx("nxt5-guide-link group flex items-center gap-3 px-3 text-left text-sm font-semibold transition", active ? "is-active text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-white")}><span className={cx("text-xs tabular-nums", active ? "text-cyan-100" : "text-slate-600")}>{String(index + 1).padStart(2, "0")}</span><Icon className="h-4 w-4 shrink-0" /><span className="whitespace-nowrap">{section.label}</span></button>; })}
        </div>
      </nav>
      <section className="min-w-0 p-5 sm:p-7 xl:p-10">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-200/20 bg-cyan-400/10 text-cyan-100"><CurrentIcon className="h-5 w-5" /></span><div><Badge tone="cyan">{current.label}</Badge><h2 className="mt-3 text-2xl font-bold text-white">{current.title}</h2><p className="mt-2 text-sm font-normal leading-6 text-slate-300">{current.intro}</p></div></div>
          <ol className="mt-8 divide-y divide-white/10 border-y border-white/10">{current.steps.map((step, index) => <li key={step} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 py-4"><span className="font-black tabular-nums text-cyan-100/70">{String(index + 1).padStart(2, "0")}</span><p className="text-sm font-normal leading-6 text-slate-100">{step}</p></li>)}</ol>
          <div className="mt-6 flex flex-wrap gap-2"><Button icon={ArrowRight} onClick={() => navigate?.(current.path)}>{current.action}</Button><Button variant="ghost" icon={MessageCircleQuestion} onClick={() => onOpenAssistant?.(`Explique-moi la section ${current.label} du guide.`)}>Poser une question</Button></div>
          {current.id === "getting-started" && <details className="nxt5-guide-vocabulary"><summary>Les mots utiles : roster, draft, review…</summary><dl>{FIRST_WORDS.map(([term, meaning]) => <div key={term}><dt>{term}</dt><dd>{meaning}</dd></div>)}</dl></details>}
        </div>
      </section>
    </div>
  </div>;
}
