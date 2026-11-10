import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React from "react";
import { ArrowLeft, ArrowUpRight, Heart, MessageCircle, Sparkles, Wrench } from "lucide-react";
import { normalizeSupportUrl, SUPPORT_URL } from "../../app/support.js";
import { AmbientBackground } from "../../components/layout/AppChrome.jsx";
import { Surface } from "../../components/ui/Core.jsx";
import { LegalLinks, LinkButton, PublicTextLink, SiteHeader } from "./PublicPages.jsx";
import { PublicScene } from "./PublicScene.jsx";
import "./support.css";

export function SupportPage({ navigate, user, supportUrl = SUPPORT_URL }) {
  useLanguage();
  const destination = normalizeSupportUrl(supportUrl);

  return (
    <div className="nxt5-entry-page nxt5-support-page">
      <AmbientBackground />
      <SiteHeader navigate={navigate} simple>
        <LinkButton href={user ? "/mon-equipe" : "/connexion"} navigate={navigate} variant="ghost">
          {user ? t("Mon équipe") : t("Se connecter")}
        </LinkButton>
      </SiteHeader>
      <main className="nxt5-entry-main nxt5-support-main">
        <PublicTextLink href="/" navigate={navigate} className="nxt5-entry-text-link nxt5-support-back">
          <ArrowLeft aria-hidden="true" size={16} />{t("Retour à l’accueil")}</PublicTextLink>
        <div className="nxt5-support-layout nxt5-public-intro">
          <div className="nxt5-support-left">
          <section className="nxt5-support-story" aria-labelledby="support-title">
            <p className="nxt5-entry-eyebrow">{t("Un projet indépendant")}</p>
            <h1 id="support-title" className="nxt5-page-title">{t("Soutenir NXT5")}</h1>
            <p>{t(destination ? "Je développe NXT5 pour aider les équipes à préparer leurs parties. Ton soutien finance la suite." : "Je développe NXT5 pour aider les équipes à préparer leurs parties. Ton soutien financera la suite.")}</p>
          </section>
          <div className="nxt5-support-visual">
            <PublicScene className="nxt5-support-sculpture" />
            <ul className="nxt5-support-impact">
              <li><Sparkles aria-hidden="true" size={20} /><div><h2>{t("Faire évoluer l’outil")}</h2><p>{t("Améliorer l’analyse des parties.")}</p></div></li>
              <li><Wrench aria-hidden="true" size={20} /><div><h2>{t("Maintenir NXT5")}</h2><p>{t("Corriger les problèmes et rendre NXT5 plus simple à utiliser au quotidien.")}</p></div></li>
            </ul>
          </div>
          </div>
          <div className="nxt5-support-right">
          <section aria-labelledby="contribute-title" className="nxt5-support-contribute">
            <Surface variant="scene" glow className="nxt5-support-card">
              <Heart aria-hidden="true" className="nxt5-support-heart" size={28} />
              <h2 id="contribute-title">{t("Contribuer au développement")}</h2>
              {destination ? (<>
                  <p>{t("Choisis ton montant : contribution ponctuelle ou mensuelle.")}</p>
                  <LinkButton href={destination} target="_blank" icon={ArrowUpRight} className="nxt5-support-cta">{t("Soutenir le projet")}<span className="sr-only">{t(" (nouvel onglet)")}</span>
                  </LinkButton>
                  <p className="nxt5-support-external">{t("Paiement sur la plateforme de soutien (nouvel onglet).")}</p>
                </>) : (<div className="nxt5-support-pending">
                  <p>{t("Les contributions ne sont pas encore ouvertes.")}</p>
                  <p>{t("Tu pourras choisir le montant et la fréquence.")}</p>
                </div>)}
              <p className="nxt5-support-optional">{t("Le soutien est facultatif. Il ne change pas tes accès et ne débloque aucune fonctionnalité.")}</p>
            </Surface>
          </section>
          <div className="nxt5-support-community">
            <MessageCircle aria-hidden="true" size={20} />
            <div><h2>{t("Tes retours comptent aussi.")}</h2><p>{t("Signale un problème, propose une idée ou fais connaître NXT5 à une autre équipe.")}</p><PublicTextLink href="/reseaux" navigate={navigate} className="nxt5-entry-text-link">{t("Rejoindre la communauté")}<ArrowUpRight aria-hidden="true" size={16} /></PublicTextLink></div>
          </div>
          </div>
        </div>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}
