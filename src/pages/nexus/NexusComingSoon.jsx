import React from "react";
import { ArrowLeft, LogIn, RefreshCw, Trophy } from "lucide-react";
import { Nxt5Wordmark } from "../../components/brand/BrandAssets.jsx";
import { Button } from "../../components/ui/Core.jsx";
import LanguageSwitcher from "../../i18n/LanguageSwitcher.jsx";
import { buildLoginRedirect } from "../../app/routing.js";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";

export default function NexusComingSoon({ user, navigate, verifying = false, error = "", onRetry }) {
  useLanguage();
  return <div className="nexus-page nexus-coming">
    <a className="nexus-skip" href="#nexus-coming-content">{t("Aller au contenu")}</a>
    <div className="nexus-coming-art" aria-hidden="true" />
    <header className="nexus-coming-header">
      <a href="/" aria-label={t("Accueil NXT5")} className="nexus-coming-wordmark"><Nxt5Wordmark loading="eager" className="nexus-coming-logo" /></a>
      <div className="nexus-coming-header-actions"><LanguageSwitcher />{!user && <Button variant="ghost" icon={LogIn} onClick={()=>navigate(buildLoginRedirect("/nexus-rising"))}>{t("Connexion NXT5")}</Button>}</div>
    </header>
    <main id="nexus-coming-content" className="nexus-coming-main" tabIndex={-1}>
      <div className="nexus-coming-copy">
        <p className="nexus-coming-name" translate="no"><Trophy size={24} aria-hidden="true" />Nexus Rising</p>
        <h1 className="nexus-coming-title" lang="en" translate="no"><span>Coming</span><span>Soon</span></h1>
        <p className="nexus-coming-description">{t("La prochaine saison de Nexus Rising se prépare.")}</p>
        <div className="nexus-coming-actions"><Button icon={ArrowLeft} variant="ghost" onClick={()=>navigate(user ? "/accueil" : "/")}>{t("Retour à NXT5")}</Button></div>
        {verifying && <p className="nexus-coming-status" role="status">{t("Vérification de ton accès…")}</p>}
        {error && <div className="nexus-message nexus-error" role="alert"><p>{error}</p><Button icon={RefreshCw} variant="ghost" onClick={onRetry}>{t("Réessayer")}</Button></div>}
      </div>
      <div className="nexus-coming-edition"><span>{t("Saison I")}</span><p>{t("Janvier 2027")}</p><span>{t("Ligue amateur · EUW")}</span></div>
    </main>
    <footer className="nexus-coming-footer"><span>{t("Nexus Rising est une ligue amateur indépendante, non affiliée à Riot Games.")}</span><a href="/confidentialite">{t("Confidentialité")}</a><a href="/contact">{t("Contact")}</a></footer>
  </div>;
}
