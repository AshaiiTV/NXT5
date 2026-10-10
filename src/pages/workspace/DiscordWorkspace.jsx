import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { Shield, Users } from "lucide-react";
import { openAppPath } from "../../app/routing.js";
import DiscordSettings from "../../components/discord/DiscordSettings.jsx";
import DiscordAccount from "../../components/discord/DiscordAccount.jsx";
import { EmptyState, PageHeader, Surface } from "../../components/ui/Core.jsx";
import { LinkButton } from "../public/PublicPages.jsx";
import { canStaffManage } from "./workspace-shared.jsx";

export default function DiscordWorkspace({ data, selectedTeamId, currentMember, user }) {
  useLanguage();
  const team = selectedTeamId
    ? data.teams.find((candidate) => candidate.id === selectedTeamId)
    : data.teams[0];
  const member = currentMember?.team_id === team?.id && currentMember?.user_id === user?.id ? currentMember : null;
  const role = String(member?.role || "").toLowerCase();
  const canManage = Boolean(user?.id && team?.owner_id === user.id) || ["owner", "captain"].includes(role);
  const canPublish = canManage || canStaffManage(role);

  return <div className="nxt5-data-dense discord-workspace">
    <PageHeader eyebrow={t("Ton équipe, aussi sur Discord")} title={t("Bot Discord")} subtitle={t("Retrouve ton équipe et partage les résultats de tes parties, directement dans Discord.")} />
    <div className="discord-personal-section"><DiscordAccount key={user?.id} user={user} /></div>
    {!team ? <Surface><EmptyState icon={Users} title={t("Choisis une équipe pour commencer")} text={t("Crée ou rejoins une équipe NXT5, puis utilise les commandes dans son salon Discord une fois ton compte lié.")} action={<LinkButton href="/equipes" navigate={openAppPath} className="min-h-11">{t("Ouvrir mes équipes")}</LinkButton>} /></Surface> : !canPublish ? <Surface><EmptyState icon={Shield} title={t("Ton encadrement s’occupe du serveur")} text={t("Le propriétaire ou un capitaine de {0} associe le salon des commandes. Une fois ton compte lié, va dans ce salon Discord pour utiliser /nxt.", [team.name])} /></Surface> : <DiscordSettings key={team.id} teamId={team.id} teamName={team.name} canManage={canManage} canPublish={canPublish} />}
    <p className="discord-workspace-policy">{t("Avant de relier un serveur, consulte les ")}<a href="/confidentialite" className="font-semibold text-cyan-200 underline underline-offset-4">{t("données et permissions du bot")}</a>{t(" et ses ")}<a href="/conditions" className="font-semibold text-cyan-200 underline underline-offset-4">{t("règles d’utilisation")}</a>.</p>
  </div>;
}
