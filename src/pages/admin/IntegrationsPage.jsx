import React from "react";
import { PageHeader, Surface } from "../../components/ui/Core.jsx";
import { DiscordAdminStatus } from "../../components/discord/DiscordSettings.jsx";
import { LinkButton } from "../public/PublicPages.jsx";
import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import "./integrations.css";

export default function IntegrationsPage({ navigate }) {
  useLanguage();
  return <div className="admin-directory-stack"><PageHeader title={t("Intégrations")} subtitle={t("Vérifie le bot Discord et les liens publics de NXT5.")} /><DiscordAdminStatus /><Surface variant="reading"><h3 className="nxt5-card-title">{t("Réseaux sociaux")}</h3><p className="my-4 text-sm text-slate-300">{t("Consulte les liens publics de NXT5 et les réseaux renseignés sur le site.")}</p><LinkButton href="/reseaux" navigate={navigate} variant="ghost">{t("Voir la page Réseaux")}</LinkButton></Surface></div>;
}
