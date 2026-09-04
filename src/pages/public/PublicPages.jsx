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
    ["/cookies", "Cookies"],
    ["/conditions", "CGU"],
    ["/reglement", "Règlement"],
    ["/contact", "Contact"],
  ];
  return <footer className="relative z-10 mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-5 py-8 text-xs font-bold text-slate-300">{links.map(([href, label]) => <LinkButton key={href} href={href} navigate={navigate} variant="ghost" className="border-transparent bg-transparent px-0 py-0 text-xs text-slate-300 shadow-none hover:translate-y-0 hover:border-transparent hover:bg-transparent hover:text-cyan-100">{label}</LinkButton>)}<span className="text-slate-300">NXT5 n’est pas affilié à Riot Games.</span></footer>;
}

export const LEGAL_VERSION = "2026-09-04";
const LEGAL_UPDATED_LABEL = "4 septembre 2026";

export const LEGAL_PAGES = {
  "/mentions-legales": {
    eyebrow: "Cadre légal",
    title: "Mentions légales",
    intro: "Informations relatives à l’édition, à l’hébergement et à l’utilisation du site nxt5.org, conformément au cadre français applicable aux services en ligne.",
    sections: [
      ["Éditeur du service", "NXT5 est édité à titre non professionnel. L’éditeur fait usage de la faculté d’anonymat prévue à l’article 1-1, II de la loi n° 2004-575 du 21 juin 2004. Les demandes peuvent être adressées par le canal privé indiqué sur la page Contact. L’identité de l’éditeur peut être communiquée par l’hébergeur aux autorités compétentes dans les conditions prévues par la loi."],
      ["Objet du site", "NXT5 propose des outils de gestion d’équipe, d’import de matchs, de consultation statistique, de préparation de compositions, de champion pool, de planning et de rédaction de reviews. Le service est réservé à un usage d’organisation, d’analyse et de suivi sportif par les utilisateurs autorisés."],
      ["Hébergement", "Le site et ses fonctions sont hébergés par Netlify, Inc., 101 2nd Street, San Francisco, CA 94105, États-Unis — support@netlify.com. La base de données est opérée avec Neon (Neon, Inc.)."],
      ["Propriété intellectuelle", "L’interface, l’identité NXT5, les textes, structures de pages et éléments propres au service sont protégés par les règles applicables à la propriété intellectuelle. Toute reproduction, extraction ou réutilisation substantielle sans autorisation préalable est interdite, sauf usage strictement personnel dans le cadre normal du service."],
      ["Riot Games", "NXT5 n’est pas approuvé, sponsorisé, validé ni affilié à Riot Games. League of Legends, Riot Games et les éléments associés appartiennent à Riot Games, Inc. Les données issues de l’écosystème Riot sont utilisées dans le respect des conditions applicables aux développeurs et uniquement pour les fonctionnalités proposées aux équipes."],
      ["Signalement et droit de réponse", "Toute personne estimant qu’un contenu porte atteinte à ses droits peut demander sa correction, son retrait ou exercer un droit de réponse par le canal privé de la page Contact. La demande doit permettre d’identifier précisément le contenu concerné, son emplacement et le motif du signalement."],
      ["Responsabilité", "NXT5 met à disposition des outils de consultation et d’organisation. Les décisions sportives, choix de draft, interprétations de données, reviews, contenus et usages effectués par les équipes relèvent de la responsabilité exclusive des utilisateurs concernés."],
      ["Mise à jour", `Version ${LEGAL_VERSION}. Dernière mise à jour : ${LEGAL_UPDATED_LABEL}.`],
    ],
    resources: [
      ["Article 1-1 de la LCEN", "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049568614"],
      ["Informations légales Netlify", "https://www.netlify.com/legal/terms-of-use/"],
    ],
  },
  "/confidentialite": {
    eyebrow: "Données",
    title: "Politique de confidentialité",
    intro: "Cette politique décrit précisément les données utilisées par NXT5, leurs finalités, leur durée de conservation, les prestataires concernés et les droits des personnes.",
    sections: [
      ["Responsable du traitement", "Le responsable du traitement est l’éditeur non professionnel de NXT5. Les demandes relatives aux données personnelles s’effectuent par message privé via le canal indiqué sur la page Contact. N’envoyez aucune donnée sensible dans un salon Discord public."],
      ["Données de compte et de sécurité", "NXT5 traite l’adresse e-mail, le pseudonyme, le mot de passe sous forme hachée, les préférences de notification et la date de création du compte. Pour sécuriser les connexions, le service traite aussi un identifiant de session haché, l’adresse IP, le navigateur utilisé, les tentatives récentes et des journaux d’actions."],
      ["Données d’équipe et de jeu", "Le service peut traiter les équipes, rôles et invitations, profils joueurs, Riot IDs, disponibilités, objectifs, notes de coaching, compositions, champion pools, reviews, Game IDs, fichiers de match importés, chronologies de partie, statistiques et pseudonymes publics des participants. Certaines notes peuvent contenir des appréciations rédigées par le staff de l’équipe."],
      ["Origine des données", "Les données proviennent de l’utilisateur, des autres membres autorisés de son équipe, des fichiers de match importés, de profils de jeu accessibles au public et des API Riot. Une personne peut donc apparaître dans un roster ou un match sans avoir elle-même créé de compte NXT5."],
      ["Finalités et bases juridiques", "La création du compte, l’accès aux équipes, l’import et l’analyse des matchs reposent sur l’exécution des CGU. La sécurisation du service, la prévention des abus, la traçabilité et l’amélioration de sa fiabilité reposent sur l’intérêt légitime de NXT5 et de ses utilisateurs. Les notifications facultatives reposent sur le choix de l’utilisateur et peuvent être désactivées dans les paramètres."],
      ["Données obligatoires ou facultatives", "L’e-mail, le pseudonyme et le mot de passe sont nécessaires à la création et à la récupération du compte. Sans eux, NXT5 ne peut pas fournir l’accès personnel au service. Les données d’équipe, Riot IDs, disponibilités, imports, notes et réglages de notification sont facultatifs, mais certaines fonctions resteront incomplètes s’ils ne sont pas renseignés."],
      ["Accès et destinataires", "Les données d’une équipe sont accessibles aux membres qui y sont autorisés, selon leur rôle. Elles sont aussi traitées, uniquement pour leurs missions techniques, par Netlify (hébergement et fonctions), Neon (base PostgreSQL), Resend (e-mails transactionnels), Riot Games (données de jeu demandées) et OpenAI lorsque l’assistant est utilisé. NXT5 ne vend pas les données et ne les utilise pas pour de la publicité ciblée."],
      ["Assistant NXT5 et intelligence artificielle", "Lorsque l’utilisateur interroge l’assistant, sa question, les six derniers messages au maximum, la page courante et une documentation NXT5 pertinente sont transmis à l’API OpenAI. Les statistiques détaillées de l’équipe ne sont pas envoyées par cette fonction. NXT5 ne conserve pas l’historique de l’assistant dans sa base ; il reste seulement en mémoire dans la page ouverte. OpenAI indique ne pas utiliser par défaut les données de son API pour entraîner ses modèles et peut conserver des journaux de contrôle des abus jusqu’à 30 jours."],
      ["Transferts hors Union européenne", "Netlify, Resend et OpenAI sont établis aux États-Unis et peuvent y traiter des données. Ces transferts sont encadrés, selon le prestataire et le service, par le Data Privacy Framework UE–États-Unis et/ou les clauses contractuelles types de la Commission européenne. La région d’hébergement Neon dépend de la configuration du projet. Des informations complémentaires sur les garanties peuvent être demandées à NXT5."],
      ["Durées de conservation", "Les données de compte et d’équipe sont conservées jusqu’à la suppression du compte, de l’équipe ou du contenu concerné. Les sessions expirent après 12 heures, ou 30 jours lorsque « Rester connecté » est activé, puis leurs traces sont supprimées sous 30 jours. Les limites de tentative liées à l’IP sont purgées après 24 heures. Les journaux d’actions sont conservés 12 mois. Les liens de vérification et de réinitialisation expirent respectivement après 24 heures et 30 minutes, puis leurs données sont supprimées sous 30 jours. Les sauvegardes techniques de Neon peuvent subsister jusqu’à 30 jours après une suppression."],
      ["Droits des personnes", "Toute personne peut demander l’accès, la rectification, l’effacement ou la limitation de ses données. Selon la base juridique, elle peut aussi demander la portabilité des données fournies ou s’opposer à un traitement fondé sur l’intérêt légitime. Elle peut retirer à tout moment un choix facultatif, notamment les notifications. NXT5 répond en principe sous un mois et peut demander des éléments raisonnables pour vérifier l’identité du demandeur."],
      ["Décision automatisée et profilage", "Les statistiques et indicateurs NXT5 sont des aides à la lecture. Aucune décision produisant un effet juridique ou un effet significatif similaire n’est prise automatiquement à partir de ces données."],
      ["Sécurité", "NXT5 applique des mesures adaptées au risque : connexion chiffrée, mots de passe hachés, cookies de session HttpOnly et Secure en production, contrôle des rôles, limitation des tentatives et journalisation des actions sensibles. Aucun service en ligne ne peut toutefois garantir une sécurité absolue."],
      ["Réclamation et mise à jour", `Une réclamation peut être déposée auprès de la CNIL sur cnil.fr. Version ${LEGAL_VERSION}, mise à jour le ${LEGAL_UPDATED_LABEL}. Toute modification importante sera portée à la connaissance des utilisateurs par un moyen adapté.`],
    ],
    resources: [
      ["Transparence RGPD — CNIL", "https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence"],
      ["Exercer ses droits — CNIL", "https://www.cnil.fr/fr/passer-laction/les-droits-des-personnes-sur-leurs-donnees"],
      ["Confidentialité Netlify", "https://www.netlify.com/privacy/"],
      ["DPA Neon", "https://neon.com/pdf/DPA.pdf"],
      ["Confidentialité Resend", "https://resend.com/legal/privacy-policy"],
      ["Données de l’API OpenAI", "https://platform.openai.com/docs/models/default-usage-policies-by-endpoint"],
    ],
  },
  "/cookies": {
    eyebrow: "Traceurs",
    title: "Politique relative aux cookies",
    intro: "NXT5 n’utilise actuellement aucun cookie publicitaire ni outil de mesure d’audience. Seuls des traceurs indispensables à la connexion et des préférences locales sont utilisés.",
    sections: [
      ["Cookie de session rb_session", "Ce cookie interne permet de reconnaître une session authentifiée et de protéger l’accès au compte. Il contient un jeton aléatoire ; seule son empreinte est conservée en base. Il est HttpOnly, Secure en production et SameSite=Lax. Sa durée est de 12 heures, ou de 30 jours lorsque l’option « Rester connecté » est activée."],
      ["Préférences locales", "Le navigateur peut conserver localement le choix « Rester connecté », le mode de performance graphique et le masquage du guide débutant. Ces valeurs ne servent pas à suivre la navigation et restent sur l’appareil jusqu’à leur remplacement ou leur suppression dans les réglages du navigateur."],
      ["Consentement", "Ces traceurs sont strictement nécessaires au service demandé ou à la mémorisation d’un réglage attendu. Ils sont donc exemptés de consentement préalable. Aucun bandeau d’acceptation n’est affiché tant que NXT5 n’ajoute pas de traceur soumis au consentement."],
      ["Gestion dans le navigateur", "L’utilisateur peut effacer les cookies et le stockage local depuis les paramètres de son navigateur. La suppression du cookie de session déconnecte le compte ; la suppression des préférences rétablit les réglages par défaut."],
      ["Évolution", `Si un outil d’audience, publicitaire ou un autre traceur non indispensable est ajouté, cette page et le mécanisme de consentement seront adaptés avant son activation. Version ${LEGAL_VERSION}, mise à jour le ${LEGAL_UPDATED_LABEL}.`],
    ],
    resources: [
      ["Règles applicables aux traceurs — CNIL", "https://www.cnil.fr/fr/cookies-et-autres-traceurs/que-dit-la-loi"],
    ],
  },
  "/conditions": {
    eyebrow: "Utilisation",
    title: "Conditions générales d’utilisation",
    intro: "Les présentes CGU constituent le contrat d’utilisation du service NXT5. Leur acceptation est requise lors de la création d’un compte.",
    sections: [
      ["Objet et accès au service", "NXT5 fournit gratuitement, dans sa version actuelle, des outils d’organisation et d’analyse pour les équipes League of Legends. Un compte et, selon la fonction, l’accès à une équipe active sont nécessaires. Les droits varient selon le rôle attribué : joueur, capitaine, coach, manager, analyste ou autre rôle autorisé."],
      ["Acceptation et capacité", "En créant un compte, l’utilisateur accepte la version des CGU et du règlement indiquée lors de son inscription. Il déclare avoir la capacité de s’engager ou, s’il est mineur, disposer de l’autorisation de son représentant légal lorsque celle-ci est requise. La personne qui agit pour une équipe garantit être autorisée à le faire."],
      ["Usage autorisé", "Le service doit être utilisé pour organiser une équipe, importer des matchs, consulter des statistiques, préparer des champion pools, construire des compositions, gérer les disponibilités et rédiger des reviews liées à League of Legends."],
      ["Comptes et responsabilités", "Chaque utilisateur est responsable de l’exactitude des informations qu’il renseigne, de la confidentialité de ses identifiants et des actions réalisées depuis son compte. Les administrateurs d’équipe doivent attribuer les accès avec prudence."],
      ["Contenus et licence technique", "Les utilisateurs conservent leurs droits sur les reviews, notes, compositions et autres contenus qu’ils ajoutent. Ils accordent à NXT5 une autorisation non exclusive, gratuite et limitée à l’hébergement, la reproduction technique et l’affichage de ces contenus uniquement pour fournir le service. Cette autorisation prend fin avec la suppression du contenu, sous réserve des sauvegardes temporaires et obligations légales."],
      ["Imports de matchs", "Les Game IDs, fichiers JSON et imports de matchs doivent correspondre à des parties réelles ou légitimement accessibles par l’équipe. L’utilisateur s’engage à ne pas importer de données dans le but de nuire, d’usurper, de surveiller abusivement ou de détourner le service."],
      ["Règles de conduite", "Le règlement NXT5 fait partie intégrante des présentes CGU. Il interdit notamment le contournement des accès, les attaques, l’extraction massive, l’usurpation, le harcèlement, les contenus illicites ou discriminatoires et l’exploitation abusive de données relatives à d’autres joueurs."],
      ["Données et API tierces", "Certaines fonctionnalités dépendent de données ou services tiers, notamment l’écosystème Riot, des profils publics ou des outils d’import. NXT5 ne garantit pas l’exhaustivité, la disponibilité permanente ou l’absence d’erreur de ces sources externes."],
      ["Modération, suspension et suppression", "NXT5 peut retirer un contenu manifestement illicite ou dangereux, limiter une fonction, suspendre ou supprimer un compte en cas de violation grave ou répétée des CGU, d’atteinte à la sécurité ou de risque pour autrui. Sauf urgence ou obligation légale, l’utilisateur est informé du motif et peut présenter ses observations via la page Contact."],
      ["Disponibilité et évolution", "Le service est fourni en l’état et peut évoluer, être interrompu, limité ou modifié pour des raisons techniques, de maintenance, de sécurité, de conformité ou de dépendance à des prestataires externes. NXT5 s’efforce de préserver les fonctions essentielles mais ne garantit pas une disponibilité continue."],
      ["Responsabilité", "NXT5 est un outil d’aide à la lecture et à l’organisation. Il ne remplace pas le jugement d’un coach, d’un capitaine ou d’un joueur. Dans les limites autorisées par la loi, NXT5 n’est pas responsable des décisions sportives, des données tierces inexactes ni des dommages indirects résultant d’un usage non conforme. Cette clause ne limite pas une responsabilité qui ne peut légalement être exclue."],
      ["Fin d’utilisation", "L’utilisateur peut cesser d’utiliser NXT5 à tout moment et demander la suppression de son compte par le canal privé de la page Contact. Un propriétaire ou capitaine peut supprimer une équipe depuis l’application. Certaines traces peuvent être conservées temporairement pour la sécurité, les sauvegardes et la défense de droits."],
      ["Droit applicable et différends", "Les CGU sont soumises au droit français, sous réserve des règles impératives protégeant l’utilisateur dans son pays de résidence. En cas de différend, les parties cherchent d’abord une solution amiable par la page Contact avant de saisir la juridiction compétente."],
      ["Évolution des CGU", `NXT5 peut modifier les CGU pour adapter le service, la sécurité ou le cadre légal. Une modification importante sera signalée par un moyen adapté et pourra nécessiter une nouvelle acceptation. Version ${LEGAL_VERSION}, mise à jour le ${LEGAL_UPDATED_LABEL}.`],
    ],
  },
  "/reglement": {
    eyebrow: "Communauté",
    title: "Règlement NXT5",
    intro: "Ce règlement protège les joueurs, les équipes et le service. Il s’applique aux comptes, contenus, imports et espaces collaboratifs NXT5.",
    sections: [
      ["Respect des personnes", "Les insultes, menaces, discriminations, humiliations, propos haineux, divulgations d’informations privées et toute forme de harcèlement sont interdits. Une review sportive doit rester factuelle, proportionnée et utile à la progression."],
      ["Données et vie privée", "N’ajoutez que les données nécessaires à l’activité légitime de l’équipe. N’importez pas de conversations privées, coordonnées personnelles, données sensibles ou contenus obtenus sans droit. Les notes de coaching ne doivent pas servir à surveiller, exposer ou nuire à un joueur."],
      ["Accès aux équipes", "Un code d’invitation et un rôle sont personnels. Il est interdit de rejoindre une équipe sans autorisation, de partager un accès avec une personne non autorisée ou de conserver des données après la fin légitime de son accès."],
      ["Intégrité du service", "Sont interdits : contourner les permissions, tester une faille sans autorisation, automatiser des requêtes abusives, perturber le service, introduire un logiciel malveillant, extraire massivement les données ou tenter d’accéder aux secrets et données d’autres équipes."],
      ["Imports et propriété intellectuelle", "Les fichiers, Game IDs, logos, textes et autres contenus doivent pouvoir être utilisés légitimement. Ne publiez pas de contenu contrefaisant, trompeur ou attribué à tort à Riot Games, à NXT5 ou à une autre personne."],
      ["Signalement", "Un contenu, un compte ou un accès problématique peut être signalé par message privé via la page Contact. Indiquez les faits, la page ou l’équipe concernée et les éléments utiles, sans republier inutilement des données privées."],
      ["Mesures applicables", "Selon la gravité et la répétition des faits, NXT5 peut avertir l’utilisateur, retirer un contenu, réduire des droits, suspendre un accès ou supprimer un compte. Une mesure immédiate peut être prise pour protéger le service, une personne ou respecter une obligation légale."],
      ["Version", `Ce règlement fait partie des CGU. Version ${LEGAL_VERSION}, mise à jour le ${LEGAL_UPDATED_LABEL}.`],
    ],
  },
  "/contact": {
    eyebrow: "Support",
    title: "Contact",
    intro: "Besoin d’aide, de signaler un souci ou de rejoindre la communauté NXT5 ? Le point de contact principal est le serveur Discord officiel.",
    sections: [
      ["Discord NXT5", "Le serveur Discord permet de centraliser les retours, les bugs, les idées de fonctionnalités et les demandes d’aide autour de NXT5. C’est le canal à privilégier pour obtenir une réponse rapide."],
      ["Support produit", "Pour un problème technique, indique la page concernée, l’action réalisée, le message d’erreur affiché et, si possible, le contexte de l’équipe ou de l’import. Plus le signalement est précis, plus il peut être corrigé vite."],
      ["Sécurité et données", "Pour une demande sensible liée à un compte, une équipe, des données ou un accès, ne publie aucune information privée dans un salon public. Utilise exclusivement un message privé à l’équipe NXT5. Précise s’il s’agit d’une demande d’accès, de rectification, d’effacement, de limitation, de portabilité ou d’opposition."],
      ["Délai de réponse", "Les demandes relatives aux données personnelles sont traitées en principe sous un mois. Pour protéger le compte, NXT5 peut demander des éléments raisonnables permettant de vérifier l’identité du demandeur."],
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
          {!!page.resources?.length && <section className="mt-8 rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.055] p-5 md:p-6"><h2 className="text-xl font-black text-white">Références et garanties</h2><div className="mt-4 flex flex-wrap gap-2">{page.resources.map(([label, href]) => <a key={href} href={href} target="_blank" rel="noreferrer" className="rounded-xl border border-cyan-200/20 bg-black/20 px-3 py-2 text-sm font-black text-cyan-100 transition hover:border-cyan-200/45 hover:bg-cyan-300/10">{label}</a>)}</div></section>}
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
  const [legalAccepted, setLegalAccepted] = useState(false);
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
      const body = { accountName: form.email, email: form.email, displayName: form.displayName, password: form.password, rememberMe, acceptLegal: isRegister ? legalAccepted : undefined, legalVersion: isRegister ? LEGAL_VERSION : undefined };
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
            {isRegister && <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/[0.18] p-4 text-left"><input type="checkbox" checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} required className="mt-1 h-4 w-4 shrink-0 accent-cyan-300" /><span className="text-sm font-semibold leading-6 text-slate-300">J’accepte les <a href="/conditions" className="font-black text-cyan-200 underline decoration-cyan-300/40 underline-offset-4 hover:text-white">conditions générales d’utilisation</a>, le <a href="/reglement" className="font-black text-cyan-200 underline decoration-cyan-300/40 underline-offset-4 hover:text-white">règlement NXT5</a> et reconnais avoir lu la <a href="/confidentialite" className="font-black text-cyan-200 underline decoration-cyan-300/40 underline-offset-4 hover:text-white">politique de confidentialité</a> (version {LEGAL_VERSION}).</span></label>}
            {error && <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm font-bold text-rose-100">{error}</div>}
            <Button type="submit" disabled={loading || (isRegister && !legalAccepted)} icon={loading ?Loader2 : isRegister ?UserPlus : Lock} className="w-full py-4">{loading ?"Chargement…" : isRegister ?"Créer le compte" : "Entrer dans NXT5"}</Button>
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
