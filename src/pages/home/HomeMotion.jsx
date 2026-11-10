import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React from "react";
import { Nxt5Wordmark } from "../../components/brand/BrandAssets.jsx";
import PrismeScene from "../../components/brand/PrismeScene.jsx";
import ProductStory from "./ProductStory.jsx";
import { LegalLinks, PublicTextLink } from "../public/PublicPages.jsx";
import LanguageSwitcher from "../../i18n/LanguageSwitcher.jsx";
import "./home-motion.css";
export default function HomeMotion({ navigate }) {
  useLanguage();
  return <div className="hm-page hm-reduced">
    <a className="hm-skip" href="#outils">{t("Passer l’introduction")}</a>
    <header className="hm-header">
      <a href="#accueil" className="hm-header-brand" aria-label={t("NXT5 — retour à l’accueil")}><Nxt5Wordmark loading="eager" /></a>
      <nav aria-label={t("Navigation principale")}>
        <a href="#outils" className="hm-nav-features">{t("Fonctionnalités")}</a>
        <PublicTextLink href="/connexion" navigate={navigate}>{t("Connexion")}</PublicTextLink>
        <PublicTextLink href="/demo" navigate={navigate} className="hm-demo-link">{t("Essayer la démo")}</PublicTextLink>
        <LanguageSwitcher />
      </nav>
    </header>
    <main>
      <section id="accueil" className="hm-prisme-hero" aria-labelledby="home-title">
        <div className="hm-prisme-copy">
          <h1 id="home-title">{t("Comprends tes parties.")}<br />{t("Prépare la suite.")}</h1>
          <p>{t("Pour les équipes League of Legends.")}</p>
          <div className="hm-intro-actions">
            <PublicTextLink className="hm-primary" href="/creer-un-compte" navigate={navigate}>{t("Créer mon espace")}</PublicTextLink>
            <PublicTextLink className="hm-secondary" href="/demo" navigate={navigate}>{t("Essayer la démo")}</PublicTextLink>
          </div>
        </div>
        <PrismeScene className="hm-prisme-signature" signature />
      </section>
      <ProductStory reduced motionEnabled={false} navigate={navigate} />
    </main>
    <LegalLinks navigate={navigate} />
  </div>;
}
