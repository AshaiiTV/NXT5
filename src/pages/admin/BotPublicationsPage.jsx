import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React from "react";
import { PageHeader } from "../../components/ui/Core.jsx";
import CommunityAnnouncementsPanel from "./CommunityAnnouncementsPanel.jsx";

export default function BotPublicationsPage() {
  useLanguage();
  return <div className="bot-publications space-y-4">
    <PageHeader eyebrow={t("Bot")} title={t("Publications du bot")} subtitle={t("Choisis les serveurs et les salons, puis prépare ton annonce Discord.")} />
    <CommunityAnnouncementsPanel />
  </div>;
}
