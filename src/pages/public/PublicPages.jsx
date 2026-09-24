import React, { useState } from "react";
import { LEGAL_UPDATED_LABEL, LEGAL_VERSION, NXT5_CONTACT_EMAIL, NXT5_EDITOR_NAME } from "../../../shared/legal.js";
import { ArrowRight, ArrowUpRight, BarChart3, Check, ChevronDown, ChevronRight, FileText, Heart, Loader2, Lock, Mail, Shield, Swords, Target, UserPlus, Users } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { AUDIENCE_CONSENT_VERSION, openCookieSettings, trackAudienceEvent } from "../../app/audience-client.js";
import { cx, readRememberPreference, writeRememberPreference } from "../../app/helpers.js";
import { isSafeInternalPath } from "../../app/routing.js";
import { SUPPORT_URL } from "../../app/support.js";
import { Nxt5Wordmark, RoleIcon } from "../../components/brand/BrandAssets.jsx";
import { AmbientBackground } from "../../components/layout/AppChrome.jsx";
import { Badge, Button, PremiumToggle, Surface, TextInput } from "../../components/ui/Core.jsx";
import { LegalConsent, SocialLogin, SocialNotice, SocialSignup, socialCallbackStatus, socialReturnContext } from "../../components/account/SocialAccounts.jsx";
import "./public-information.css";
import "./public-entry.css";
function MarketingPreview() {
  return (
    <figure className="nxt5-entry-preview">
      <Surface className="nxt5-entry-preview-surface">
        <div className="nxt5-entry-preview-top">
          <span className="nxt5-entry-preview-brand"><Swords aria-hidden="true" size={18} />Parties</span>
          <span className="nxt5-entry-example">Exemple illustratif</span>
        </div>
        <div className="nxt5-entry-preview-heading">
          <h2>Partie d’entraînement</h2>
          <p>Les cinq rôles · Détail d’une partie</p>
        </div>
        <div className="nxt5-entry-preview-roster" aria-label="Exemple de composition : les cinq rôles de l’équipe">
          {["TOP", "JGL", "MID", "ADC", "SUP"].map((role) => <div key={role}><RoleIcon role={role} className="h-8 w-8" /><span>{role}</span></div>)}
        </div>
        <div className="nxt5-entry-preview-readings" aria-label="Informations disponibles dans une partie">
          {[
            [BarChart3, "Statistiques", "Or, dégâts, vision"],
            [Target, "Chronologie", "Objectifs et combats"],
            [FileText, "Débrief", "Points à travailler"],
          ].map(([Icon, title, text]) => <div key={title}><Icon aria-hidden="true" size={18} /><strong>{title}</strong><span>{text}</span></div>)}
        </div>
        <div className="nxt5-entry-preview-footer"><span />Chaque observation reste liée à sa partie.</div>
      </Surface>
      <figcaption>Illustration du produit, sans donnée d’équipe réelle.</figcaption>
    </figure>
  );
}

export function LinkButton({ href, children, icon: Icon, variant = "primary", className = "", navigate, target, rel, ...props }) {
  const base = "nxt5-cyber-button nxt5-control inline-flex min-h-11 min-w-0 max-w-full items-center justify-center gap-2 whitespace-normal px-4 py-2.5 text-center text-sm font-semibold leading-5 transition duration-200";
  const variants = {
    primary: "nxt5-button-primary border",
    ghost: "nxt5-button-secondary border",
    danger: "nxt5-button-danger border",
  };

  function go(event) {
    if (!navigate || !isSafeInternalPath(href) || target === "_blank" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    navigate(href);
  }

  return <a {...props} href={href} onClick={go} target={target} rel={target === "_blank" ? "noopener noreferrer" : rel} className={cx(base, variants[variant], className)}>{Icon && <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />}<span className="min-w-0 break-words">{children}</span></a>;
}

export function SiteHeader({ children, navigate, simple = false }) {
  function goHome(event) {
    if (!navigate) return;
    event.preventDefault();
    navigate("/");
  }

  return (
    <header className="nxt5-entry-header">
      <a href="/" onClick={goHome} aria-label="Accueil NXT5" className="shrink-0 transition hover:opacity-90"><Nxt5Wordmark className="nxt5-entry-wordmark" /></a>
      {children && <div className="nxt5-entry-header-actions">{children}</div>}
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
        <div className="nxt5-footer-project">
          <p className="nxt5-footer-signature">Cinq rôles. Une même direction.</p>
          {SUPPORT_URL && <PublicTextLink href="/soutenir" navigate={navigate} className="nxt5-footer-support"><Heart aria-hidden="true" size={16} />Soutenir NXT5</PublicTextLink>}
        </div>
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
      ["Données de compte et de sécurité", "NXT5 traite l’adresse e-mail, le pseudonyme, le mot de passe sous forme hachée lorsqu’il existe, les préférences de notification, les dates de création et de dernière activité du compte, ainsi que l’état d’envoi d’un éventuel rappel d’inactivité. Pour sécuriser les connexions, le service traite aussi un identifiant de session haché, l’adresse IP, le navigateur utilisé, les tentatives récentes et des journaux d’actions."],
      ["Connexions Google, Discord, Apple et Riot — ajout du 23 septembre 2026", "Lorsque le service est activé, tu peux créer ton compte ou te connecter avec Google, Discord, Apple ou Riot. Tu t’authentifies directement auprès du fournisseur. NXT5 reçoit son identifiant stable, une adresse e-mail et son statut de vérification lorsqu’ils sont disponibles, ainsi qu’un éventuel nom d’affichage. Riot fournit un PUUID ; ce parcours ne lui demande pas d’e-mail. L’adresse masquée Apple est acceptée. Le pseudo, l’adresse de récupération et les textes applicables sont confirmés avant l’inscription. Une adresse saisie ou modifiée reste à vérifier. NXT5 conserve le fournisseur, l’identifiant stable, le nom d’affichage et la date d’association ; les informations provisoires d’inscription expirent après cinq minutes et sont retirées au prochain nettoyage quotidien ou au démarrage suivant. Aucun compte existant n’est fusionné sur la seule correspondance d’une adresse e-mail. Tu peux associer une méthode depuis Paramètres, puis la retirer en confirmant ton mot de passe NXT5. Une récupération du compte par e-mail retire les associations et termine les sessions ; elles peuvent ensuite être ajoutées à nouveau. NXT5 ne reçoit jamais ton mot de passe fournisseur et ne conserve aucun jeton d’accès, d’identité ou de renouvellement fournisseur. Les associations disparaissent avec la suppression effective du compte NXT5. Chaque fournisseur traite l’authentification selon sa propre politique ; les données de ton équipe ne sont pas transmises par cette connexion."],
      ["Données d’équipe et de jeu", "Le service peut traiter les équipes, rôles et invitations, profils joueurs, Riot IDs, disponibilités, objectifs, notes de coaching, compositions, champion pools, reviews, Game IDs, fichiers de match importés, chronologies de partie, statistiques et pseudonymes publics des participants. Certaines notes peuvent contenir des appréciations rédigées par le staff de l’équipe."],
      ["Mesure de fréquentation — ajout du 14 septembre 2026", "Avec ton consentement préalable, NXT5 mesure les pages consultées, la durée active et le défilement, les sources de visite, les libellés de campagnes, la catégorie d’appareil, la famille du navigateur, le pays approximatif fourni par l’hébergeur et certaines actions réussies (création de compte, connexion, demande d’accès). Des identifiants aléatoires distinguent les navigateurs et les sessions : ces données sont pseudonymisées, pas anonymes. Elles ne sont pas rattachées aux comptes, aux données d’équipe ou aux e-mails. Les paramètres d’URL, les jetons, les contenus saisis et l’adresse IP ne sont pas enregistrés dans les statistiques. Les pages administrateur et les parcours de réinitialisation sont exclus. Les données et preuves de choix sont hébergées par Netlify et Neon, accessibles uniquement à l’administrateur de plateforme, et supprimées automatiquement au terme de leur durée de conservation de 180 jours. Les traitements techniques de sécurité et les journaux propres à l’hébergeur restent distincts. Tu peux refuser sans limiter le service et retirer ton accord à tout moment avec « Gérer mes cookies » dans le pied de page. Le retrait arrête les collectes futures ; les données déjà collectées restent soumises à la durée annoncée et à tes droits d’effacement via la page Contact. La base juridique de cette mesure est ton consentement."],
      ["Demandes d’accès et offres en préparation — ajout du 8 septembre 2026", "Le formulaire Tarifs recueille ton nom de contact, ton e-mail, le nom de ton équipe, ton rôle, la formule souhaitée, le payeur envisagé et ton intention d’achat. Le message libre est facultatif. Ton accord pour être recontacté, sa version et sa date sont enregistrés avec la demande. Ces informations servent uniquement à répondre à ta demande et à préparer l’offre avec les équipes intéressées ; elles sont accessibles à l’administration NXT5 et hébergées par Netlify et Neon. Les coordonnées, réponses et notes de suivi sont supprimées après six mois à compter de la demande, lors du nettoyage quotidien. Aucune inscription à une newsletter ni aucun paiement n’en résulte. Tu peux demander la rectification ou la suppression de ta demande et retirer ton accord par le canal privé de la page Contact."],
      ["Origine des données", "Les données proviennent de l’utilisateur, des autres membres autorisés de son équipe, des fichiers de match importés, de profils de jeu accessibles au public et des API Riot. Une personne peut donc apparaître dans un roster ou un match sans avoir elle-même créé de compte NXT5."],
      ["Finalités et bases juridiques", "La création du compte, l’accès aux équipes, l’import et l’analyse des matchs reposent sur l’exécution des CGU. La sécurisation du service, la prévention des abus, la traçabilité et l’amélioration de sa fiabilité reposent sur l’intérêt légitime de NXT5 et de ses utilisateurs. Les notifications facultatives, dont le rappel unique après trois mois d’inactivité, reposent sur le choix de l’utilisateur et peuvent être désactivées dans les paramètres."],
      ["Données obligatoires ou facultatives", "L’e-mail de récupération et le pseudonyme sont nécessaires. L’accès utilise soit un mot de passe NXT5, soit une connexion externe associée. Un mot de passe NXT5 peut être défini ensuite par un lien reçu à l’adresse de récupération. Les données d’équipe, Riot IDs, disponibilités, imports, notes et réglages de notification sont facultatifs, mais certaines fonctions resteront incomplètes s’ils ne sont pas renseignés."],
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
      ["Cookies temporaires de connexion externe — ajout du 23 septembre 2026", "Lorsque tu démarres une connexion, une inscription ou une association externe, les cookies nécessaires __Host-nxt5_social_flow et __Host-nxt5_social_ticket relient la demande à ton navigateur et permettent son retour sécurisé. Ils sont Secure et HttpOnly, valables cinq minutes au maximum pour chaque étape. Ils ne contiennent ni mot de passe ni jeton d’accès fournisseur. Le cookie de parcours utilise SameSite=None uniquement lors du retour Apple par formulaire ; les autres étapes utilisent SameSite=Lax. L’état de vérification et les résultats provisoires expirent après cinq minutes et ne peuvent être consommés qu’une fois. Les données utilisées sont supprimées pendant la finalisation ; les demandes abandonnées sont retirées au prochain démarrage ou nettoyage quotidien. Ces cookies ne servent pas à mesurer la fréquentation."],
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
    <div className="nxt5-entry-page nxt5-home-page">
      <AmbientBackground />
      <SiteHeader navigate={navigate} simple>
        <a href="#features" className="nxt5-entry-header-link">Fonctionnalités</a>
        {SUPPORT_URL && <PublicTextLink href="/soutenir" navigate={navigate} className="nxt5-entry-header-link">Soutenir NXT5</PublicTextLink>}
        <LinkButton href="/connexion" navigate={navigate} variant="ghost">Se connecter</LinkButton>
      </SiteHeader>
      <main className="nxt5-entry-main">
        <section className="nxt5-entry-hero" aria-labelledby="home-title">
          <div className="nxt5-entry-hero-copy">
            <p className="nxt5-entry-eyebrow">Pour les équipes League of Legends</p>
            <h1 id="home-title">Comprends tes parties.<br /><span>Prépare la suite.</span></h1>
            <p className="nxt5-entry-lead">Ajoute tes joueurs, importe une partie et retrouve les points à discuter en équipe. Prépare ta prochaine séance au même endroit.</p>
            <div className="nxt5-entry-actions">
              <LinkButton href="/creer-un-compte" navigate={navigate} icon={ArrowRight}>Créer mon espace</LinkButton>
              <a href="#workflow" className="nxt5-entry-text-link">Comment ça marche<ChevronDown aria-hidden="true" size={16} /></a>
            </div>
            <p className="nxt5-entry-hero-note">Un parcours guidé, dès ta première équipe.</p>
          </div>
          <MarketingPreview />
        </section>

        <section id="features" className="nxt5-entry-features" aria-labelledby="features-title">
          <div className="nxt5-entry-section-heading">
            <p className="nxt5-entry-eyebrow">Un espace de travail commun</p>
            <h2 id="features-title">Tes joueurs, tes parties,<br />tes prochains entraînements.</h2>
            <p>Retrouve ce qu’il te faut pour organiser l’équipe et comprendre ses parties.</p>
          </div>
          <div className="nxt5-entry-feature-list">
            {[
              [Users, "Organise l’équipe", "Ajoute les joueurs et leur rôle, puis partage les disponibilités. Chacun retrouve les prochaines séances dans le planning."],
              [BarChart3, "Comprends tes parties", "Importe une partie pour lire son résultat, les statistiques et les moments clés. Compare ensuite plusieurs parties dans Analyses."],
              [Target, "Prépare la prochaine séance", "Note les points à travailler dans un débrief. Prépare les choix de champions avec ton équipe dans Draft."],
            ].map(([Icon, title, text], index) => <article className="nxt5-entry-feature" key={title}><div className="nxt5-entry-feature-heading"><Icon aria-hidden="true" size={23} /><span>0{index + 1}</span></div><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </section>

        <section id="workflow" className="nxt5-entry-workflow" aria-labelledby="workflow-title">
          <div className="nxt5-entry-section-heading">
            <p className="nxt5-entry-eyebrow">Pour commencer</p>
            <h2 id="workflow-title">De ta première équipe<br />au premier débrief.</h2>
            <p>Le site rassemble les faits. Ton équipe décide des points à travailler.</p>
          </div>
          <ol className="nxt5-entry-steps">
            {[
              ["Réunis tes joueurs", "Crée ou rejoins une équipe, puis ajoute les profils des joueurs."],
              ["Importe une partie", "NXT5 Importer récupère le fichier à ajouter dans Parties."],
              ["Repère les écarts", "Commence par le résumé, puis ouvre les détails utiles."],
              ["Prépare un débrief", "Garde vos observations et les points à travailler ensemble."],
            ].map(([title, text], index) => <li key={title}><span>0{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}
          </ol>
        </section>

        <section className="nxt5-entry-start" aria-labelledby="start-title">
          <div><p className="nxt5-entry-eyebrow">À toi de commencer</p><h2 id="start-title">Retrouve ton équipe sur NXT5.</h2><p>Crée ton compte, puis ouvre ou rejoins ton espace équipe.</p></div>
          <LinkButton href="/creer-un-compte" navigate={navigate} icon={ArrowRight}>Créer un compte</LinkButton>
        </section>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}

export function NotFoundPage({ navigate }) {
  return (
    <div className="nxt5-entry-page nxt5-auth-page">
      <AmbientBackground />
      <SiteHeader navigate={navigate}>
        <LinkButton href="/connexion" navigate={navigate} variant="ghost" className="hidden md:inline-flex">Se connecter</LinkButton>
        <LinkButton href="/creer-un-compte" navigate={navigate}>Créer un compte</LinkButton>
      </SiteHeader>
      <main className="nxt5-entry-main nxt5-recovery-main">
        <Surface className="nxt5-auth-card">
          <Badge tone="red">404</Badge>
          <h1>Page introuvable</h1>
          <p className="nxt5-auth-intro">Cette URL ne correspond à aucune page NXT5. Reviens à l’accueil ou connecte-toi pour accéder à ton espace.</p>
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
    <div className="nxt5-entry-page nxt5-auth-page">
      <AmbientBackground />
      <SiteHeader navigate={navigate} simple>
        <PublicTextLink href="/connexion" navigate={navigate} className="nxt5-entry-header-link">Retour à la connexion</PublicTextLink>
      </SiteHeader>
      <main className="nxt5-entry-main nxt5-recovery-main">
        <Surface className="nxt5-auth-card">
          <p className="nxt5-entry-eyebrow">Récupération du compte</p>
          <h1>Mot de passe oublié ?</h1>
          <p className="nxt5-auth-intro">Entre l’e-mail de ton compte pour recevoir un lien de réinitialisation.</p>
          <form onSubmit={submit} className="nxt5-auth-form">
            <TextInput label="E-mail du compte" value={email} onChange={setEmail} placeholder="joueur@exemple.com" type="email" autoComplete="email" required icon={Mail} />
            {message && <div role="status" className="nxt5-auth-notice is-success">{message}</div>}
            {error && <div role="alert" className="nxt5-auth-notice is-error">{error}</div>}
            <Button type="submit" disabled={loading || !email.trim()} icon={loading ? Loader2 : Mail} className="nxt5-auth-submit">{loading ? "Envoi..." : "Envoyer le lien"}</Button>
          </form>
          <p className="nxt5-auth-alternative"><PublicTextLink href="/connexion" navigate={navigate}>Retour à la connexion</PublicTextLink></p>
        </Surface>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}

export function ResetPasswordPage({ navigate, onAuth }) {
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
      onAuth?.(null);
      setDone(true);
      setForm({ nextPassword: "", confirmPassword: "" });
    } catch (err) {
      setError(err.message || "Réinitialisation impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="nxt5-entry-page nxt5-auth-page">
      <AmbientBackground />
      <SiteHeader navigate={navigate}>
        <LinkButton href="/connexion" navigate={navigate} variant="ghost" className="hidden md:inline-flex">Connexion</LinkButton>
      </SiteHeader>
      <main className="nxt5-entry-main nxt5-recovery-main">
        <Surface className="nxt5-auth-card">
          <Badge tone="purple">Nouveau mot de passe</Badge>
          <h1>Réinitialiser le mot de passe</h1>
          {!token ? (
            <div className="mt-6 space-y-4"><p role="alert" className="nxt5-auth-notice is-error">Ce lien de réinitialisation est incomplet. Demande un nouveau lien pour retrouver l’accès à ton compte.</p><LinkButton href="/mot-de-passe-oublie" navigate={navigate}>Demander un nouveau lien</LinkButton></div>
          ) : done ? (
            <div className="mt-6 space-y-4">
              <div role="status" className="nxt5-auth-notice is-success">Mot de passe mis à jour. Connecte-toi avec ton e-mail et ce mot de passe, puis associe à nouveau tes comptes externes dans Paramètres.</div>
              <LinkButton href="/connexion" navigate={navigate} icon={Lock}>Retour connexion</LinkButton>
            </div>
          ) : (
            <form onSubmit={submit} className="nxt5-auth-form">
              <p className="text-sm leading-6 text-slate-300">Cette opération ferme tes sessions et dissocie tes comptes Google, Discord, Apple et Riot. Tu pourras les associer à nouveau après ta connexion avec ton nouveau mot de passe.</p>
              <TextInput label="Nouveau mot de passe" value={form.nextPassword} onChange={(nextPassword) => setForm((current) => ({ ...current, nextPassword }))} placeholder="8 caractères minimum" type="password" required icon={Shield} />
              <TextInput label="Confirmer" value={form.confirmPassword} onChange={(confirmPassword) => setForm((current) => ({ ...current, confirmPassword }))} placeholder="Répète le nouveau mot de passe" type="password" required icon={Check} />
              {error && <div role="alert" className="nxt5-auth-notice is-error">{error}</div>}
              <Button type="submit" disabled={loading || !form.nextPassword || !form.confirmPassword} icon={loading ?Loader2 : Shield} className="nxt5-auth-submit">{loading ?"Mise à jour..." : "Changer le mot de passe"}</Button>
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
  const socialStatus = socialCallbackStatus();
  const queryParams = new URLSearchParams(window.location.search);
  const isSocialComplete = isRegister && queryParams.get("social") === "complete";
  const returnContext = socialReturnContext();
  if (socialStatus === "existing_account") returnContext.next = "/parametres";
  const navigationParams = new URLSearchParams(returnContext);
  const querySuffix = navigationParams.size ? `?${navigationParams.toString()}` : "";

  function completeAuth(nextUser, serverDestination) {
    if (nextUser?.id && !nextUser.is_platform_admin) void trackAudienceEvent(isRegister ? "signup" : "login");
    writeRememberPreference(rememberMe);
    pushToast({ type: "green", title: isRegister ? "Compte créé" : "Connexion réussie", text: "Bienvenue sur NXT5." });
    const destination = isSafeInternalPath(serverDestination) && !/[\\\u0000-\u001f\u007f]/.test(serverDestination)
      ? serverDestination
      : returnContext.invite
        ? `/equipes?invite=${encodeURIComponent(returnContext.invite)}`
        : returnContext.next || (isRegister ? "/equipes?create=1" : "/equipes");
    navigate(destination, { replace: true });
    onAuth(nextUser);
  }

  function patch(key, value) { setForm((current) => ({ ...current, [key]: value })); }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const endpoint = isRegister ?"auth-register" : "auth-login";
      const body = { accountName: form.email, email: form.email, displayName: form.displayName, password: form.password, rememberMe, acceptLegal: isRegister ? legalAccepted : undefined, legalVersion: isRegister ? LEGAL_VERSION : undefined };
      const result = await apiFetch(endpoint, { method: "POST", body: JSON.stringify(body) });
      completeAuth(result.user);
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
    <div className="nxt5-entry-page nxt5-auth-page nxt5-social-auth">
      <AmbientBackground />
      <SiteHeader navigate={navigate} simple>
        <PublicTextLink href={isRegister ? `/connexion${querySuffix}` : `/creer-un-compte${querySuffix}`} navigate={navigate} className="nxt5-entry-header-link">
          {isRegister ? "J’ai déjà un compte" : "Créer un compte"}
        </PublicTextLink>
      </SiteHeader>
      <main className="nxt5-entry-main nxt5-auth-layout">
        <section className="nxt5-auth-story" aria-labelledby="auth-story-title">
          <p className="nxt5-entry-eyebrow">Ton espace équipe</p>
          <h2 id="auth-story-title">Cinq rôles.<br /><span>Un travail commun.</span></h2>
          <p>Retrouve tes joueurs, tes parties et les points à travailler lors de la prochaine séance.</p>
          <ul>
            {[[Users, "Les joueurs de ton équipe", "Profils, rôles et disponibilités au même endroit."], [BarChart3, "Tes parties à portée de main", "Le résumé et les statistiques restent liés à chaque partie."], [FileText, "Vos débriefs au même endroit", "Garde les observations et les prochaines actions de l’équipe."]].map(([Icon, title, text]) => <li key={title}><Icon aria-hidden="true" size={21} /><div><strong>{title}</strong><span>{text}</span></div></li>)}
          </ul>
        </section>
        <Surface className="nxt5-auth-card">
          <p className="nxt5-entry-eyebrow">{isRegister ? "Bienvenue sur NXT5" : "Bon retour sur NXT5"}</p>
          <h1>{isSocialComplete ? "Termine ton inscription" : isRegister ? "Créer un compte" : "Connexion"}</h1>
          <p className="nxt5-auth-intro">{isSocialComplete ? "Confirme tes informations pour créer ton compte NXT5." : isRegister ? "Crée ton compte pour ouvrir ou rejoindre un espace équipe." : "Retrouve tes équipes, tes parties et tes débriefs."}</p>
          {socialStatus && <div className="mt-4"><SocialNotice status={socialStatus} /></div>}
          {isSocialComplete ? <SocialSignup onComplete={completeAuth} loginHref="/connexion?next=%2Fparametres" /> : <>
          <SocialLogin flow={isRegister ? "register" : "login"} rememberMe={rememberMe} disabled={loading} />
          <form onSubmit={submit} className="nxt5-auth-form">
            <TextInput label={isRegister ? "E-mail" : "E-mail ou ancien pseudo"} value={form.email} onChange={(v) => patch("email", v)} placeholder={isRegister ? "joueur@exemple.com" : "joueur@exemple.com ou ancien pseudo"} type={isRegister ? "email" : "text"} autoComplete={isRegister ? "email" : "username"} required icon={Mail} />
            {isRegister && <TextInput label="Pseudo" value={form.displayName} onChange={(v) => patch("displayName", v)} placeholder="Ex : Joueur NXT5" autoComplete="nickname" required icon={UserPlus} />}
            <TextInput label="Mot de passe" value={form.password} onChange={(v) => patch("password", v)} placeholder="••••••••" type="password" autoComplete={isRegister ? "new-password" : "current-password"} required icon={Lock} />
            <div className="nxt5-auth-preferences"><PremiumToggle checked={rememberMe} onChange={setRememberMe} title="Rester connecté" text="Sur cet appareil." /></div>
            {isRegister && <LegalConsent checked={legalAccepted} onChange={setLegalAccepted} />}
            {error && <div role="alert" className="nxt5-auth-notice is-error">{error}</div>}
            <Button type="submit" disabled={loading || (isRegister && !legalAccepted)} icon={loading ? Loader2 : isRegister ? UserPlus : ArrowRight} className="nxt5-auth-submit">{loading ? "Chargement…" : isRegister ? "Créer le compte" : "Entrer dans NXT5"}</Button>
          </form>
          {!isRegister && <div className="nxt5-auth-recovery"><PublicTextLink href="/mot-de-passe-oublie" navigate={navigate}>Mot de passe oublié ?</PublicTextLink></div>}
          <p className="nxt5-auth-alternative">{isRegister ? "Déjà inscrit ? " : "Pas encore de compte ? "}<PublicTextLink href={isRegister ? `/connexion${querySuffix}` : `/creer-un-compte${querySuffix}`} navigate={navigate}>{isRegister ? "Connexion" : "Créer un compte"}</PublicTextLink></p>
          </>}
        </Surface>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}
