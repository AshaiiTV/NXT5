import React, { useState } from "react";
import { Activity, ArrowRight, BarChart3, Check, ChevronRight, Crown, Eye, FileText, Flame, Gauge, Loader2, Lock, Mail, Shield, Swords, Target, Upload, UserPlus, Users } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { DISCORD_INVITE_URL } from "../../app/constants.jsx";
import { cx, errorToast, readRememberPreference, tone, writeRememberPreference } from "../../app/helpers.js";
import { isSafeInternalPath } from "../../app/routing.js";
import { BrandLogo, Nxt5Wordmark, ResponsiveImage, RoleIcon } from "../../components/brand/BrandAssets.jsx";
import { AmbientBackground } from "../../components/layout/AppChrome.jsx";
import { Badge, Button, PremiumToggle, Surface, TextInput } from "../../components/ui/Core.jsx";
function MarketingPreview() {
  const metrics = [
    [Upload, "Intégration", "Importer les games"],
    [BarChart3, "Statistiques", "Lire le 5v5"],
    [Crown, "Compos", "Préparer le draft"],
    [FileText, "Review", "Structurer la review"],
  ];
  const lanes = [["TOP", "Pool"], ["JGL", "Tempo"], ["MID", "Setup"], ["ADC", "DPS"], ["SUP", "Vision"]];
  const axes = ["Vision", "Objectifs neutres", "Gold diff", "Builds"];

  return (
    <div className="nxt5-enter relative hidden lg:block">
      <div className="absolute -inset-6 rounded-[1.6rem] bg-gradient-to-r from-cyan-400/34 via-blue-500/18 to-fuchsia-500/30 blur-2xl" />
      <div className="nxt5-panel nxt5-premium-panel relative overflow-hidden border border-cyan-200/25 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-2xl">
        <div className="relative z-10 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <BrandLogo compact />
          <div className="text-right">
            <p className="text-sm font-black text-white">Command center</p>
            <p className="text-[0.66rem] font-black uppercase tracking-[0.2em] text-cyan-100/75">Draft · Review · Stats</p>
          </div>
        </div>
        <div className="relative z-10 mt-4 grid grid-cols-4 gap-3">
          {metrics.map(([Icon, label, text]) => (
            <div key={label} className="nxt5-panel relative overflow-hidden border border-white/10 bg-white/[0.045] p-4">
              <Icon className="h-5 w-5 text-cyan-100 drop-shadow-[0_0_12px_rgba(34,211,238,.45)]" />
              <p className="mt-3 text-sm font-black text-white">{label}</p>
              <p className="mt-1 text-[0.68rem] font-black uppercase tracking-[0.13em] text-slate-300">{text}</p>
            </div>
          ))}
        </div>
        <div className="relative z-10 mt-4 grid grid-cols-[.86fr_1.14fr] gap-4">
          <div className="nxt5-panel border border-white/10 bg-black/[0.20] p-4">
            <p className="font-black text-white">Lecture 5v5</p>
            <p className="text-xs font-semibold text-slate-300">Blue side à gauche, red side à droite.</p>
            <div className="mt-4 space-y-2">
              {lanes.map(([role, focus], i) => (
                <div key={role} className="grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
                  <RoleIcon role={role} className="h-5 w-5" />
                  <span className="text-sm font-black text-white">{role}</span>
                  <Badge tone={i % 2 ? "purple" : "cyan"}>{focus}</Badge>
                </div>
              ))}
            </div>
          </div>
          <div className="nxt5-panel border border-white/10 bg-white/[0.04] p-4">
            <p className="font-black text-white">Données prêtes à lire</p>
            <p className="text-xs font-semibold text-slate-300">Le site expose les infos. Le coach garde l’interprétation.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {axes.map((a, i) => <div key={a} className="rounded-2xl border border-cyan-100/12 bg-black/[0.18] p-3"><div className={cx("mb-3 inline-flex rounded-xl border p-2", tone(i === 0 ? "cyan" : i === 1 ? "purple" : i === 2 ? "green" : "yellow"))}>{i === 0 ? <Eye className="h-4 w-4" /> : i === 1 ? <Target className="h-4 w-4" /> : i === 2 ? <Gauge className="h-4 w-4" /> : <Swords className="h-4 w-4" />}</div><p className="text-sm font-black text-white">{a}</p></div>)}
            </div>
          </div>
        </div>
        <div className="relative z-10 mt-4 overflow-hidden rounded-2xl border border-cyan-200/16 bg-[#020511]/50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-black text-white">Workflow NXT5</p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-100/75">Importer → assigner → analyser → review</p>
            </div>
            <Badge tone="pink">Next five</Badge>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {["JSON", "ROSTER", "STATS", "REPORT"].map((step, i) => <div key={step} className="relative rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3 text-center text-[0.66rem] font-black tracking-[0.16em] text-white"><span className="block text-cyan-100/75">0{i + 1}</span>{step}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatStrip() {
  const stats = [
    [Crown, "Champion Pool", "Picks forts et picks pièges", "cyan"],
    [Swords, "Games importées", "KDA, dégâts, vision, objectifs", "purple"],
    [Target, "Axes de progrès", "Ce qu’il faut travailler", "green"],
    [Eye, "Vision & setup", "Avant dragons et Nashor", "blue"],
    [Flame, "Progression", "Game après game", "yellow"],
  ];
  return (
    <div className="nxt5-panel grid gap-3 border border-cyan-200/14 bg-[#050914]/72 p-4 shadow-[0_0_42px_rgba(34,211,238,.08)] backdrop-blur-2xl md:grid-cols-5">
      {stats.map(([Icon, value, label, t]) => <div key={value} className="flex items-center gap-3 border-white/10 p-3 transition hover:bg-white/[0.035] md:[&:not(:last-child)]:border-r"><div className={cx("rounded-2xl border p-3 shadow-[0_0_22px_rgba(34,211,238,.08)]", tone(t))}><Icon className="h-5 w-5" /></div><div className="min-w-0"><p className="text-sm font-black text-white">{value}</p><p className="text-xs font-bold text-slate-300">{label}</p></div></div>)}
    </div>
  );
}

function LinkButton({ href, children, icon: Icon, variant = "primary", className = "", navigate }) {
  const base = "nxt5-cyber-button inline-flex min-w-0 max-w-full items-center justify-center gap-2 whitespace-normal px-4 py-2.5 text-center text-sm font-black leading-5 transition duration-200 active:translate-y-0";
  const variants = {
    primary: "border border-cyan-100/36 bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500 text-white shadow-[0_0_30px_rgba(34,211,238,.32)] hover:-translate-y-0.5 hover:saturate-150 hover:shadow-[0_0_46px_rgba(217,70,239,.28)]",
    ghost: "border border-cyan-100/16 bg-[#071221]/72 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] hover:-translate-y-0.5 hover:border-cyan-200/45 hover:bg-cyan-300/[0.11]",
  };

  function go(event) {
    if (!navigate || !isSafeInternalPath(href)) return;
    event.preventDefault();
    navigate(href);
  }

  return <a href={href} onClick={go} className={cx(base, variants[variant], className)}>{Icon && <Icon className="h-4 w-4 shrink-0" />}<span className="min-w-0 break-words">{children}</span></a>;
}

function SiteHeader({ children, navigate }) {
  function goHome(event) {
    if (!navigate) return;
    event.preventDefault();
    navigate("/");
  }

  return (
    <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5">
      <a href="/" onClick={goHome} aria-label="Accueil NXT5" className="transition hover:opacity-90"><BrandLogo /></a>
      {children && <div className="nxt5-panel relative flex shrink-0 items-center gap-3 border border-cyan-200/12 bg-[#050914]/62 p-1.5 shadow-[0_0_32px_rgba(34,211,238,.08)] backdrop-blur-2xl">{children}</div>}
    </header>
  );
}

export function LegalLinks({ navigate }) {
  const links = [
    ["/mentions-legales", "Mentions légales"],
    ["/confidentialite", "Confidentialité"],
    ["/conditions", "Conditions"],
    ["/contact", "Contact"],
  ];
  return <footer className="relative z-10 mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-5 py-8 text-xs font-bold text-slate-300">{links.map(([href, label]) => <LinkButton key={href} href={href} navigate={navigate} variant="ghost" className="border-transparent bg-transparent px-0 py-0 text-xs text-slate-300 shadow-none hover:translate-y-0 hover:border-transparent hover:bg-transparent hover:text-cyan-100">{label}</LinkButton>)}<span className="text-slate-300">NXT5 n’est pas affilié à Riot Games.</span></footer>;
}

export const LEGAL_PAGES = {
  "/mentions-legales": {
    eyebrow: "Cadre légal",
    title: "Mentions légales",
    intro: "NXT5 est une plateforme indépendante destinée aux équipes League of Legends souhaitant organiser leurs profils, matchs, compositions, données d’import et reviews.",
    sections: [
      ["Éditeur du service", "Le service NXT5 est édité et maintenu par l’exploitant du projet NXT5. Les demandes relatives au service peuvent être adressées via les moyens de contact mis à disposition dans l’application ou sur les canaux officiels du projet."],
      ["Objet du site", "NXT5 propose des outils de gestion d’équipe, d’import de matchs, de consultation statistique, de préparation de compositions, de champion pool, de planning et de rédaction de reviews. Le service est réservé à un usage d’organisation, d’analyse et de suivi sportif par les utilisateurs autorisés."],
      ["Hébergement", "Le site est hébergé par Netlify, Inc., 44 Montgomery Street, Suite 300, San Francisco, California 94104, États-Unis. Certains services techniques nécessaires au fonctionnement de l’application peuvent être opérés par des prestataires tiers spécialisés dans l’hébergement, la base de données, l’envoi d’e-mails transactionnels ou l’accès aux API utilisées par le service."],
      ["Propriété intellectuelle", "L’interface, l’identité NXT5, les textes, structures de pages et éléments propres au service sont protégés par les règles applicables à la propriété intellectuelle. Toute reproduction, extraction ou réutilisation substantielle sans autorisation préalable est interdite, sauf usage strictement personnel dans le cadre normal du service."],
      ["Riot Games", "NXT5 n’est pas approuvé, sponsorisé, validé ni affilié à Riot Games. League of Legends, Riot Games et les éléments associés appartiennent à Riot Games, Inc. Les données issues de l’écosystème Riot sont utilisées dans le respect des conditions applicables aux développeurs et uniquement pour les fonctionnalités proposées aux équipes."],
      ["Responsabilité", "NXT5 met à disposition des outils de consultation et d’organisation. Les décisions sportives, choix de draft, interprétations de données, reviews, contenus et usages effectués par les équipes relèvent de la responsabilité exclusive des utilisateurs concernés."],
      ["Mise à jour", "Les présentes mentions peuvent être modifiées afin de tenir compte de l’évolution du service, de ses fonctionnalités ou du cadre réglementaire applicable. Dernière mise à jour : 27 mai 2026."],
    ],
  },
  "/confidentialite": {
    eyebrow: "Données",
    title: "Politique de confidentialité",
    intro: "Cette politique explique comment NXT5 traite les données nécessaires au fonctionnement du service. Elle vise à fournir une information claire, accessible et proportionnée aux usages réels de la plateforme.",
    sections: [
      ["Responsable du traitement", "Le responsable du traitement est l’exploitant du service NXT5. Les demandes relatives aux données personnelles peuvent être adressées via les moyens de contact disponibles dans l’application ou sur les canaux officiels du projet."],
      ["Données traitées", "NXT5 peut traiter les informations de compte, les adresses e-mail, les pseudonymes, les rôles, les équipes, les profils joueurs, les Riot IDs, les liens de profil, les disponibilités, les compositions, les champion pools, les reviews, les matchs importés et les statistiques associées."],
      ["Finalités", "Ces données sont utilisées pour créer et sécuriser les comptes, gérer les équipes, permettre la collaboration entre membres, importer et consulter des matchs, produire des tableaux statistiques, préparer des compositions, organiser les disponibilités et conserver un historique utile aux reviews."],
      ["Base juridique", "Les traitements reposent principalement sur l’exécution du service demandé par l’utilisateur, l’intérêt légitime à maintenir un outil fiable et sécurisé, ainsi que le consentement lorsque l’utilisateur fournit volontairement certaines informations ou active certaines fonctionnalités."],
      ["Données de jeu", "Les données liées à League of Legends peuvent provenir d’informations saisies par les utilisateurs, de fichiers importés, de profils publics, d’OP.GG ou des API Riot lorsque l’accès est disponible. Elles sont utilisées pour alimenter les fonctionnalités NXT5 et ne constituent pas une notation officielle des joueurs."],
      ["Destinataires", "Les données sont accessibles aux membres autorisés d’une équipe selon leur rôle. Elles peuvent également être traitées par les prestataires techniques nécessaires au fonctionnement du service, dans la limite de leurs missions respectives."],
      ["Sécurité", "NXT5 applique des mesures techniques et organisationnelles raisonnables afin de limiter les accès non autorisés, les pertes de données et les usages détournés. Aucune page publique ne détaille les mécanismes internes afin de ne pas affaiblir la protection du service."],
      ["Cookies et sessions", "NXT5 utilise des cookies strictement nécessaires à la connexion, au maintien de session et au fonctionnement normal de l’application. Ces cookies ne sont pas destinés au suivi publicitaire."],
      ["Conservation", "Les données sont conservées tant qu’elles sont utiles au fonctionnement de l’équipe ou du compte concerné. Les utilisateurs autorisés peuvent supprimer certains contenus depuis l’interface. Des journaux techniques limités peuvent être conservés pour assurer la stabilité, la sécurité et la traçabilité du service."],
      ["Droits des personnes", "Conformément au RGPD, les utilisateurs peuvent demander l’accès, la rectification, l’effacement ou la limitation du traitement de leurs données lorsque ces droits sont applicables. Une demande peut être formulée via les moyens de contact disponibles pour le service."],
      ["Réclamation", "Si un utilisateur estime que ses droits ne sont pas respectés, il peut contacter l’exploitant du service. Il peut également saisir l’autorité de contrôle compétente en matière de protection des données personnelles."],
    ],
  },
  "/conditions": {
    eyebrow: "Utilisation",
    title: "Conditions d’utilisation",
    intro: "Les présentes conditions encadrent l’utilisation de NXT5. En accédant au service, l’utilisateur accepte de l’utiliser de manière loyale, raisonnable et conforme à sa finalité esportive.",
    sections: [
      ["Accès au service", "NXT5 est accessible aux utilisateurs disposant d’un compte et, pour certaines fonctionnalités, d’une équipe active. Les droits d’accès varient selon le rôle attribué au sein de l’équipe : joueur, capitaine, coach, manager, analyste ou autre rôle autorisé."],
      ["Usage autorisé", "Le service doit être utilisé pour organiser une équipe, importer des matchs, consulter des statistiques, préparer des champion pools, construire des compositions, gérer les disponibilités et rédiger des reviews liees à League of Legends."],
      ["Comptes et responsabilités", "Chaque utilisateur est responsable de l’exactitude des informations qu’il renseigne, de la confidentialité de ses identifiants et des actions réalisées depuis son compte. Les administrateurs d’équipe doivent attribuer les accès avec prudence."],
      ["Contenus d’équipe", "Les reviews, notes, noms de groupes, compositions, profils et autres contenus ajoutés dans NXT5 sont créés par les utilisateurs. L’équipe reste responsable de leur exactitude, de leur pertinence et de leur conformité aux règles applicables."],
      ["Imports de matchs", "Les Game IDs, fichiers JSON et imports de matchs doivent correspondre à des parties réelles ou légitimement accessibles par l’équipe. L’utilisateur s’engage à ne pas importer de données dans le but de nuire, d’usurper, de surveiller abusivement ou de détourner le service."],
      ["Comportements interdits", "Il est interdit de tenter de contourner les droits d’accès, de perturber le service, d’extraire massivement des données, de publier des contenus illicites, injurieux ou discriminatoires, ou d’utiliser NXT5 pour harceler, cibler ou porter atteinte à d’autres joueurs."],
      ["Données et API tierces", "Certaines fonctionnalités dépendent de données ou services tiers, notamment l’écosystème Riot, des profils publics ou des outils d’import. NXT5 ne garantit pas l’exhaustivité, la disponibilité permanente ou l’absence d’erreur de ces sources externes."],
      ["Disponibilité", "Le service est fourni en l’état et peut évoluer, être interrompu, limité ou modifié pour des raisons techniques, de maintenance, de sécurité, de conformité ou de dépendance à des prestataires externes."],
      ["Limitation de responsabilité", "NXT5 est un outil d’aide à la lecture et à l’organisation. Il ne remplace pas le jugement d’un coach, d’un capitaine ou d’un joueur. Les choix sportifs, décisions d’équipe et interprétations des données restent sous la responsabilité des utilisateurs."],
      ["Évolution des conditions", "Les présentes conditions peuvent être mises à jour afin de suivre l’évolution du service. Dernière mise à jour : 27 mai 2026."],
    ],
  },
  "/contact": {
    eyebrow: "Support",
    title: "Contact",
    intro: "Besoin d’aide, de signaler un souci ou de rejoindre la communauté NXT5 ? Le point de contact principal est le serveur Discord officiel.",
    sections: [
      ["Discord NXT5", "Le serveur Discord permet de centraliser les retours, les bugs, les idées de fonctionnalités et les demandes d’aide autour de NXT5. C’est le canal à privilégier pour obtenir une réponse rapide."],
      ["Support produit", "Pour un problème technique, indique la page concernée, l’action réalisée, le message d’erreur affiché et, si possible, le contexte de l’équipe ou de l’import. Plus le signalement est précis, plus il peut être corrigé vite."],
      ["Sécurité et données", "Pour une demande sensible liée à un compte, une équipe, des données ou un accès, évite de publier des informations privées dans un salon public. Utilise un canal privé ou un échange direct avec l’équipe NXT5 lorsque c’est nécessaire."],
    ],
    contact: true,
  },
};

export function LegalPage({ route, navigate, user }) {
  const page = LEGAL_PAGES[route.path] || LEGAL_PAGES["/mentions-legales"];
  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <AmbientBackground />
      <SiteHeader navigate={navigate}>
        {user ? (
          <LinkButton href="/equipes" navigate={navigate} icon={ArrowRight}>Retour à l’app</LinkButton>
        ) : (
          <>
            <LinkButton href="/connexion" navigate={navigate} variant="ghost" className="hidden md:inline-flex">Se connecter</LinkButton>
            <LinkButton href="/creer-un-compte" navigate={navigate}>Créer un compte</LinkButton>
          </>
        )}
      </SiteHeader>
      <main className="relative z-10 mx-auto max-w-5xl px-5 pb-12 pt-6">
        <Surface glow className="p-6 md:p-9">
          <Badge tone="orange">{page.eyebrow}</Badge>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-6xl">{page.title}</h1>
          <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-slate-200">{page.intro}</p>
          <div className="mt-8 grid gap-4">
            {page.sections.map(([title, text]) => <section key={title} className="rounded-2xl border border-white/12 bg-black/[0.24] p-5 md:p-6"><h2 className="text-2xl font-black text-white">{title}</h2><p className="mt-3 text-base font-semibold leading-8 text-slate-200">{text}</p></section>)}
          </div>
          {page.contact && <div className="mt-8 rounded-[1.35rem] border border-cyan-300/18 bg-cyan-400/[0.07] p-5 shadow-[0_0_34px_rgba(34,211,238,.10)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div><Badge tone="purple">Discord</Badge><h2 className="mt-3 text-2xl font-black text-white">Rejoindre le serveur NXT5</h2><p className="mt-2 text-sm font-semibold leading-6 text-slate-200">{DISCORD_INVITE_URL ? "Ouvre Discord pour contacter le support ou rejoindre la communauté." : "Le bouton est prêt. Il manque juste le lien d’invitation Discord final."}</p></div>
              {DISCORD_INVITE_URL ? <a href={DISCORD_INVITE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-200/35 bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(34,211,238,.25)] transition hover:-translate-y-0.5 hover:bg-white"><Users className="h-4 w-4" />Ouvrir Discord</a> : <button type="button" disabled className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-slate-400"><Users className="h-4 w-4" />Discord à connecter</button>}
            </div>
          </div>}
          <div className="mt-8 flex flex-wrap gap-3">
            {user ? (
              <LinkButton href="/equipes" navigate={navigate} icon={ArrowRight}>Retour à l’app</LinkButton>
            ) : (
              <>
                <LinkButton href="/" navigate={navigate} variant="ghost">Retour accueil</LinkButton>
                <LinkButton href="/connexion" navigate={navigate} icon={Lock}>Connexion</LinkButton>
              </>
            )}
          </div>
        </Surface>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}

export function HomeScreen({ navigate }) {
  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <AmbientBackground />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(112deg,rgba(0,216,255,.18),transparent_24%,transparent_70%,rgba(217,0,255,.14)),linear-gradient(180deg,transparent_0%,rgba(2,5,17,.42)_78%)]" />
      <SiteHeader navigate={navigate}>
        <LinkButton href="/connexion" navigate={navigate} variant="ghost" className="hidden md:inline-flex">Se connecter</LinkButton>
        <LinkButton href="/creer-un-compte" navigate={navigate} className="px-3 py-2.5 sm:px-4">Créer un compte</LinkButton>
      </SiteHeader>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-3 pb-12 sm:px-5 sm:pb-16">
        <section className="grid min-h-[calc(100vh-104px)] items-start gap-7 py-4 lg:grid-cols-[.78fr_1.22fr] lg:py-6 xl:items-center">
          <div className="nxt5-enter">
            <ResponsiveImage src="/assets/nxt5-logo.png" sources={[{ srcSet: "/assets/nxt5-logo-640.webp 640w, /assets/nxt5-logo-320.webp 320w" }]} alt="NXT5" width="1254" height="989" fetchPriority="high" decoding="async" className="mb-4 h-auto w-full max-w-[300px] object-contain object-left drop-shadow-[0_0_42px_rgba(34,211,238,.30)] sm:max-w-[340px] xl:max-w-[380px]" />
            <Badge tone="cyan" pulse>Outil d'équipe League of Legends</Badge>
            <h1 className="mt-4 max-w-4xl text-4xl font-black leading-[1.02] tracking-tight text-white sm:text-5xl md:text-6xl">
              Comprends ton <span className="bg-gradient-to-r from-cyan-100 via-cyan-300 to-blue-400 bg-clip-text text-transparent drop-shadow-[0_0_26px_rgba(34,211,238,.32)]">équipe</span> sans te perdre dans les <span className="bg-gradient-to-r from-white via-cyan-200 to-fuchsia-300 bg-clip-text text-transparent drop-shadow-[0_0_28px_rgba(217,70,239,.24)]">stats</span>.
            </h1>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-200 md:text-lg">NXT5 transforme tes games en une lecture claire : qui porte l'équipe, comment vous gagnez, ce qui vous fait perdre et quoi corriger au prochain bloc.</p>
            <div className="mt-4 grid max-w-2xl gap-3 sm:grid-cols-3">
              {["Crée la team", "Importe les games", "Lis les tendances"].map((label, index) => <div key={label} className="nxt5-panel border border-cyan-200/14 bg-white/[0.035] px-4 py-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-cyan-100/75">0{index + 1}</p><p className="mt-1 text-sm font-black text-white">{label}</p></div>)}
            </div>
            <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap">
              <LinkButton href="/creer-un-compte" navigate={navigate} icon={ChevronRight} className="px-6 py-4 sm:px-7">Créer un compte</LinkButton>
              <LinkButton href="/connexion" navigate={navigate} variant="ghost" className="px-6 py-4 sm:px-7">Se connecter</LinkButton>
            </div>
          </div>
          <MarketingPreview />
        </section>

        <section id="features" className="mt-4">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <Badge tone="purple">Ce que tu fais avec NXT5</Badge>
              <h2 className="nxt5-metal-text mt-3 text-3xl font-black md:text-4xl">Un parcours simple, puis des outils puissants</h2>
            </div>
            <p className="max-w-2xl text-sm font-semibold leading-6 text-slate-300">Le premier usage reste guidé. Les analyses avancées arrivent ensuite, quand la team a assez de games.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: Users, title: "Pose le roster", text: "Crée la team, ajoute les joueurs et relie les profils. NXT5 sait ensuite à qui appartient chaque donnée.", t: "cyan" },
            { icon: Swords, title: "Ajoute les games", text: "Importe une game ou un bloc de scrim. Le site garde le side, les champions, les objectifs et les stats importantes.", t: "purple" },
            { icon: Activity, title: "Comprends le collectif", text: "Tendances explique comment l'équipe fonctionne : condition de victoire, rôles moteurs, tempo et fail states.", t: "green" },
          ].map((item, i) => { const Icon = item.icon; return <Surface key={item.title} delay={i * .06} glow><div className={cx("mb-5 inline-flex rounded-2xl border p-4", tone(item.t))}><Icon className="h-7 w-7" /></div><h3 className="text-xl font-black text-white">{item.title}</h3><p className="mt-3 text-base font-medium leading-7 text-slate-300">{item.text}</p></Surface>; })}
          </div>
        </section>

        <section id="analytics" className="nxt5-panel nxt5-premium-panel relative mt-14 overflow-hidden border border-cyan-200/18 p-6 shadow-2xl shadow-black/25 md:p-9">
          <div className="mb-8 text-center"><h2 className="text-3xl font-black text-white md:text-4xl">Du match à la review</h2><p className="mt-3 text-base font-semibold text-slate-300">NXT5 met les données au clair pour que joueurs, coachs et capitaines fassent leur propre lecture.</p></div>
          <div className="grid gap-5 md:grid-cols-4">
            {[["1", Swords, "Importe la game", "Le match devient une fiche lisible avec champions, side, patch et objectifs."], ["2", Eye, "Lis les signaux", "Vision, dégâts, gold, KDA, KP et morts exposées ressortent sans fouiller."], ["3", Crown, "Trie les picks", "Le Champion Pool révèle les picks fiables, situationnels et dangereux."], ["4", Target, "Prépare le prochain match", "La review reste un support de lecture pour le coach et les joueurs."]].map(([n, Icon, title, text]) => <div key={n} className="nxt5-panel relative border border-cyan-100/14 bg-black/[0.24] p-5 transition hover:-translate-y-1 hover:border-cyan-200/28"><Badge tone={n === "1" ?"cyan" : "purple"}>{n}</Badge><div className="mt-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-100"><Icon className="h-5 w-5" /></div><h3 className="mt-5 text-lg font-black text-white">{title}</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{text}</p></div>)}
          </div>
          <div className="mt-8 flex justify-center"><LinkButton href="/creer-un-compte" navigate={navigate} icon={ArrowRight} className="px-7 py-4">Créer l’espace équipe</LinkButton></div>
        </section>

        <section className="mt-10"><StatStrip /></section>

        <section className="mt-14">
          <Surface glow>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge tone="cyan">Review ready</Badge>
                <h2 className="nxt5-metal-text mt-3 text-3xl font-black md:text-4xl">Pensé pour les reviews qui changent quelque chose</h2>
              </div>
              <Nxt5Wordmark className="h-12 w-48 object-right opacity-90" />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {["Comparer les champions joués et leur volume.", "Lire rapidement les écarts de stats d’équipe.", "Générer une review exploitable par le staff.", "Préparer la prochaine session avec les données visibles."].map((item, index) => <div key={item} className="nxt5-panel flex items-center gap-3 border border-white/10 bg-white/[0.035] p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-200/18 bg-cyan-400/10 text-xs font-black text-cyan-100">0{index + 1}</span><Check className="h-5 w-5 shrink-0 text-emerald-300" /><span className="font-bold text-slate-200">{item}</span></div>)}
            </div>
          </Surface>
        </section>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}

export function NotFoundPage({ navigate }) {
  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <AmbientBackground />
      <SiteHeader navigate={navigate}>
        <LinkButton href="/connexion" navigate={navigate} variant="ghost" className="hidden md:inline-flex">Se connecter</LinkButton>
        <LinkButton href="/creer-un-compte" navigate={navigate}>Créer un compte</LinkButton>
      </SiteHeader>
      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-108px)] w-full max-w-4xl items-center justify-center px-3 pb-12 text-center sm:px-5 sm:pb-16">
        <Surface glow className="w-full">
          <Badge tone="red">404</Badge>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-6xl">Page introuvable</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-7 text-slate-300">Cette URL ne correspond à aucune page NXT5. Reviens à l’accueil ou connecte-toi pour accéder à ton espace.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <LinkButton href="/" navigate={navigate} variant="ghost">Retour accueil</LinkButton>
            <LinkButton href="/connexion" navigate={navigate} icon={Lock}>Connexion</LinkButton>
          </div>
        </Surface>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}

export function ForgotPasswordPage({ navigate }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      await apiFetch("auth-request-password-reset", { method: "POST", body: JSON.stringify({ email }) });
      setMessage("Si cet e-mail correspond à un compte NXT5, un lien de réinitialisation vient d’être envoyé. Il expire dans 30 minutes.");
      setEmail("");
    } catch (err) {
      if (err?.code === "EMAIL_NOT_CONFIGURED") {
        setError("L’envoi d’e-mail n’est pas encore configuré sur Netlify. Ajoute RESEND_API_KEY et RESET_EMAIL_FROM.");
      } else {
        setError(err.message || "Demande impossible.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <AmbientBackground />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(112deg,rgba(217,70,239,.14),transparent_28%,transparent_67%,rgba(34,211,238,.12))]" />
      <SiteHeader navigate={navigate}>
        <LinkButton href="/connexion" navigate={navigate} variant="ghost" className="hidden md:inline-flex">Connexion</LinkButton>
      </SiteHeader>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-108px)] max-w-4xl items-center px-5 pb-16">
        <Surface glow className="mx-auto w-full max-w-2xl">
          <Badge tone="yellow">Sécurité du compte</Badge>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-5xl">Mot de passe oublié</h1>
          <p className="mt-5 text-base font-semibold leading-8 text-slate-200">Entre l’e-mail de ton compte. NXT5 t’envoie un lien temporaire pour choisir un nouveau mot de passe.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <TextInput label="E-mail du compte" value={email} onChange={setEmail} placeholder="joueur@exemple.com" type="email" required icon={Mail} />
            {message && <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-100">{message}</div>}
            {error && <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm font-bold text-rose-100">{error}</div>}
            <Button type="submit" disabled={loading || !email.trim()} icon={loading ?Loader2 : Mail} className="w-full py-4">{loading ?"Envoi..." : "Envoyer le lien"}</Button>
          </form>
          <div className="mt-7 flex flex-wrap gap-3">
            <LinkButton href="/connexion" navigate={navigate} icon={Lock}>Retour connexion</LinkButton>
            <LinkButton href="/creer-un-compte" navigate={navigate} variant="ghost" icon={UserPlus}>Créer un compte</LinkButton>
          </div>
        </Surface>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}

export function ResetPasswordPage({ navigate }) {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [form, setForm] = useState({ nextPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (form.nextPassword !== form.confirmPassword) {
      setError("La confirmation ne correspond pas.");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("auth-reset-password", { method: "POST", body: JSON.stringify({ token, nextPassword: form.nextPassword }) });
      setDone(true);
      setForm({ nextPassword: "", confirmPassword: "" });
    } catch (err) {
      setError(err.message || "Réinitialisation impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <AmbientBackground />
      <SiteHeader navigate={navigate}>
        <LinkButton href="/connexion" navigate={navigate} variant="ghost" className="hidden md:inline-flex">Connexion</LinkButton>
      </SiteHeader>
      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-108px)] max-w-4xl items-center px-5 pb-16">
        <Surface glow className="mx-auto w-full max-w-2xl">
          <Badge tone="green">Nouveau mot de passe</Badge>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-5xl">Réinitialiser le mot de passe</h1>
          {!token ? (
            <div className="mt-6 rounded-2xl border border-rose-300/25 bg-rose-500/10 p-4 text-sm font-bold text-rose-100">Lien invalide : aucun token de réinitialisation.</div>
          ) : done ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">Mot de passe mis à jour. Tu peux te reconnecter.</div>
              <LinkButton href="/connexion" navigate={navigate} icon={Lock}>Retour connexion</LinkButton>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <TextInput label="Nouveau mot de passe" value={form.nextPassword} onChange={(nextPassword) => setForm((current) => ({ ...current, nextPassword }))} placeholder="8 caractères minimum" type="password" required icon={Shield} />
              <TextInput label="Confirmer" value={form.confirmPassword} onChange={(confirmPassword) => setForm((current) => ({ ...current, confirmPassword }))} placeholder="Répète le nouveau mot de passe" type="password" required icon={Check} />
              {error && <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm font-bold text-rose-100">{error}</div>}
              <Button type="submit" disabled={loading || !form.nextPassword || !form.confirmPassword} icon={loading ?Loader2 : Shield} className="w-full py-4">{loading ?"Mise à jour..." : "Changer le mot de passe"}</Button>
            </form>
          )}
        </Surface>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}

export function AuthPage({ mode, onAuth, pushToast, navigate }) {
  const isRegister = mode === "register";
  const [form, setForm] = useState({ email: "", displayName: "", password: "" });
  const [rememberMe, setRememberMe] = useState(readRememberPreference);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const querySuffix = window.location.search || "";

  function patch(key, value) { setForm((current) => ({ ...current, [key]: value })); }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const endpoint = isRegister ?"auth-register" : "auth-login";
      const body = { accountName: form.email, email: form.email, displayName: form.displayName, password: form.password, rememberMe };
      const result = await apiFetch(endpoint, { method: "POST", body: JSON.stringify(body) });
      writeRememberPreference(rememberMe);
      pushToast({ type: "green", title: isRegister ?"Compte créé" : "Connexion réussie", text: "Bienvenue sur NXT5." });
      const params = new URLSearchParams(window.location.search);
      const hasInvite = params.has("invite");
      const next = params.get("next");
      const destination = hasInvite
        ?`/equipes?invite=${encodeURIComponent(params.get("invite"))}`
        : isSafeInternalPath(next)
          ?next
          : isRegister
            ?"/equipes?create=1"
            : "/equipes";
      navigate(destination, { replace: true });
      onAuth(result.user);
    } catch (err) {
      if (err?.code === "DB_NOT_CONFIGURED") {
        setError("La création de compte n’est pas encore active. Le site doit être terminé côté déploiement.");
      } else {
        setError(err.message || (isRegister ?"Inscription impossible." : "Connexion impossible."));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <AmbientBackground />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(112deg,rgba(217,70,239,.14),transparent_28%,transparent_67%,rgba(34,211,238,.12))]" />
      <SiteHeader navigate={navigate}>
        <LinkButton href={isRegister ?`/connexion${querySuffix}` : `/creer-un-compte${querySuffix}`} navigate={navigate} variant="ghost" className="hidden md:inline-flex">
          {isRegister ?"J’ai déjà un compte" : "Créer un compte"}
        </LinkButton>
      </SiteHeader>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-108px)] w-full max-w-7xl items-center gap-8 px-3 pb-12 sm:px-5 sm:pb-16 lg:grid-cols-[.85fr_1.15fr]">
        <div className="nxt5-enter">
          <Badge tone={isRegister ?"purple" : "cyan"} pulse>{isRegister ?"Création de compte" : "Connexion"}</Badge>
          <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[0.96] tracking-[-0.055em] md:text-7xl">
            {isRegister ?"Crée ton espace NXT5." : "Retourne dans ton espace NXT5."}
          </h1>
          <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-slate-300 md:text-lg">
            {isRegister
              ?"Ajoute ton e-mail, choisis ton pseudo, puis lance ton espace équipe."
              : "Connecte-toi pour retrouver tes teams, tes imports et tes reviews."}
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[[BarChart3, "Profil de jeu"], [Shield, "Draft & rôles"], [Users, "Progression team" ]].map(([Icon, label], index) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><Icon className={cx("h-5 w-5", index === 0 ? "text-cyan-200" : "text-cyan-200")} /><p className="mt-3 text-sm font-black text-white">{label}</p></div>)}
          </div>
        </div>

        <Surface glow className="mx-auto w-full max-w-xl">
          <h2 className="text-3xl font-black text-white">{isRegister ?"Créer un compte" : "Connexion"}</h2>
          <p className="mt-2 text-base font-medium text-slate-300">{isRegister ?"Ton e-mail sert à te connecter et à récupérer ton compte." : "Entre ton e-mail et ton mot de passe pour accéder au tableau de bord."}</p>
          <div className="mt-5 flex rounded-2xl border border-white/10 bg-black/[0.18] p-1">
            <a href={`/connexion${querySuffix}`} className={cx("flex-1 rounded-xl px-4 py-3 text-center text-sm font-black transition", !isRegister ?"bg-white/10 text-white" : "text-slate-300 hover:text-white")}>Connexion</a>
            <a href={`/creer-un-compte${querySuffix}`} className={cx("flex-1 rounded-xl px-4 py-3 text-center text-sm font-black transition", isRegister ?"bg-white/10 text-white" : "text-slate-300 hover:text-white")}>Créer un compte</a>
          </div>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <TextInput label={isRegister ? "E-mail" : "E-mail ou ancien pseudo"} value={form.email} onChange={(v) => patch("email", v)} placeholder={isRegister ? "joueur@exemple.com" : "joueur@exemple.com ou ancien pseudo"} type={isRegister ? "email" : "text"} required icon={Mail} />
            {isRegister && <TextInput label="Pseudo" value={form.displayName} onChange={(v) => patch("displayName", v)} placeholder="Ex : Joueur NXT5" required icon={UserPlus} />}
            <TextInput label="Mot de passe" value={form.password} onChange={(v) => patch("password", v)} placeholder="••••••••" type="password" required icon={Lock} />
            <PremiumToggle checked={rememberMe} onChange={setRememberMe} title="Rester connecté" text="Garde cette session active plus longtemps sur cet appareil." />
            {error && <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm font-bold text-rose-100">{error}</div>}
            <Button type="submit" disabled={loading} icon={loading ?Loader2 : isRegister ?UserPlus : Lock} className="w-full py-4">{loading ?"Chargement…" : isRegister ?"Créer le compte" : "Entrer dans NXT5"}</Button>
          </form>
          {!isRegister && <div className="mt-4 text-center"><a className="text-sm font-black text-cyan-200 transition hover:text-white" href="/mot-de-passe-oublie">Mot de passe oublié ?</a></div>}
          <p className="mt-4 text-center text-sm font-semibold text-slate-300">
            {isRegister ?"Déjà inscrit ?" : "Pas encore de compte ?"}
            <a className="font-black text-cyan-200 hover:text-white" href={isRegister ?`/connexion${querySuffix}` : `/creer-un-compte${querySuffix}`}>{isRegister ?" Connexion" : " Créer un compte"}</a>
          </p>
        </Surface>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}

