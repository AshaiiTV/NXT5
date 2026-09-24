import { Shield, Users } from "lucide-react";
import { openAppPath } from "../../app/routing.js";
import DiscordSettings from "../../components/discord/DiscordSettings.jsx";
import DiscordAccount from "../../components/discord/DiscordAccount.jsx";
import { EmptyState, PageHeader, Surface } from "../../components/ui/Core.jsx";
import { LinkButton } from "../public/PublicPages.jsx";
import { canStaffManage } from "./workspace-shared.jsx";

export default function DiscordWorkspace({ data, selectedTeamId, currentMember, user }) {
  const team = selectedTeamId
    ? data.teams.find((candidate) => candidate.id === selectedTeamId)
    : data.teams[0];
  const member = currentMember?.team_id === team?.id && currentMember?.user_id === user?.id ? currentMember : null;
  const role = String(member?.role || "").toLowerCase();
  const canManage = Boolean(user?.id && team?.owner_id === user.id) || ["owner", "captain"].includes(role);
  const canPublish = canManage || canStaffManage(role);

  return <div className="nxt5-data-dense discord-workspace">
    <PageHeader eyebrow="Ton équipe, aussi sur Discord" title="Bot Discord" subtitle="Retrouve ton équipe et partage les résultats de tes parties, directement dans Discord." />
    <div className="discord-personal-section"><DiscordAccount key={user?.id} user={user} /></div>
    {!team ? <Surface><EmptyState icon={Users} title="Choisis une équipe pour commencer" text="Crée ou rejoins une équipe NXT5, puis utilise les commandes dans son salon Discord une fois ton compte lié." action={<LinkButton href="/equipes" navigate={openAppPath} className="min-h-11">Ouvrir mes équipes</LinkButton>} /></Surface>
      : !canPublish ? <Surface><EmptyState icon={Shield} title="Ton staff s’occupe du serveur" text={`Le propriétaire ou un capitaine de ${team.name} associe le salon des commandes. Une fois ton compte lié, va dans ce salon Discord pour utiliser /nxt.`} /></Surface>
        : <DiscordSettings key={team.id} teamId={team.id} teamName={team.name} canManage={canManage} canPublish={canPublish} />}
    <p className="discord-workspace-policy">Avant de relier un serveur, consulte les <a href="/confidentialite" className="font-semibold text-cyan-200 underline underline-offset-4">données et permissions du bot</a> et ses <a href="/conditions" className="font-semibold text-cyan-200 underline underline-offset-4">règles d’utilisation</a>.</p>
  </div>;
}
