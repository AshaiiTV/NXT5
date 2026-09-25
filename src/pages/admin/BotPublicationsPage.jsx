import React from "react";
import { PageHeader } from "../../components/ui/Core.jsx";
import CommunityAnnouncementsPanel from "./CommunityAnnouncementsPanel.jsx";

export default function BotPublicationsPage() {
  return <div className="bot-publications space-y-4">
    <PageHeader eyebrow="Bot" title="Publications du bot" subtitle="Choisis les serveurs et les salons, puis prépare ton annonce Discord." />
    <CommunityAnnouncementsPanel />
  </div>;
}
