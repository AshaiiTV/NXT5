import React, { useMemo } from "react";
import { Activity, AlertTriangle, ArrowRight, BarChart3, BookOpen, CalendarDays, Crown, FileText, MessageCircleQuestion, Settings, Sparkles, Swords, Users } from "lucide-react";
import { cx } from "../app/helpers.js";
import { Badge, Button, PageHeader } from "../components/ui/Core.jsx";

const GUIDE_SECTIONS = [
  { id: "getting-started", label: "Premiers pas", icon: BookOpen, title: "Prendre NXT5 en main", intro: "Le parcours le plus fiable va du roster à la review, sans sauter la vérification des profils.", path: "/equipes", action: "Voir l’équipe", steps: ["Créer ou rejoindre l’équipe.", "Préparer le roster et lier les comptes.", "Importer une première game.", "Lire les statistiques puis créer une review."] },
  { id: "teams-and-roster", label: "Équipe", icon: Users, title: "Préparer le roster et les accès", intro: "Un profil bien lié évite les historiques vides et les mauvaises attributions de games.", path: "/gestion-equipe", action: "Gérer l’équipe", steps: ["Classer Main Team, Subs et staff.", "Vérifier le rôle et le Riot ID de chaque profil.", "Lier chaque compte NXT5 au bon joueur.", "Contrôler les permissions avant de partager une invitation."] },
  { id: "imports-and-games", label: "Games", icon: Swords, title: "Importer une game proprement", intro: "L’import dépend du JSON NXT5 et de la confirmation du side, des lanes et des profils.", path: "/integration", action: "Ouvrir Games", steps: ["Exporter la game avec la dernière version de NXT5 Importer.", "Charger le JSON et choisir son contexte.", "Confirmer le side et les dix lanes.", "Associer les cinq profils alliés avant validation."] },
  { id: "statistics", label: "Statistiques", icon: BarChart3, title: "Lire les chiffres dans leur contexte", intro: "Compare les rôles, puis utilise la timeline et les objectifs avant de conclure.", path: "/statistiques", action: "Voir les statistiques", steps: ["Choisir une game ou un groupe cohérent.", "Comparer farm, or, dégâts, vision et KP.", "Replacer les écarts dans la timeline.", "Ouvrir la source avant d’écrire une conclusion."] },
  { id: "reviews", label: "Reviews", icon: FileText, title: "Transformer les données en décision", intro: "Une review tranche un problème, fixe un standard et définit une preuve de progression.", path: "/rapports", action: "Ouvrir Review", steps: ["Partir d’une game ou d’un groupe lié.", "Identifier la cause racine et les catches.", "Fixer les timings weakside et strongside.", "Valider le changement sur les prochaines games."] },
  { id: "trends", label: "Tendances", icon: Activity, title: "Détecter les répétitions", intro: "Les tendances servent à confirmer un pattern sur plusieurs games, jamais à juger une action isolée.", path: "/tendances", action: "Voir les tendances", steps: ["Choisir un contexte comparable.", "Contrôler le volume avant le winrate.", "Identifier les rôles et phases récurrents.", "Rouvrir les games sources pour confirmer."] },
  { id: "champion-pool", label: "Champion Pool", icon: Crown, title: "Déclarer les picks réellement jouables", intro: "Le tier décrit la maîtrise actuelle, pas l’envie de jouer le champion.", path: "/draft/pool", action: "Ouvrir le pool", steps: ["Choisir le joueur et son rôle.", "Classer les champions par maîtrise réelle.", "Séparer confiance, situationnel et développement.", "Mettre le pool à jour après les blocs de travail."] },
  { id: "compositions", label: "Compositions", icon: Sparkles, title: "Préparer les drafts", intro: "Construis des plans lisibles à partir des champions réellement disponibles.", path: "/draft/compositions", action: "Ouvrir Compositions", steps: ["Choisir Nos drafts ou Leurs drafts.", "Placer un champion valide par rôle.", "Écrire la condition de jeu de la composition.", "Préparer une variante plutôt que multiplier les scénarios."] },
  { id: "planning", label: "Planning", icon: CalendarDays, title: "Organiser les sessions", intro: "Centralise les disponibilités avant de confirmer Scrim, Match ou Review.", path: "/planning", action: "Ouvrir le planning", steps: ["Choisir la bonne semaine.", "Renseigner les disponibilités.", "Créer les événements d’équipe.", "Contrôler les absences avant confirmation."] },
  { id: "player-profile", label: "Profil", icon: Activity, title: "Suivre un joueur", intro: "Le profil regroupe historique, champions, objectifs et notes de coaching.", path: "/mon-profil", action: "Ouvrir le profil", steps: ["Vérifier le compte lié au profil.", "Lire la synthèse puis l’historique.", "Contrôler champions et matchups.", "Suivre les objectifs dans Coaching."] },
  { id: "permissions-and-account", label: "Permissions", icon: Settings, title: "Comprendre les accès", intro: "Les actions disponibles dépendent du rôle attribué dans l’équipe.", path: "/parametres", action: "Voir les paramètres", steps: ["Vérifier son rôle actuel.", "Gérer son compte dans Paramètres.", "Gérer les rôles depuis Gestion équipe.", "Demander au capitaine si une action reste bloquée."] },
  { id: "troubleshooting", label: "Dépannage", icon: AlertTriangle, title: "Résoudre un problème courant", intro: "Commence par vérifier la source, l’assignation, les droits et la version de l’importer.", path: "/parametres", action: "Ouvrir les paramètres", steps: ["Recharger la page une fois.", "Vérifier la team et le profil actifs.", "Réexporter les anciens JSON si nécessaire.", "Conserver le message exact si le problème revient."] },
];

export default function GuidePage({ route, navigate, onOpenAssistant }) {
  const requestedSection = new URLSearchParams(route?.search || "").get("section") || "getting-started";
  const current = useMemo(() => GUIDE_SECTIONS.find((section) => section.id === requestedSection) || GUIDE_SECTIONS[0], [requestedSection]);
  const CurrentIcon = current.icon;
  const selectSection = (id) => navigate?.(`/guide?section=${encodeURIComponent(id)}`);

  return <div className="min-w-0">
    <PageHeader eyebrow="Guide NXT5" title="Guide d’utilisation" subtitle="Retrouve le parcours complet ou ouvre directement la section citée par l’assistant.">
      <Button icon={MessageCircleQuestion} onClick={() => onOpenAssistant?.(`Aide-moi sur la section ${current.label} du guide.`)}>Question à l’assistant</Button>
    </PageHeader>
    <div className="grid overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/15 xl:grid-cols-[17rem_minmax(0,1fr)]">
      <nav aria-label="Sommaire du guide" className="border-b border-white/10 bg-[#050916]/80 xl:border-b-0 xl:border-r">
        <div className="flex overflow-x-auto p-2 xl:block xl:max-h-[70vh] xl:overflow-y-auto">
          {GUIDE_SECTIONS.map((section, index) => { const Icon = section.icon; const active = section.id === current.id; return <button key={section.id} type="button" onClick={() => selectSection(section.id)} aria-current={active ? "page" : undefined} className={cx("group flex min-h-14 shrink-0 items-center gap-3 rounded-xl px-3 text-left text-sm font-black transition xl:w-full", active ? "bg-cyan-300/[0.1] text-white ring-1 ring-cyan-200/20" : "text-slate-400 hover:bg-white/[0.04] hover:text-white")}><span className={cx("text-[0.6rem] tabular-nums", active ? "text-cyan-100" : "text-slate-600")}>{String(index + 1).padStart(2, "0")}</span><Icon className="h-4 w-4 shrink-0" /><span className="whitespace-nowrap">{section.label}</span></button>; })}
        </div>
      </nav>
      <section className="min-w-0 p-5 sm:p-7 xl:p-10">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-200/20 bg-cyan-400/10 text-cyan-100"><CurrentIcon className="h-5 w-5" /></span><div><Badge tone="cyan">{current.label}</Badge><h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">{current.title}</h2><p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{current.intro}</p></div></div>
          <ol className="mt-8 divide-y divide-white/10 border-y border-white/10">{current.steps.map((step, index) => <li key={step} className="grid gap-3 py-4 sm:grid-cols-[2.5rem_minmax(0,1fr)]"><span className="font-black tabular-nums text-cyan-100/70">{String(index + 1).padStart(2, "0")}</span><p className="text-sm font-bold leading-6 text-slate-100">{step}</p></li>)}</ol>
          <div className="mt-6 flex flex-wrap gap-2"><Button icon={ArrowRight} onClick={() => navigate?.(current.path)}>{current.action}</Button><Button variant="ghost" icon={MessageCircleQuestion} onClick={() => onOpenAssistant?.(`Explique-moi la section ${current.label} du guide.`)}>Poser une question</Button></div>
        </div>
      </section>
    </div>
  </div>;
}
