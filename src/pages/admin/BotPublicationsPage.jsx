import React from "react";
import { PageHeader } from "../../components/ui/Core.jsx";
import CommunityAnnouncementsPanel from "./CommunityAnnouncementsPanel.jsx";

export default function BotPublicationsPage() {
  return <div className="bot-publications space-y-4">
    <PageHeader eyebrow="Bot" title="Publications du bot" subtitle="Rédige et publie les annonces NXT5 sur le serveur communautaire Discord." />
    <CommunityAnnouncementsPanel />
  </div>;
}
