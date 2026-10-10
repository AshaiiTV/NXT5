import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React from "react";
import { ArrowLeft, ArrowUpRight, Heart, MessageCircle, Sparkles, Wrench } from "lucide-react";
import { normalizeSupportUrl, SUPPORT_URL } from "../../app/support.js";
import { AmbientBackground } from "../../components/layout/AppChrome.jsx";
import { Surface } from "../../components/ui/Core.jsx";
import { LegalLinks, LinkButton, PublicTextLink, SiteHeader } from "./PublicPages.jsx";
import "./support.css";

export function SupportPage({ navigate, user, supportUrl = SUPPORT_URL }) {
  useLanguage();
  const destination = normalizeSupportUrl(supportUrl);

  return (
    <div className="nxt5-entry-page nxt5-support-page">
      <AmbientBackground />
      <SiteHeader navigate={navigate} simple>
        <LinkButton href={user ? "/equipes" : "/connexion"} navigate={navigate} variant="ghost">
          {user ? t("Mon équipe") : t("Se connecter")}
        </LinkButton>
      </SiteHeader>
      <main className="nxt5-entry-main nxt5-support-main">
        <PublicTextLink href="/" navigate={navigate} className="nxt5-entry-text-link nxt5-support-back">
          <ArrowLeft aria-hidden="true" size={16} />{t("Retour à l’accueil")}</PublicTextLink>
        <div className="nxt5-support-layout">
          <section className="nxt5-support-story" aria-labelledby="support-title">
            <p className="nxt5-entry-eyebrow">{t("Un projet indépendant")}</p>
            <h1 id="support-title" className="nxt5-page-title">{t("Soutenir NXT5")}</h1>
            <p className="nxt5-support-intro">{t("Aide à améliorer l’outil que tu utilises avec ton équipe.")}</p>
            <p>{t("Je développe NXT5 pour aider les équipes à préparer leurs parties et à en tirer des pistes de progrès. Ton soutien contribue aux prochaines améliorations.")}</p>
            <ul className="nxt5-support-impact">
              <li><Sparkles aria-hidden="true" size={20} /><div><h2>{t("Faire évoluer l’outil")}</h2><p>{t("Améliorer les fonctionnalités qui accompagnent le travail de ton équipe.")}</p></div></li>
              <li><Wrench aria-hidden="true" size={20} /><div><h2>{t("Prendre soin du projet")}</h2><p>{t("Continuer à corriger, simplifier et améliorer NXT5 au quotidien.")}</p></div></li>
            </ul>
          </section>
          <section aria-labelledby="contribute-title" className="nxt5-support-contribute">
            <Surface className="nxt5-support-card">
              <Heart aria-hidden="true" className="nxt5-support-heart" size={28} />
              <h2 id="contribute-title">{t("Contribuer au développement")}</h2>
              <p>{t("Tu choisis le montant et la fréquence de ton soutien.")}</p>
              {destination ? (<>
                  <p className="nxt5-support-choice">{t("Choisis ton montant sur la page de soutien, pour une contribution ponctuelle ou mensuelle.")}</p>
                  <LinkButton href={destination} target="_blank" icon={ArrowUpRight} className="nxt5-support-cta">{t("Soutenir le projet")}<span className="sr-only">{t(" (nouvel onglet)")}</span>
                  </LinkButton>
                  <p className="nxt5-support-external">{t("Le paiement s’effectue sur la plateforme de soutien, dans un nouvel onglet.")}</p>
                </>) : (<div className="nxt5-support-pending">
                  <p>{t("Les contributions ne sont pas encore ouvertes.")}</p>
                  <p>{t("Tu peux déjà faire connaître NXT5 ou partager tes idées pour la suite.")}</p>
                </div>)}
              <p className="nxt5-support-optional">{t("Le soutien est entièrement facultatif. Il ne change pas tes accès à NXT5 et ne débloque pas de fonctionnalité exclusive.")}</p>
            </Surface>
            <div className="nxt5-support-community">
              <MessageCircle aria-hidden="true" size={20} />
              <div><h2>{t("Tes retours comptent aussi.")}</h2><p>{t("Signale un problème, propose une idée ou fais connaître NXT5 à une autre équipe.")}</p><PublicTextLink href="/reseaux" navigate={navigate} className="nxt5-entry-text-link">{t("Rejoindre la communauté")}<ArrowUpRight aria-hidden="true" size={16} /></PublicTextLink></div>
            </div>
          </section>
        </div>
        <p className="nxt5-support-thanks">{t("Merci à celles et ceux qui font vivre NXT5.")}</p>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}
