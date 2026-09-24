import React from "react";
import { NXT5_CONTACT_EMAIL } from "../../../shared/legal.js";
import { ArrowUpRight, ChevronDown, LifeBuoy, MessageCircle, Radio, Shield, Users } from "lucide-react";
import { getSocialLinks } from "../../app/social-links.js";
import { AmbientBackground } from "../../components/layout/AppChrome.jsx";
import { Badge, PageHeader, Surface } from "../../components/ui/Core.jsx";
import { LEGAL_PAGES, LegalLinks, LinkButton, PublicInformationNav, PublicTextLink, SiteHeader } from "./PublicPages.jsx";

const COMMUNITY_USES = [
  [Users, "Rencontre la communauté", "Échange avec les joueurs et les encadrants."],
  [MessageCircle, "Fais avancer NXT5", "Partage tes retours et tes idées."],
  [LifeBuoy, "Trouve un coup de main", "Pose tes questions sur le site et ses outils."],
];

export default function SocialPage({ navigate, user }) {
  const links = getSocialLinks();
  const discord = links.find((network) => network.id === "discord");
  const otherNetworks = links.filter((network) => network.id !== "discord");
  const supportSections = LEGAL_PAGES["/contact"].sections.filter(([title]) => title !== "Discord NXT5");
  return (
    <div className="nxt5-information-page">
      <AmbientBackground />
      <SiteHeader navigate={navigate}>
        <LinkButton href={user ? "/equipes" : "/connexion"} navigate={navigate} variant="ghost">
          {user ? "Retour à l’app" : "Connexion"}
        </LinkButton>
      </SiteHeader>
      <main className="nxt5-information-main">
        <PublicInformationNav navigate={navigate} activePath="/reseaux" />
        <header className="nxt5-information-hero nxt5-enter">
          <Badge tone="cyan">La communauté NXT5</Badge>
          <h1 className="nxt5-metal-text">Réseaux & contact</h1>
          <p>Rejoins le Discord NXT5 pour poser une question ou partager une idée. Pour ton compte et tes données personnelles, contacte l’équipe en privé.</p>
        </header>

        {discord && <Surface glow className="nxt5-community-feature nxt5-enter">
          <div className="nxt5-community-layout">
            <div className="nxt5-community-intro">
              <div className="nxt5-community-platform"><MessageCircle aria-hidden="true" size={24} /><span>Discord officiel</span></div>
              <h2>Rejoins la communauté<br />sur Discord.</h2>
              <p>{discord.description}</p>
              <LinkButton href={discord.href} target="_blank" icon={ArrowUpRight} aria-describedby="social-new-tab">Rejoindre le Discord</LinkButton>
            </div>
            <ul className="nxt5-community-uses">{COMMUNITY_USES.map(([Icon, title, text]) => (
              <li key={title}><Icon aria-hidden="true" size={22} /><div><h3>{title}</h3><p>{text}</p></div></li>
            ))}</ul>
          </div>
        </Surface>}

        {!!otherNetworks.length && <section className="nxt5-other-networks" aria-labelledby="other-networks-title">
          <h2 id="other-networks-title">Retrouve-nous aussi ici</h2>
          <Surface><ul className="nxt5-network-list">{otherNetworks.map((network) => (
            <li key={network.id}><a href={network.href} target="_blank" rel="noopener noreferrer" aria-describedby="social-new-tab">
              <Radio aria-hidden="true" size={22} /><span><strong>{network.label}</strong><span>{network.description}</span></span><ArrowUpRight aria-hidden="true" size={20} />
            </a></li>
          ))}</ul></Surface>
        </section>}
        {!links.length && <Surface><p className="nxt5-community-empty">Les liens de la communauté seront disponibles prochainement.</p></Surface>}
        <p id="social-new-tab" className="nxt5-social-link-note"><ArrowUpRight aria-hidden="true" size={15} />Les liens vers les réseaux s’ouvrent dans un nouvel onglet.</p>

        <section id="contact" className="nxt5-contact-section" aria-label="Contacter NXT5">
          <PageHeader eyebrow="Besoin d’aide ?" title="Contacter l’équipe" subtitle="Choisis le contact adapté à ta demande." />
          <div className="nxt5-contact-layout">
            <div className="nxt5-contact-privacy">
              <Shield aria-hidden="true" size={24} />
              <h3>Une question sur<br />ton compte ?</h3>
              <p>Pour ton compte ou tes données personnelles, écris à <a href={`mailto:${NXT5_CONTACT_EMAIL}`} className="break-words underline underline-offset-4">{NXT5_CONTACT_EMAIL}</a>. Un message privé sur Discord reste possible. Ne publie jamais de mot de passe ni de donnée sensible dans un salon public.</p>
              <PublicTextLink href="/confidentialite" navigate={navigate}>Consulter la confidentialité<ArrowUpRight aria-hidden="true" size={16} /></PublicTextLink>
            </div>
            <Surface className="nxt5-support-surface">
              {supportSections.map(([title, text]) => <details key={title} className="nxt5-support-item">
                <summary>{title}<ChevronDown aria-hidden="true" size={18} /></summary>
                <p>{text}</p>
              </details>)}
            </Surface>
          </div>
          <p className="nxt5-community-rules">Un espace pour échanger dans le respect de chacun. <PublicTextLink href="/reglement" navigate={navigate}>Lire le règlement NXT5</PublicTextLink></p>
        </section>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}
