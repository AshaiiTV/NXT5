import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React from "react";
import { ArrowRight } from "lucide-react";
import { AmbientBackground } from "../../components/layout/AppChrome.jsx";
import { LegalLinks, LinkButton, PublicTextLink, SiteHeader } from "./PublicPages.jsx";
import { DemoExplorer } from "./DemoExperience.jsx";
import "./features-page.css";

export function DemoPage({ navigate, user }) {
  useLanguage();
  return <div className="nxt5-entry-page nxt5-demo-page"><AmbientBackground />
    <SiteHeader navigate={navigate}><PublicTextLink href="/fonctionnalites" navigate={navigate} className="nxt5-entry-header-link">{t("Fonctionnalités")}</PublicTextLink><LinkButton href={user ? "/equipes" : "/connexion"} navigate={navigate} variant="ghost">{user ? t("Mon équipe") : t("Se connecter")}</LinkButton></SiteHeader>
    <main className="nxt5-entry-main"><nav aria-label={t("Fil d’Ariane")} className="nxt5-features-breadcrumb"><PublicTextLink href="/" navigate={navigate}>{t("Accueil")}</PublicTextLink><span aria-hidden="true">/</span><span aria-current="page">{t("Démonstration")}</span></nav>
      <header className="nxt5-features-intro"><p className="nxt5-entry-eyebrow">{t("Sans compte · Sans installation")}</p><h1>{t("Essaie la lecture d’une séance d’équipe.")}</h1><p>{t("Explore trois parties, compare les résultats et ouvre un exemple de débrief. Toutes les données sont fictives. Cette démonstration reste en lecture seule et n’utilise aucune donnée d’équipe réelle.")}</p></header>
      <DemoExplorer />
      <section className="nxt5-entry-start"><div><h2>{t("Prêt pour les parties de ton équipe ?")}</h2><p>{t("Accès actuellement gratuit, aucun abonnement activé. L’import de tes parties nécessite NXT5 Importer sur Windows ou Mac et le client League of Legends ouvert.")}</p><PublicTextLink href="/guides/importer-premier-scrim" navigate={navigate} className="nxt5-entry-text-link">{t("Voir les étapes du premier import ")}<ArrowRight aria-hidden="true" size={16} /></PublicTextLink></div><LinkButton href={user ? "/equipes" : "/creer-un-compte"} navigate={navigate} icon={ArrowRight}>{user ? t("Ouvrir mon équipe") : t("Créer mon espace")}</LinkButton></section>
    </main><LegalLinks navigate={navigate} />
  </div>;
}
