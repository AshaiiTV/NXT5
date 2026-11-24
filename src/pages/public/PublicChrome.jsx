// Header, footer and links shared by every public page and the private shell.
// Kept apart from the page modules so each page chunk stays independent.
import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React from "react";
import { Heart } from "lucide-react";
import { openCookieSettings } from "../../app/audience-client.js";
import { cx } from "../../app/helpers.js";
import { isSafeInternalPath } from "../../app/routing.js";
import { SUPPORT_URL } from "../../app/support.js";
import { Nxt5Wordmark } from "../../components/brand/BrandAssets.jsx";
import LanguageSwitcher from "../../i18n/LanguageSwitcher.jsx";

export function LinkButton({ href, children, icon: Icon, variant = "primary", size = "md", className = "", navigate, target, rel, ...props }) {
  useLanguage();
  const base = "nxt5-cyber-button nxt5-control inline-flex min-h-11 min-w-0 max-w-full items-center justify-center gap-2 whitespace-normal px-4 py-2.5 text-center text-sm font-semibold leading-5 transition duration-200";
  const variants = {
    primary: "nxt5-button-primary border",
    secondary: "nxt5-button-outline border",
    ghost: "nxt5-button-ghost border",
    danger: "nxt5-button-danger border",
  };

  function go(event) {
    if (event.defaultPrevented || !navigate || !isSafeInternalPath(href) || target === "_blank" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    navigate(href);
  }

  return <a {...props} href={href} onClick={go} target={target} rel={target === "_blank" ? "noopener noreferrer" : rel} className={cx(base, variants[variant] || variants.primary, size === "sm" && "nxt5-button-sm", className)}>{Icon && <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />}<span className="min-w-0 break-words">{children}</span></a>;
}

export function SiteHeader({ children, navigate, simple = false }) {
  useLanguage();
  function goHome(event) {
    if (event.defaultPrevented || !navigate || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    navigate("/");
  }

  return (
    <header className="nxt5-entry-header">
      <a href="/" onClick={goHome} aria-label={t("Accueil NXT5")} className="shrink-0 transition hover:opacity-90"><Nxt5Wordmark className="nxt5-entry-wordmark" sizes="(max-width: 767px) 120px, 136px" loading="eager" /></a>
      {children && <div className="nxt5-entry-header-actions">{children}</div>}
      <LanguageSwitcher />
    </header>
  );
}

export const INFORMATION_GROUPS = [
  { href: "/mentions-legales", label: "Cadre légal", pages: [["/mentions-legales", "Mentions légales"], ["/conditions", "Conditions d’utilisation"], ["/reglement", "Règlement NXT5"]] },
  { href: "/confidentialite", label: "Données & cookies", pages: [["/confidentialite", "Confidentialité"], ["/cookies", "Cookies et préférences"]] },
  { href: "/reseaux", label: "Réseaux & contact", pages: [["/reseaux", "La communauté"], ["/contact", "Contacter l’équipe"]] },
];

export function PublicTextLink({ href, navigate, children, ...props }) {
  useLanguage();
  function go(event) {
    if (event.defaultPrevented || !navigate || !isSafeInternalPath(href) || props.target === "_blank" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    navigate(href);
  }
  return <a {...props} href={href} onClick={go}>{children}</a>;
}

export function PublicInformationNav({ navigate, activePath }) {
  useLanguage();
  return (
    <nav aria-label={t("Rubriques d’information")} className="nxt5-information-nav">
      {INFORMATION_GROUPS.map((group) => (
        <PublicTextLink key={group.href} href={group.href} navigate={navigate}
          aria-current={group.pages.some(([path]) => path === activePath) ? "location" : undefined}>
          {t(group.label)}
        </PublicTextLink>
      ))}
    </nav>
  );
}

export function LegalLinks({ navigate }) {
  useLanguage();
  return (
    <footer className="nxt5-footer">
      <div className="nxt5-footer-panel">
        <div className="nxt5-footer-main">
          <div className="nxt5-footer-project">
            <PublicTextLink href="/" navigate={navigate} aria-label={t("Accueil NXT5")} className="nxt5-footer-brand">
              <Nxt5Wordmark className="nxt5-footer-wordmark" sizes="144px" />
            </PublicTextLink>
            <p className="nxt5-footer-signature">{t("Cinq rôles. Une même direction.")}</p>
            {SUPPORT_URL && <LinkButton href="/soutenir" navigate={navigate} variant="ghost" icon={Heart} className="nxt5-footer-support">{t("Soutenir NXT5")}</LinkButton>}
          </div>
          <div className="nxt5-footer-navigation">
            <nav aria-label={t("Découvrir NXT5")} className="nxt5-footer-group">
              <h2>{t("Découvrir NXT5")}</h2>
              <ul>
                <li><PublicTextLink href="/fonctionnalites" navigate={navigate}>{t("Fonctionnalités")}</PublicTextLink></li>
                <li><PublicTextLink href="/demo" navigate={navigate}>{t("Démonstration")}</PublicTextLink></li>
              </ul>
            </nav>
            <nav aria-label={t("Guides pratiques")} className="nxt5-footer-group">
              <h2>{t("Guides pratiques")}</h2>
              <ul>
                <li><PublicTextLink href="/guides/importer-premier-scrim" navigate={navigate}>{t("Guide d’import")}</PublicTextLink></li>
                <li><PublicTextLink href="/guides/preparer-debrief" navigate={navigate}>{t("Guide de débrief")}</PublicTextLink></li>
              </ul>
            </nav>
            <nav aria-label={t("Informations et contact")} className="nxt5-footer-group nxt5-footer-information">
              <h2>{t("Informations")}</h2>
              <ul>
                <li><PublicTextLink href="/reseaux" navigate={navigate}>{t("La communauté")}</PublicTextLink></li>
                <li><PublicTextLink href="/contact" navigate={navigate}>{t("Contacter l’équipe")}</PublicTextLink></li>
                <li><PublicTextLink href="/mentions-legales" navigate={navigate}>{t("Cadre légal")}</PublicTextLink></li>
                <li><PublicTextLink href="/confidentialite" navigate={navigate}>{t("Données & cookies")}</PublicTextLink></li>
              </ul>
            </nav>
          </div>
        </div>
        <div className="nxt5-footer-bottom">
          <p className="nxt5-footer-disclaimer">{t("NXT5 n’est pas affilié à Riot Games.")}</p>
          <button type="button" onClick={openCookieSettings} aria-haspopup="dialog" className="nxt5-footer-cookies">{t("Gérer mes cookies")}</button>
        </div>
      </div>
    </footer>
  );
}
