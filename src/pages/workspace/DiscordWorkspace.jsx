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
    <PageHeader eyebrow="Intégration" title="Bot Discord" subtitle="Connecte et gère Discord pour ton équipe." />
    {!team ? <Surface><EmptyState icon={Users} title="Choisis une équipe pour commencer" text="Le bot publie les exports de l’équipe sélectionnée. Crée ou rejoins une équipe pour configurer sa connexion Discord." action={<LinkButton href="/equipes" navigate={openAppPath} className="min-h-11">Ouvrir mes équipes</LinkButton>} /></Surface>
      : !canPublish ? <Surface><EmptyState icon={Shield} title="La connexion Discord se configure avec ton staff" text={`Le capitaine ou le propriétaire de ${team.name} peut inviter le bot, associer le serveur et choisir les salons. Le staff peut ensuite suivre les publications.`} /></Surface>
        : <DiscordSettings key={team.id} teamId={team.id} teamName={team.name} canManage={canManage} canPublish={canPublish} />}
    <div className="mt-4"><DiscordAccount key={user?.id} user={user} /></div>
    <p className="discord-workspace-policy">Avant de relier un serveur, consulte les <a href="/confidentialite" className="font-semibold text-cyan-200 underline underline-offset-4">données et permissions du bot</a> et ses <a href="/conditions" className="font-semibold text-cyan-200 underline underline-offset-4">règles d’utilisation</a>.</p>
  </div>;
}
