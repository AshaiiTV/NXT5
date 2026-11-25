import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React from "react";
import { NXT5_CONTACT_EMAIL } from "../../../shared/legal.js";
import { ArrowRight, ArrowUpRight, Camera, LifeBuoy, MessageCircle, Play, Radio, Shield, Users } from "lucide-react";
import { getSocialLinks } from "../../app/social-links.js";
import { AmbientBackground } from "../../components/layout/AppChrome.jsx";
import { MonolithePicture } from "../../components/brand/BrandAssets.jsx";
import { PageHeader, Surface } from "../../components/ui/Core.jsx";
import { LegalLinks, LinkButton, PublicInformationNav, PublicTextLink, SiteHeader } from "./PublicChrome.jsx";

const COMMUNITY_USES = [
  [Users, "Rencontre la communauté", "Échange avec les joueurs et les encadrants."],
  [MessageCircle, "Partage tes idées", "Partage tes retours et tes idées."],
  [LifeBuoy, "Trouve un coup de main", "Pose tes questions sur le site et ses outils."],
];

const NETWORK_ICONS = { instagram: Camera, youtube: Play };

export default function SocialPage({ navigate, user }) {
  useLanguage();
  const links = getSocialLinks();
  const discord = links.find((network) => network.id === "discord");
  const otherNetworks = links.filter((network) => network.id !== "discord");
  return (
    <div className="nxt5-information-page">
      <AmbientBackground />
      <SiteHeader navigate={navigate}>
        <LinkButton href={user ? "/mon-equipe" : "/connexion"} navigate={navigate} variant="ghost">
          {user ? t("Mon équipe") : t("Se connecter")}
        </LinkButton>
      </SiteHeader>
      <main className="nxt5-information-main">
        <PublicInformationNav navigate={navigate} activePath="/reseaux" />
        <header className="nxt5-community-hero" aria-labelledby="community-title">
          <div className="nxt5-community-copy">
            <h1 id="community-title">{t("Communauté NXT5")}</h1>
            {discord && <>
              <p>{t(discord.description)}</p>
              <LinkButton href={discord.href} target="_blank" icon={ArrowUpRight} aria-describedby="social-new-tab">{t("Rejoindre le Discord")}</LinkButton>
            </>}
          </div>
          <MonolithePicture sizes="(max-width: 767px) calc(100vw - 2rem), (max-width: 1279px) 56vw, 710px" loading="eager" />
        </header>

        {discord && <ul className="nxt5-community-uses" aria-label={t("Discord officiel")}>{COMMUNITY_USES.map(([Icon, title, text]) => (
          <li key={title}><Icon aria-hidden="true" size={22} /><div><h2>{t(title)}</h2><p>{t(text)}</p></div></li>
        ))}</ul>}

        {!!otherNetworks.length && <section className="nxt5-other-networks" aria-labelledby="other-networks-title">
          <h2 id="other-networks-title">{t("Les vidéos et les actualités NXT5")}</h2>
          <Surface variant="glass"><ul className="nxt5-network-list">{otherNetworks.map((network) => {
            const Icon = NETWORK_ICONS[network.id] || Radio;
            return (
              <li key={network.id}><a href={network.href} target="_blank" rel="noopener noreferrer" aria-describedby="social-new-tab">
                <Icon aria-hidden="true" size={22} /><span><strong>{t(network.label)}</strong><span>{t(network.description)}</span></span><ArrowUpRight aria-hidden="true" size={20} />
              </a></li>
            );
          })}</ul></Surface>
        </section>}
        {!links.length && <Surface variant="glass"><p className="nxt5-community-empty">{t("Aucun lien vers les réseaux de NXT5 n’est disponible sur cette page.")}</p></Surface>}
        <p id="social-new-tab" className="nxt5-social-link-note"><ArrowUpRight aria-hidden="true" size={15} />{t("Liens ouverts dans un nouvel onglet.")}</p>

        <section id="contact" className="nxt5-contact-section" aria-label={t("Contacter NXT5")}>
          <PageHeader eyebrow={t("Besoin d’aide ?")} title={t("Contacter l’équipe")} subtitle={t("Choisis le contact adapté à ta demande.")} />
          <div className="nxt5-contact-layout">
            <div className="nxt5-contact-privacy">
              <Shield aria-hidden="true" size={24} />
              <h3>{t("Une question sur")}<br />{t("ton compte ?")}</h3>
              <p>{t("Pour ton compte ou tes données personnelles, écris à ")}<a href={`mailto:${NXT5_CONTACT_EMAIL}`} className="break-words underline underline-offset-4">{NXT5_CONTACT_EMAIL}</a>{t(". Un message privé sur Discord reste possible. Ne publie jamais de mot de passe ni de donnée sensible dans un salon public.")}</p>
              <PublicTextLink href="/confidentialite" navigate={navigate}>{t("Consulter la confidentialité")}<ArrowUpRight aria-hidden="true" size={16} /></PublicTextLink>
            </div>
            <Surface variant="glass" className="nxt5-support-surface">
              <div className="nxt5-contact-privacy">
                <LifeBuoy aria-hidden="true" size={24} />
                <h3>{t("Trouve qui contacter.")}</h3>
                <p>{t("Pour une aide technique, ton compte ou tes données, ouvre Contact.")}</p>
                <PublicTextLink href="/contact" navigate={navigate}>{t("Consulter les contacts et les démarches")}<ArrowRight aria-hidden="true" size={16} /></PublicTextLink>
              </div>
            </Surface>
          </div>
          <p className="nxt5-community-rules">{t("Un espace pour échanger dans le respect de chacun. ")}<PublicTextLink href="/reglement" navigate={navigate}>{t("Lire le règlement NXT5")}</PublicTextLink></p>
        </section>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}
