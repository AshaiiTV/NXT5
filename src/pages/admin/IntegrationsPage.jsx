import React from "react";
import { PageHeader, Surface } from "../../components/ui/Core.jsx";
import { DiscordAdminStatus } from "../../components/discord/DiscordSettings.jsx";
import { LinkButton } from "../public/PublicPages.jsx";
import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import "./integrations.css";

export default function IntegrationsPage({ navigate }) {
  useLanguage();
  return <div className="admin-directory-stack"><PageHeader title={t("Intégrations")} subtitle={t("Bot Discord et liens publics.")} /><DiscordAdminStatus /><Surface variant="reading"><h3 className="nxt5-card-title">{t("Réseaux sociaux")}</h3><p className="my-4 text-sm text-slate-300">{t("Liens et réseaux publics de NXT5.")}</p><LinkButton href="/reseaux" navigate={navigate} variant="ghost">{t("Voir la page Réseaux")}</LinkButton></Surface></div>;
}
