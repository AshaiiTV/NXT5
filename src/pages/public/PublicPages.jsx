import React, { useState } from "react";
import { LEGAL_UPDATED_LABEL, LEGAL_VERSION, NXT5_CONTACT_EMAIL, NXT5_EDITOR_NAME } from "../../../shared/legal.js";
import { Activity, ArrowRight, ArrowUpRight, BarChart3, Check, ChevronDown, ChevronRight, Crown, Eye, FileText, Flame, Gauge, Loader2, Lock, Mail, Shield, Swords, Target, Upload, UserPlus, Users } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { AUDIENCE_CONSENT_VERSION, openCookieSettings, trackAudienceEvent } from "../../app/audience-client.js";
import { DISCORD_INVITE_URL } from "../../app/constants.jsx";
import { cx, errorToast, readRememberPreference, tone, writeRememberPreference } from "../../app/helpers.js";
import { isSafeInternalPath } from "../../app/routing.js";
import { BrandLogo, Nxt5Wordmark, ResponsiveImage, RoleIcon } from "../../components/brand/BrandAssets.jsx";
import { AmbientBackground } from "../../components/layout/AppChrome.jsx";
import { Badge, Button, PremiumToggle, Surface, TextInput } from "../../components/ui/Core.jsx";
import "./public-information.css";
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
            <p className="font-black text-white">Suivi 5v5</p>
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
              {axes.map((a, i) => <div key={a} className="rounded-2xl border border-cyan-100/12 bg-black/[0.18] p-3"><div className={cx("mb-3 inline-flex rounded-xl border p-2", tone(i === 0 ? "cyan" : i === 1 ? "purple" : i === 2 ? "blue" : "pink"))}>{i === 0 ? <Eye className="h-4 w-4" /> : i === 1 ? <Target className="h-4 w-4" /> : i === 2 ? <Gauge className="h-4 w-4" /> : <Swords className="h-4 w-4" />}</div><p className="text-sm font-black text-white">{a}</p></div>)}
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
    [Target, "Axes de progrès", "Ce qu’il faut travailler", "cyan"],
    [Eye, "Vision & setup", "Avant dragons et Nashor", "blue"],
    [Flame, "Progression", "Game après game", "pink"],
  ];
  return (
    <div className="nxt5-panel grid gap-3 border border-cyan-200/14 bg-[#050914]/72 p-4 shadow-[0_0_42px_rgba(34,211,238,.08)] backdrop-blur-2xl md:grid-cols-5">
      {stats.map(([Icon, value, label, t]) => <div key={value} className="flex items-center gap-3 border-white/10 p-3 transition hover:bg-white/[0.035] md:[&:not(:last-child)]:border-r"><div className={cx("rounded-2xl border p-3 shadow-[0_0_22px_rgba(34,211,238,.08)]", tone(t))}><Icon className="h-5 w-5" /></div><div className="min-w-0"><p className="text-sm font-black text-white">{value}</p><p className="text-xs font-bold text-slate-300">{label}</p></div></div>)}
    </div>
  );
}

export function LinkButton({ href, children, icon: Icon, variant = "primary", className = "", navigate, target, rel, ...props }) {
  const base = "nxt5-cyber-button nxt5-control inline-flex min-w-0 max-w-full items-center justify-center gap-2 whitespace-normal px-4 py-2.5 text-center text-sm font-black leading-5 transition duration-200 active:translate-y-0";
  const variants = {
    primary: "nxt5-button-primary border border-cyan-100/36",
    ghost: "border border-cyan-100/16 bg-[#071221]/72 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] hover:-translate-y-0.5 hover:border-cyan-200/45 hover:bg-cyan-300/[0.11]",
  };

  function go(event) {
    if (!navigate || !isSafeInternalPath(href) || target === "_blank" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    navigate(href);
  }

  return <a {...props} href={href} onClick={go} target={target} rel={target === "_blank" ? "noopener noreferrer" : rel} className={cx(base, variants[variant], className)}>{Icon && <Icon className="h-4 w-4 shrink-0" />}<span className="min-w-0 break-words">{children}</span></a>;
}

export function SiteHeader({ children, navigate }) {
  function goHome(event) {
    if (!navigate) return;
    event.preventDefault();
    navigate("/");
  }

  return (
    <header className="relative z-10 mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5">
      <a href="/" onClick={goHome} aria-label="Accueil NXT5" className="shrink-0 transition hover:opacity-90"><BrandLogo /></a>
      {children && <div className="nxt5-panel relative flex shrink-0 items-center gap-3 border border-cyan-200/12 bg-[#050914]/62 p-1.5 shadow-[0_0_32px_rgba(34,211,238,.08)] backdrop-blur-2xl">{children}</div>}
    </header>
  );
}

const INFORMATION_GROUPS = [
  { href: "/mentions-legales", label: "Cadre légal", pages: [["/mentions-legales", "Mentions légales"], ["/conditions", "Conditions d’utilisation"], ["/reglement", "Règlement NXT5"]] },
  { href: "/confidentialite", label: "Données & cookies", pages: [["/confidentialite", "Confidentialité"], ["/cookies", "Cookies et préférences"]] },
  { href: "/reseaux", label: "Réseaux & contact", pages: [["/reseaux", "La communauté"], ["/contact", "Contacter l’équipe"]] },
];

export function PublicTextLink({ href, navigate, children, ...props }) {
  function go(event) {
    if (event.defaultPrevented || !navigate || !isSafeInternalPath(href) || props.target === "_blank" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    navigate(href);
  }
  return <a {...props} href={href} onClick={go}>{children}</a>;
}

export function PublicInformationNav({ navigate, activePath }) {
  return (
    <nav aria-label="Rubriques d’information" className="nxt5-information-nav">
      {INFORMATION_GROUPS.map((group) => (
        <PublicTextLink key={group.href} href={group.href} navigate={navigate}
          aria-current={group.pages.some(([path]) => path === activePath) ? "location" : undefined}>
          {group.label}
        </PublicTextLink>
      ))}
    </nav>
  );
}

export function LegalLinks({ navigate }) {
  return (
    <footer className="nxt5-footer">
      <div className="nxt5-footer-main">
        <p className="nxt5-footer-signature">Cinq rôles. Une même direction.</p>
        <nav aria-label="Informations et contact">
          {INFORMATION_GROUPS.map(({ href, label }) => (
            <PublicTextLink key={href} href={href} navigate={navigate}>{label}</PublicTextLink>
          ))}
          <button type="button" onClick={openCookieSettings} aria-haspopup="dialog" className="inline-flex min-h-11 items-center text-left text-xs font-semibold text-[#edf5ff] hover:text-cyan-200 hover:underline hover:underline-offset-[5px] sm:text-[0.8125rem]">Gérer mes cookies</button>
        </nav>
      </div>
      <p className="nxt5-footer-disclaimer">NXT5 n’est pas affilié à Riot Games.</p>
    </footer>
  );
}

export { LEGAL_VERSION };

export const LEGAL_PAGES = {
  "/mentions-legales": {
    eyebrow: "Cadre légal",
    title: "Mentions légales",
    intro: "Informations relatives à l’édition, à l’hébergement et à l’utilisation du site nxt5.org, conformément au cadre français applicable aux services en ligne.",
    sections: [
      ["Éditeur du service", `NXT5 est édité à titre non professionnel par ${NXT5_EDITOR_NAME}, qui en assure la direction de la publication. Tu peux contacter l’éditeur par e-mail à ${NXT5_CONTACT_EMAIL}, notamment pour toute question sur le service, un signalement ou une demande relative à tes données personnelles.`],
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
      ["Responsable du traitement", `Le responsable du traitement est ${NXT5_EDITOR_NAME}, éditeur de NXT5. Pour toute question sur tes données personnelles ou pour exercer tes droits, écris à ${NXT5_CONTACT_EMAIL}. Ce contact privé est également indiqué sur la page Contact. Ne publie aucune donnée sensible dans un salon Discord public.`],
      ["Données de compte et de sécurité", "NXT5 traite l’adresse e-mail, le pseudonyme, le mot de passe sous forme hachée, les préférences de notification, les dates de création et de dernière activité du compte, ainsi que l’état d’envoi d’un éventuel rappel d’inactivité. Pour sécuriser les connexions, le service traite aussi un identifiant de session haché, l’adresse IP, le navigateur utilisé, les tentatives récentes et des journaux d’actions."],
      ["Données d’équipe et de jeu", "Le service peut traiter les équipes, rôles et invitations, profils joueurs, Riot IDs, disponibilités, objectifs, notes de coaching, compositions, champion pools, reviews, Game IDs, fichiers de match importés, chronologies de partie, statistiques et pseudonymes publics des participants. Certaines notes peuvent contenir des appréciations rédigées par le staff de l’équipe."],
      ["Mesure de fréquentation — ajout du 14 septembre 2026", "Avec ton consentement préalable, NXT5 mesure les pages consultées, la durée active et le défilement, les sources de visite, les libellés de campagnes, la catégorie d’appareil, la famille du navigateur, le pays approximatif fourni par l’hébergeur et certaines actions réussies (création de compte, connexion, demande d’accès). Des identifiants aléatoires distinguent les navigateurs et les sessions : ces données sont pseudonymisées, pas anonymes. Elles ne sont pas rattachées aux comptes, aux données d’équipe ou aux e-mails. Les paramètres d’URL, les jetons, les contenus saisis et l’adresse IP ne sont pas enregistrés dans les statistiques. Les pages administrateur et les parcours de réinitialisation sont exclus. Les données et preuves de choix sont hébergées par Netlify et Neon, accessibles uniquement à l’administrateur de plateforme, et supprimées automatiquement au terme de leur durée de conservation de 180 jours. Les traitements techniques de sécurité et les journaux propres à l’hébergeur restent distincts. Tu peux refuser sans limiter le service et retirer ton accord à tout moment avec « Gérer mes cookies » dans le pied de page. Le retrait arrête les collectes futures ; les données déjà collectées restent soumises à la durée annoncée et à tes droits d’effacement via la page Contact. La base juridique de cette mesure est ton consentement."],
      ["Demandes d’accès et offres en préparation — ajout du 8 septembre 2026", "Le formulaire Tarifs recueille ton nom de contact, ton e-mail, le nom de ton équipe, ton rôle, la formule souhaitée, le payeur envisagé et ton intention d’achat. Le message libre est facultatif. Ton accord pour être recontacté, sa version et sa date sont enregistrés avec la demande. Ces informations servent uniquement à répondre à ta demande et à préparer l’offre avec les équipes intéressées ; elles sont accessibles à l’administration NXT5 et hébergées par Netlify et Neon. Les coordonnées, réponses et notes de suivi sont supprimées après six mois à compter de la demande, lors du nettoyage quotidien. Aucune inscription à une newsletter ni aucun paiement n’en résulte. Tu peux demander la rectification ou la suppression de ta demande et retirer ton accord par le canal privé de la page Contact."],
      ["Origine des données", "Les données proviennent de l’utilisateur, des autres membres autorisés de son équipe, des fichiers de match importés, de profils de jeu accessibles au public et des API Riot. Une personne peut donc apparaître dans un roster ou un match sans avoir elle-même créé de compte NXT5."],
      ["Finalités et bases juridiques", "La création du compte, l’accès aux équipes, l’import et l’analyse des matchs reposent sur l’exécution des CGU. La sécurisation du service, la prévention des abus, la traçabilité et l’amélioration de sa fiabilité reposent sur l’intérêt légitime de NXT5 et de ses utilisateurs. Les notifications facultatives, dont le rappel unique après trois mois d’inactivité, reposent sur le choix de l’utilisateur et peuvent être désactivées dans les paramètres."],
      ["Données obligatoires ou facultatives", "L’e-mail, le pseudonyme et le mot de passe sont nécessaires à la création et à la récupération du compte. Sans eux, NXT5 ne peut pas fournir l’accès personnel au service. Les données d’équipe, Riot IDs, disponibilités, imports, notes et réglages de notification sont facultatifs, mais certaines fonctions resteront incomplètes s’ils ne sont pas renseignés."],
      ["Accès et destinataires", "Les données d’une équipe sont accessibles aux membres qui y sont autorisés, selon leur rôle. Elles sont aussi traitées, uniquement pour leurs missions techniques, par Netlify (hébergement, fonctions et stockage des images de publication), Neon (base PostgreSQL), Resend (e-mails transactionnels), Riot Games (données de jeu demandées) et OpenAI lorsque l’assistant est utilisé. Lorsqu’une publication Discord est demandée ou que la diffusion automatique est activée, Discord reçoit le contenu publié ; les personnes ayant accès au salon peuvent le consulter, même sans compte NXT5. Discord exploite sa propre plateforme selon sa politique de confidentialité. NXT5 ne vend pas les données et ne les utilise pas pour de la publicité ciblée."],
      ["Assistant NXT5 et intelligence artificielle", "Lorsque l’utilisateur interroge l’assistant, sa question, les six derniers messages au maximum, la page courante et une documentation NXT5 pertinente sont transmis à l’API OpenAI. Les statistiques détaillées de l’équipe ne sont pas envoyées par cette fonction. NXT5 ne conserve pas l’historique de l’assistant dans sa base ; il reste seulement en mémoire dans la page ouverte. OpenAI indique ne pas utiliser par défaut les données de son API pour entraîner ses modèles et peut conserver des journaux de contrôle des abus jusqu’à 30 jours."],
      ["Transferts hors Union européenne", "Netlify, Resend et OpenAI sont établis aux États-Unis et peuvent y traiter des données. Ces transferts sont encadrés, selon le prestataire et le service, par le Data Privacy Framework UE–États-Unis et/ou les clauses contractuelles types de la Commission européenne. La région d’hébergement Neon dépend de la configuration du projet. Pour les contenus transmis au bot, Discord indique traiter et stocker des données aux États-Unis et dans d’autres pays, avec notamment des clauses contractuelles types et les mécanismes d’adéquation applicables. Sa politique, liée ci-dessous, précise ces garanties et ses points de contact. Des informations complémentaires sur les garanties peuvent être demandées à NXT5."],
      ["Durées de conservation", "Les données de compte et d’équipe sont conservées jusqu’à la suppression du compte, de l’équipe ou du contenu concerné. Les copies de publication et traces techniques du bot suivent les règles spécifiques précisées ci-dessous. Les sessions expirent après 12 heures, ou 30 jours lorsque « Rester connecté » est activé, puis leurs traces sont supprimées sous 30 jours. Les limites de tentative liées à l’IP sont purgées après 24 heures. Les journaux d’actions et le journal des destinataires des rappels d’inactivité sont conservés 12 mois ; ce dernier contient uniquement le compte, l’adresse utilisée, la période d’inactivité et la date d’envoi. Les liens de vérification et de réinitialisation expirent respectivement après 24 heures et 30 minutes, puis leurs données sont supprimées sous 30 jours. Les sauvegardes techniques de Neon peuvent subsister jusqu’à 30 jours après une suppression."],
      ["Droits des personnes", "Toute personne peut demander l’accès, la rectification, l’effacement ou la limitation de ses données. Selon la base juridique, elle peut aussi demander la portabilité des données fournies ou s’opposer à un traitement fondé sur l’intérêt légitime. Elle peut retirer à tout moment un choix facultatif, notamment les notifications. NXT5 répond en principe sous un mois et peut demander des éléments raisonnables pour vérifier l’identité du demandeur."],
      ["Décision automatisée et profilage", "Les statistiques et indicateurs NXT5 sont des aides à la lecture. Aucune décision produisant un effet juridique ou un effet significatif similaire n’est prise automatiquement à partir de ces données."],
      ["Sécurité", "NXT5 applique des mesures adaptées au risque : connexion chiffrée, mots de passe hachés, cookies de session HttpOnly et Secure en production, contrôle des rôles, limitation des tentatives et journalisation des actions sensibles. Aucun service en ligne ne peut toutefois garantir une sécurité absolue."],
      ["Réclamation et mise à jour", `Une réclamation peut être déposée auprès de la CNIL sur cnil.fr. Version ${LEGAL_VERSION}, mise à jour le ${LEGAL_UPDATED_LABEL}. Toute modification importante sera portée à la connaissance des utilisateurs par un moyen adapté.`],
      ["Bot Discord : données de connexion", "L’intégration est facultative et se configure pour chaque équipe. NXT5 reçoit de Discord les informations nécessaires sur le serveur, les salons, les rôles, les permissions et les commandes adressées au bot. NXT5 conserve les identifiants du serveur, des salons, du rôle à mentionner, des messages et des interactions, les noms des salons, les comptes NXT5 responsables des actions et l’identifiant Discord des auteurs de commandes. S’y ajoutent les réglages, dates, statuts, erreurs et réponses techniques. Les codes de liaison sont à usage unique, valables 10 minutes et conservés sous forme d’empreinte. Ne les partage pas publiquement. Le bot ne demande pas ton mot de passe Discord."],
      ["Bot Discord : publications et visibilité", "Le message et son image peuvent contenir le nom de l’équipe et de l’adversaire, la catégorie, la date et l’identifiant de la game, son résultat, sa durée, les noms ou pseudonymes des participants, champions, rôles, sorts, objets et statistiques de jeu. Des pistes de review calculées peuvent être ajoutées au message si cette option est activée ; les notes privées du staff ne sont pas incluses. Ces données proviennent des imports et des informations d’équipe, y compris pour des joueurs sans compte NXT5. Elles sont transmises à Discord et visibles selon les permissions du salon choisi. Un salon partagé entre plusieurs équipes ne cloisonne pas ses lecteurs. Les destinataires peuvent conserver ou repartager une copie. Le lien vers la game reste soumis aux droits NXT5 ; il ne rend pas privée l’image déjà publiée."],
      ["Bot Discord : permissions et lecture des messages", "L’invitation actuelle demande l’autorisation Administrateur : elle donne des droits étendus au bot et lui permet de passer outre les restrictions propres aux salons, y compris privés. Le choix des destinations dans NXT5 limite les publications prévues, mais ne réduit pas cette permission Discord. Le fonctionnement actuel ne collecte pas en continu les conversations, les messages privés ou l’audio. Pour vérifier un envoi incertain, NXT5 peut toutefois recevoir un message précis ou jusqu’aux 100 derniers messages du salon concerné, puis rechercher celui du bot à partir de son auteur et de sa référence. Les messages des autres participants ne sont pas conservés dans l’historique de publication NXT5. Les secrets du bot restent côté serveur ; les commandes reçues font l’objet d’une vérification de signature, de permissions et de limites de fréquence."],
      ["Bot Discord : finalités et suivi technique", "La liaison et la publication demandées par un utilisateur servent à fournir l’intégration dans le cadre des CGU. La sécurité, la prévention des doublons, le diagnostic et le suivi de fiabilité reposent sur l’intérêt légitime de NXT5. Le partage proportionné de données de participants sans compte répond à l’intérêt légitime d’analyse et d’organisation des équipes ; les personnes concernées peuvent s’y opposer par le canal privé de Contact. L’installation par un responsable ne vaut pas consentement individuel de tous les joueurs. L’administration de plateforme consulte les serveurs, équipes et salons connus, les volumes de publications, commandes et tests, leurs dates, états et erreurs. Ce suivi provient des opérations du bot : il ne mesure pas qui lit les messages et reste distinct de la mesure de fréquentation du site soumise au choix cookies."],
      ["Bot Discord : conservation des données", "Le nettoyage périodique supprime les codes plus d’un jour après leur expiration et les reçus de commandes après 7 jours. Les images stockées par NXT5 sont éligibles au nettoyage après 30 jours, sauf si un envoi en cours ou non résolu en a encore besoin. Les traces de tentatives sont éligibles au nettoyage après 90 jours, sauf si elles concernent une publication en cours ou incertaine. Les anciennes copies de publication ne sont nettoyées qu’après 90 jours, lorsqu’elles ont été remplacées par une version publiée et ne sont plus nécessaires. Les opérations non résolues restent conservées pour être vérifiées. La dernière version publiée, ses références, les réglages et les résultats des tests de connexion restent associés à l’équipe jusqu’à sa suppression ou au traitement d’une demande d’effacement applicable. Les journaux d’actions sensibles, qui peuvent contenir l’identifiant Discord de l’auteur, suivent la durée de 12 mois. Ces règles concernent NXT5 ; Discord applique ses propres règles aux messages et pièces jointes reçus."],
      ["Bot Discord : déconnexion et effacement", "La pause ou la déconnexion empêche les prochains envois de games de l’équipe, sans pouvoir rappeler un envoi déjà engagé. Un test fictif peut encore être demandé explicitement pendant une pause. Déconnecter conserve les réglages et l’historique dans NXT5 et ne retire pas le bot du serveur. Retirer le bot dans Discord affecte toutes les équipes qui utilisent ce serveur. Ni la déconnexion, ni la suppression d’une game ou d’une équipe dans NXT5 ne suppriment automatiquement les messages déjà publiés sur Discord. Le staff autorisé peut demander leur retrait depuis l’historique, tant que la publication y est disponible ; il faut vérifier la confirmation du retrait. Avant de supprimer une équipe, retire ses publications ou fais-les supprimer directement dans Discord. Un échec de permission ou de service peut empêcher ce retrait. NXT5 ne peut pas effacer les copies conservées par des tiers. Pour exercer tes droits, utilise le canal privé de Contact en indiquant l’équipe et, si possible, le lien du message concerné."],
    ],
    resources: [
      ["Transparence RGPD — CNIL", "https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence"],
      ["Exercer ses droits — CNIL", "https://www.cnil.fr/fr/passer-laction/les-droits-des-personnes-sur-leurs-donnees"],
      ["Confidentialité Netlify", "https://www.netlify.com/privacy/"],
      ["DPA Neon", "https://neon.com/pdf/DPA.pdf"],
      ["Confidentialité Resend", "https://resend.com/legal/privacy-policy"],
      ["Données de l’API OpenAI", "https://platform.openai.com/docs/models/default-usage-policies-by-endpoint"],
      ["Politique de confidentialité Discord", "https://discord.com/privacy"],
      ["Permissions des applications Discord", "https://docs.discord.com/developers/topics/permissions"],
    ],
  },
  "/cookies": {
    eyebrow: "Traceurs",
    title: "Politique relative aux cookies",
    intro: "NXT5 utilise des cookies nécessaires au service et, uniquement avec ton accord, une mesure interne de fréquentation. Aucun cookie publicitaire n’est utilisé.",
    sections: [
      ["Cookie de session rb_session", "Ce cookie interne permet de reconnaître une session authentifiée et de protéger l’accès au compte. Il contient un jeton aléatoire ; seule son empreinte est conservée en base. Il est HttpOnly, Secure en production et SameSite=Lax. Sa durée est de 12 heures, ou de 30 jours lorsque l’option « Rester connecté » est activée."],
      ["Préférences locales", "Le navigateur peut conserver localement le choix « Rester connecté », le mode de performance graphique et le masquage du guide débutant. Ces valeurs ne servent pas à suivre la navigation et restent sur l’appareil jusqu’à leur remplacement ou leur suppression dans les réglages du navigateur."],
      ["Ton choix", "Le bandeau propose « Tout refuser », « Personnaliser » et « Tout accepter ». La mesure reste désactivée avant ton accord. Le cookie nécessaire nxt5_audience_consent mémorise une référence opaque à ton choix pendant 180 jours. La preuve comprend la version du texte, le choix et les dates correspondantes. Le cookie nécessaire nxt5_audience_optout peut conserver un refus pendant 180 jours et arrête aussi le suivi si la synchronisation avec le serveur échoue."],
      ["Cookies de mesure, facultatifs", "Après acceptation seulement, nxt5_audience_visitor distingue un navigateur pendant 180 jours maximum sans prolongation automatique. nxt5_audience_session regroupe la navigation en sessions de 30 minutes d’inactivité, dans la limite de validité du consentement. Ces cookies internes sont HttpOnly, Secure en HTTPS et SameSite=Lax. Ils contiennent des identifiants aléatoires ; aucun nom, e-mail ou identifiant de compte n’est ajouté aux statistiques."],
      ["Ce que nous mesurons", "Pages du site, durée d’activité visible (l’inactivité prolongée est exclue), défilement, domaine de provenance, libellés de campagne, type d’appareil, famille de navigateur, pays approximatif et événements de création de compte, connexion, consultation des tarifs et demande d’accès. Les routes sont limitées à une liste autorisée, sans paramètre d’URL ni jeton. Aucun texte saisi ni contenu de match n’est collecté. Les données de fréquentation sont conservées 180 jours puis supprimées automatiquement, et visibles uniquement dans l’administration NXT5."],
      ["Modifier ou retirer mon accord", "Une fois ton choix enregistré, le bandeau et le bouton flottant disparaissent. Le lien « Gérer mes cookies » du pied de page permet de changer ton choix. Un refus arrête immédiatement les nouveaux envois sur le navigateur et supprime les cookies de mesure côté serveur dès que celui-ci est joignable. Les cookies de connexion restent actifs. Le retrait ne supprime pas automatiquement les données déjà collectées ; leur effacement peut être demandé par le canal privé de la page Contact."],
      ["Gestion dans le navigateur", "L’utilisateur peut effacer les cookies et le stockage local depuis les paramètres de son navigateur. La suppression du cookie de session déconnecte le compte ; la suppression des préférences rétablit les réglages par défaut."],
      ["Évolution", `Version ${LEGAL_VERSION}, mise à jour le ${LEGAL_UPDATED_LABEL}. La version du consentement à la mesure d’audience reste ${AUDIENCE_CONSENT_VERSION} : cette mise à jour rédactionnelle ne change ni les finalités, ni les données mesurées, ni tes choix enregistrés. Une modification des finalités ou une nouvelle version du consentement impose de recueillir à nouveau ton choix avant toute activation. Les cookies nécessaires au fonctionnement restent exemptés de consentement préalable.`],
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
      ["Objet et accès au service", "NXT5 fournit des outils d’organisation et d’analyse pour les équipes League of Legends. Toutes les fonctionnalités actuellement accessibles sont gratuites. Un compte et, selon la fonction, l’accès à une équipe active sont nécessaires. Les droits varient selon le rôle attribué : joueur, capitaine, coach, manager, analyste ou autre rôle autorisé."],
      ["Éventuelles offres payantes", "Certaines fonctionnalités pourront faire l’objet d’offres payantes à l’avenir. Leurs prix, leur contenu et leurs conditions de vente seront présentés avant toute souscription. La création d’un compte, l’utilisation actuelle du service et l’acceptation des présentes CGU ne créent aucun abonnement payant et n’autorisent aucun prélèvement. Une offre payante nécessitera un choix et une acceptation explicites."],
      ["Acceptation et capacité", "En créant un compte, l’utilisateur accepte la version des CGU et du règlement indiquée lors de son inscription. Il déclare avoir la capacité de s’engager ou, s’il est mineur, disposer de l’autorisation de son représentant légal lorsque celle-ci est requise. La personne qui agit pour une équipe garantit être autorisée à le faire."],
      ["Usage autorisé", "Le service doit être utilisé pour organiser une équipe, importer des matchs, consulter des statistiques, préparer des champion pools, construire des compositions, gérer les disponibilités et rédiger des reviews liées à League of Legends."],
      ["Comptes et responsabilités", "Chaque utilisateur est responsable de l’exactitude des informations qu’il renseigne, de la confidentialité de ses identifiants et des actions réalisées depuis son compte. Les administrateurs d’équipe doivent attribuer les accès avec prudence."],
      ["Inactivité du compte et rappel par e-mail", "Un compte est considéré comme inactif après 90 jours consécutifs sans utilisation authentifiée de NXT5. À partir de ce seuil, NXT5 peut envoyer à l’adresse vérifiée du compte un unique e-mail de rappel par période d’inactivité, sous réserve que la préférence correspondante soit activée. L’envoi peut intervenir après le quatre-vingt-dixième jour en raison du traitement planifié, de limites techniques ou d’un incident de délivrance. Ce rappel ne contient aucune donnée d’équipe ou de jeu et n’entraîne, à lui seul, ni suppression, ni suspension, ni restriction du compte."],
      ["Préférence de rappel et information au retour", "L’utilisateur peut désactiver à tout moment les futurs e-mails de rappel d’inactivité dans ses paramètres. Cette désactivation ne peut pas annuler un message déjà envoyé. Lors du premier retour authentifié suivant un rappel, NXT5 affiche une information dans l’application jusqu’à ce que l’utilisateur la ferme ou la confirme ; ce message de service reste distinct de la préférence d’envoi par e-mail. Une nouvelle période de 90 jours ne peut commencer qu’après une nouvelle activité du compte."],
      ["Nature non promotionnelle du rappel", "Le rappel d’inactivité est une communication relationnelle limitée au retour vers un compte existant et ne comporte pas d’offre commerciale. L’acceptation des présentes CGU ne vaut pas consentement à recevoir de la prospection commerciale. Si NXT5 devait envoyer à l’avenir des communications promotionnelles, elles seraient distinguées de ce rappel et soumises aux choix et règles applicables."],
      ["Traçabilité et accès administrateur", "Pour assurer l’envoi unique, le support et la traçabilité du dispositif, NXT5 enregistre la dernière activité, l’état du rappel et, pendant 12 mois, un journal comprenant le compte concerné, l’adresse e-mail effectivement utilisée, le début de la période d’inactivité et la date d’envoi. Ce journal est visible uniquement par le compte administrateur de plateforme expressément configuré par l’éditeur ; les administrateurs d’équipe et les autres utilisateurs n’y ont pas accès. Il ne contient ni contenu de l’e-mail, ni donnée d’équipe ou de jeu, ni adresse IP, ni code d’invitation. Ces informations ne peuvent être utilisées que pour l’exploitation, le support, la sécurité et la conformité de NXT5, conformément à la Politique de confidentialité."],
      ["Contenus et licence technique", "Les utilisateurs conservent leurs droits sur les reviews, notes, compositions et autres contenus qu’ils ajoutent. Ils accordent à NXT5 une autorisation non exclusive, gratuite et limitée à l’hébergement, la reproduction technique et l’affichage de ces contenus uniquement pour fournir le service. Cette autorisation prend fin avec la suppression du contenu, sous réserve des sauvegardes temporaires et obligations légales."],
      ["Imports de matchs", "Les Game IDs, fichiers JSON et imports de matchs doivent correspondre à des parties réelles ou légitimement accessibles par l’équipe. L’utilisateur s’engage à ne pas importer de données dans le but de nuire, d’usurper, de surveiller abusivement ou de détourner le service."],
      ["Règles de conduite", "Le règlement NXT5 fait partie intégrante des présentes CGU. Il interdit notamment le contournement des accès, les attaques, l’extraction massive, l’usurpation, le harcèlement, les contenus illicites ou discriminatoires et l’exploitation abusive de données relatives à d’autres joueurs."],
      ["Données et API tierces", "Certaines fonctionnalités dépendent de données ou services tiers, notamment l’écosystème Riot, des profils publics ou des outils d’import. NXT5 ne garantit pas l’exhaustivité, la disponibilité permanente ou l’absence d’erreur de ces sources externes."],
      ["Modération, suspension et suppression", "NXT5 peut retirer un contenu manifestement illicite ou dangereux, limiter une fonction, suspendre ou supprimer un compte en cas de violation grave ou répétée des CGU, d’atteinte à la sécurité ou de risque pour autrui. Sauf urgence ou obligation légale, l’utilisateur est informé du motif et peut présenter ses observations via la page Contact."],
      ["Disponibilité et évolution", "Le service est fourni en l’état et peut évoluer, être interrompu, limité ou modifié pour des raisons techniques, de maintenance, de sécurité, de conformité ou de dépendance à des prestataires externes. NXT5 s’efforce de préserver les fonctions essentielles mais ne garantit pas une disponibilité continue."],
      ["Responsabilité", "NXT5 est un outil d’aide à la lecture et à l’organisation. Il ne remplace pas le jugement d’un coach, d’un capitaine ou d’un joueur. Dans les limites autorisées par la loi, NXT5 n’est pas responsable des décisions sportives, des données tierces inexactes ni des dommages indirects résultant d’un usage non conforme. Cette clause ne limite pas une responsabilité qui ne peut légalement être exclue."],
      ["Fin d’utilisation", `Tu peux cesser d’utiliser NXT5 à tout moment et demander la suppression de ton compte à ${NXT5_CONTACT_EMAIL}, par le canal privé indiqué sur la page Contact. Le propriétaire d’une équipe peut la supprimer depuis l’application. Certaines traces peuvent être conservées temporairement pour la sécurité, les sauvegardes et la défense de droits.`],
      ["Droit applicable et différends", "Les CGU sont soumises au droit français, sous réserve des règles impératives protégeant l’utilisateur dans son pays de résidence. En cas de différend, les parties cherchent d’abord une solution amiable par la page Contact avant de saisir la juridiction compétente."],
      ["Évolution des CGU", `NXT5 peut modifier les CGU pour adapter le service, la sécurité ou le cadre légal. Une modification importante sera signalée par un moyen adapté et pourra nécessiter une nouvelle acceptation. Version ${LEGAL_VERSION}, mise à jour le ${LEGAL_UPDATED_LABEL}.`],
      ["Bot Discord : installation et responsabilités", "Le bot permet de publier les games d’une équipe dans les salons qu’elle choisit. Son installation et sa liaison sont facultatives. La personne qui les configure doit être autorisée à agir pour l’équipe et le serveur Discord, informer les personnes concernées et vérifier que le contenu peut être partagé avec les lecteurs des salons retenus. L’invitation demande actuellement la permission Administrateur, qui dépasse les seules destinations sélectionnées dans NXT5. Le propriétaire ou capitaine gère la connexion côté NXT5 ; le staff autorisé peut publier et retirer des publications. Les personnes disposant de Gérer le serveur ou Administrateur dans Discord peuvent consulter le statut, mettre en pause ou reprendre les connexions des équipes reliées via les commandes du bot. Cela ne leur donne pas accès à l’espace NXT5. Plusieurs équipes peuvent partager un serveur avec des réglages distincts ; les permissions de lecture des salons restent gérées dans Discord."],
      ["Bot Discord : envois, arrêt et retrait", "Inviter le bot ne déclenche pas la diffusion des games. La liaison, le choix des salons et des catégories, le test fictif et l’activation sont des actions distinctes. La diffusion automatique, lorsqu’elle est choisie et activée, publie les nouvelles games éligibles ; elle ne republie pas automatiquement tout l’historique. Une publication existante, y compris créée manuellement, peut être actualisée lorsque ses données changent, tant que la connexion et la destination restent actives. Le partage manuel comporte un aperçu et une confirmation. Les mentions sont désactivées par défaut et limitées au rôle expressément choisi. Le test publie des données fictives sans mention, y compris si la connexion est en pause. La pause et la déconnexion n’effacent pas les messages existants, pas plus que la suppression de la game ou de l’équipe. Utilise le retrait dans l’historique avant de supprimer une équipe, ou demande la suppression dans Discord ; vérifie le résultat en cas d’envoi ou de retrait incertain. Les pannes, changements de permissions ou limites de Discord peuvent retarder ou empêcher une opération. Les conditions de Discord s’appliquent aussi à l’utilisation de sa plateforme."],
    ],
    resources: [
      ["Conditions d’utilisation Discord", "https://discord.com/terms"],
      ["Règles de la communauté Discord", "https://discord.com/guidelines"],
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
      ["Signalement", "Un contenu, un compte ou un accès problématique peut être signalé par un canal privé indiqué sur la page Contact. Indiquez les faits, la page ou l’équipe concernée et les éléments utiles, sans republier inutilement des données privées."],
      ["Mesures applicables", "Selon la gravité et la répétition des faits, NXT5 peut avertir l’utilisateur, retirer un contenu, réduire des droits, suspendre un accès ou supprimer un compte. Une mesure immédiate peut être prise pour protéger le service, une personne ou respecter une obligation légale."],
      ["Version", `Ce règlement fait partie des CGU. Version ${LEGAL_VERSION}, mise à jour le ${LEGAL_UPDATED_LABEL}.`],
      ["Utilisation du bot Discord", "Ne relie que les équipes et serveurs pour lesquels tu es autorisé. Garde les codes de liaison privés, vérifie les lecteurs des salons et informe les joueurs avant de diffuser leurs données. Ne publie pas de notes privées, de données sensibles ou de contenus obtenus sans droit. Le bot ne doit pas servir au spam, aux mentions abusives, au harcèlement ou à l’exposition de joueurs. Ne contourne pas les permissions, les confirmations ou les limites d’envoi. Signale en privé une publication non autorisée et mets la connexion en pause si tu es habilité à le faire."],
    ],
  },
  "/contact": {
    eyebrow: "Support",
    title: "Contact",
    intro: "Besoin d’aide, de signaler un souci ou de rejoindre la communauté NXT5 ? Retrouve ici le contact privé de NXT5 et son serveur Discord officiel.",
    sections: [
      ["Contact privé par e-mail", `Pour contacter ${NXT5_EDITOR_NAME}, éditeur de NXT5 et responsable du traitement des données, écris à ${NXT5_CONTACT_EMAIL}. Utilise cette adresse pour les demandes liées à ton compte, à la sécurité, à tes données personnelles ou à l’exercice de tes droits.`],
      ["Discord NXT5", "Le serveur Discord permet de centraliser les retours, les bugs, les idées de fonctionnalités et les demandes d’aide autour de NXT5. C’est le canal à privilégier pour obtenir une réponse rapide."],
      ["Support produit", "Pour un problème technique, indique la page concernée, l’action réalisée, le message d’erreur affiché et, si possible, le contexte de l’équipe ou de l’import. Plus le signalement est précis, plus il peut être corrigé vite."],
      ["Supprimer ton compte", `Pour demander la suppression de ton compte ou l’examen de données personnelles présentes dans des contenus partagés, écris à ${NXT5_CONTACT_EMAIL}. NXT5 peut demander des éléments raisonnables pour vérifier ton identité.`],
      ["Sécurité et données", `Pour une demande sensible liée à un compte, une équipe, des données ou un accès, écris à ${NXT5_CONTACT_EMAIL}. Un message privé à l’équipe NXT5 sur Discord reste possible. Ne publie aucune information privée dans un salon public. Précise s’il s’agit d’une demande d’accès, de rectification, d’effacement, de limitation, de portabilité ou d’opposition.`],
      ["Délai de réponse", "Les demandes relatives aux données personnelles sont traitées en principe sous un mois. Pour protéger le compte, NXT5 peut demander des éléments raisonnables permettant de vérifier l’identité du demandeur."],
      ["Incident ou publication Discord", "Pour signaler une diffusion non autorisée, une liaison suspecte ou demander le retrait de données publiées par le bot, contacte NXT5 en privé. Indique l’équipe, le serveur ou salon concerné, la date et le lien ou l’identifiant du message, si tu les connais. N’envoie aucun mot de passe, jeton du bot ou code de liaison. Un responsable peut mettre la connexion en pause dans NXT5 et un responsable du serveur peut retirer le bot dans Discord. Les messages déjà envoyés nécessitent un retrait distinct ; contacte aussi les responsables du serveur si leur suppression est urgente."],
    ],
    contact: true,
  },
};

export function LegalPage({ route, navigate, user }) {
  const page = LEGAL_PAGES[route.path] || LEGAL_PAGES["/mentions-legales"];
  const group = INFORMATION_GROUPS.find((item) => item.pages.some(([path]) => path === route.path)) || INFORMATION_GROUPS[0];
  const sectionId = (index) => `document-${route.path.replace(/\//g, "")}-${index + 1}`;
  return (
    <div className="nxt5-information-page">
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
      <main className="nxt5-information-main">
        <PublicInformationNav navigate={navigate} activePath={route.path} />
        <header className="nxt5-information-hero nxt5-enter">
          <Badge tone="cyan">{page.eyebrow}</Badge>
          <h1 id="document-title" className="nxt5-metal-text">{page.title}</h1>
          <p>{page.intro}</p>
          {!page.contact && <div className="nxt5-document-meta"><FileText aria-hidden="true" size={16} /><span>Version applicable : {LEGAL_VERSION}</span></div>}
        </header>
        <div className="nxt5-legal-layout">
          <aside className="nxt5-document-sidebar">
            <nav aria-label={group.label} className="nxt5-document-menu">
              <p className="nxt5-information-label">Dans cette rubrique</p>
              {group.pages.map(([href, label]) => (
                <PublicTextLink key={href} href={href} navigate={navigate} aria-current={route.path === href ? "page" : undefined}>
                  <span>{label}</span><ChevronRight aria-hidden="true" size={16} />
                </PublicTextLink>
              ))}
            </nav>
            <details key={route.path} className="nxt5-document-outline">
              <summary>Sommaire du document<ChevronDown aria-hidden="true" size={16} /></summary>
              <nav aria-label="Sommaire du document">
                <ol>{page.sections.map(([title], index) => (
                  <li key={title}><a href={`#${sectionId(index)}`}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{title}</a></li>
                ))}</ol>
              </nav>
            </details>
            {!page.contact && <PublicTextLink href="/contact" navigate={navigate} className="nxt5-document-help">Une question ? Contacte l’équipe<ArrowRight aria-hidden="true" size={16} /></PublicTextLink>}
          </aside>
          <Surface className="nxt5-document-surface">
            <article aria-labelledby="document-title" className="nxt5-document-body">
              {page.sections.map(([title, text], index) => (
                <section id={sectionId(index)} key={title} tabIndex={-1} className="nxt5-document-section">
                  <h2><span aria-hidden="true" className="nxt5-section-number">{String(index + 1).padStart(2, "0")}</span>{title}</h2>
                  <p>{text}</p>
                </section>
              ))}
              {!!page.resources?.length && <section className="nxt5-document-resources">
                <h2>Références et garanties</h2>
                <ul>{page.resources.map(([label, href]) => (
                  <li key={href}><a href={href} target="_blank" rel="noopener noreferrer"><span>{label}<span className="sr-only"> (nouvel onglet)</span></span><ArrowUpRight aria-hidden="true" size={16} /></a></li>
                ))}</ul>
              </section>}
              {page.contact && <div className="nxt5-document-contact"><LinkButton href="/reseaux" navigate={navigate} icon={Users}>Réseaux et contact NXT5</LinkButton><p>Retrouve le lien Discord officiel et les conseils pour contacter l’équipe en privé.</p></div>}
              <a href="#document-title" className="nxt5-back-to-top">Retour en haut du document</a>
            </article>
          </Surface>
        </div>
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
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-200 md:text-lg">Importe tes games, prépare les reviews et suis le travail de l’équipe au même endroit.</p>
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
              <h2 className="nxt5-metal-text mt-3 text-3xl font-black md:text-4xl">Tout le suivi de l’équipe au même endroit</h2>
            </div>
            <p className="max-w-2xl text-sm font-semibold leading-6 text-slate-300">Le premier usage reste guidé. Les analyses avancées arrivent ensuite, quand la team a assez de games.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: Users, title: "Pose le roster", text: "Crée la team, ajoute les joueurs et relie les profils. NXT5 sait ensuite à qui appartient chaque donnée.", t: "cyan" },
            { icon: Swords, title: "Ajoute les games", text: "Importe une game ou un bloc de scrim. Le site garde le side, les champions, les objectifs et les stats importantes.", t: "purple" },
            { icon: Activity, title: "Compare les blocs", text: "Retrouve les résultats, les écarts par rôle et les games à revoir.", t: "blue" },
          ].map((item, i) => { const Icon = item.icon; return <Surface key={item.title} delay={i * .06} glow><div className={cx("mb-5 inline-flex rounded-2xl border p-4", tone(item.t))}><Icon className="h-7 w-7" /></div><h3 className="text-xl font-black text-white">{item.title}</h3><p className="mt-3 text-base font-medium leading-7 text-slate-300">{item.text}</p></Surface>; })}
          </div>
        </section>

        <section id="analytics" className="nxt5-panel nxt5-premium-panel relative mt-14 overflow-hidden border border-cyan-200/18 p-6 shadow-2xl shadow-black/25 md:p-9">
          <div className="mb-8 text-center"><h2 className="text-3xl font-black text-white md:text-4xl">De la game à la review</h2><p className="mt-3 text-base font-semibold text-slate-300">Les données de la game restent accessibles pendant la review.</p></div>
          <div className="grid gap-5 md:grid-cols-4">
            {[["1", Swords, "Importe la game", "Retrouve les champions, le side, le patch et les objectifs."], ["2", Eye, "Vérifie les stats", "Compare la vision, les dégâts, l’or, le KDA et le KP."], ["3", Crown, "Mets les pools à jour", "Classe les picks de chaque joueur selon leur niveau de maîtrise."], ["4", Target, "Prépare la review", "Note ce qui doit être gardé ou corrigé."]].map(([n, Icon, title, text]) => <div key={n} className="nxt5-panel relative border border-cyan-100/14 bg-black/[0.24] p-5 transition hover:-translate-y-1 hover:border-cyan-200/28"><Badge tone={n === "1" ?"cyan" : "purple"}>{n}</Badge><div className="mt-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-100"><Icon className="h-5 w-5" /></div><h3 className="mt-5 text-lg font-black text-white">{title}</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{text}</p></div>)}
          </div>
          <div className="mt-8 flex justify-center"><LinkButton href="/creer-un-compte" navigate={navigate} icon={ArrowRight} className="px-7 py-4">Créer l’espace équipe</LinkButton></div>
        </section>

        <section className="mt-10"><StatStrip /></section>

        <section className="mt-14">
          <Surface glow>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge tone="cyan">Review ready</Badge>
                <h2 className="nxt5-metal-text mt-3 text-3xl font-black md:text-4xl">Prépare une review claire</h2>
              </div>
              <Nxt5Wordmark className="h-12 w-48 object-right opacity-90" />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {["Comparer les champions joués et leur volume.", "Voir les écarts de stats de l’équipe.", "Préparer une review pour le staff.", "Préparer la prochaine session avec les données disponibles."].map((item, index) => <div key={item} className="nxt5-panel flex items-center gap-3 border border-white/10 bg-white/[0.035] p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-200/18 bg-cyan-400/10 text-xs font-black text-cyan-100">0{index + 1}</span><Check className="h-5 w-5 shrink-0 text-emerald-300" /><span className="font-bold text-slate-200">{item}</span></div>)}
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
          <Badge tone="purple">Sécurité du compte</Badge>
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
          <Badge tone="purple">Nouveau mot de passe</Badge>
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
      if (result.user?.id && !result.user.is_platform_admin) void trackAudienceEvent(isRegister ? "signup" : "login");
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
