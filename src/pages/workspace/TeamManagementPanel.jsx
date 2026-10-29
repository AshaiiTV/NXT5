import { useEffect, useRef, useState } from "react";
import { Check, Image as ImageIcon, Loader2, Pencil, Plus, Shield, Trash2, Trophy, Upload, UserMinus, UserPlus, Users, X } from "lucide-react";
import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { Badge, Button, SelectInput, Surface, TabNav, TextInput } from "../../components/ui/Core.jsx";
import { RoleIcon } from "../../components/brand/BrandAssets.jsx";
import { rosterPlayersByStatus, ROSTER_STATUS_OPTIONS } from "../../utils/roster.js";
import { COMP_ROLES, STAFF_ROLES, TEAM_ACCESS_ROLES, formatCountdown, isGameplayRole, isStaffRole } from "./workspace-shared.jsx";
import { roleLabel } from "./shell-shared.jsx";
import { LinkButton } from "../public/PublicPages.jsx";
import { openAppPath } from "../../app/routing.js";
import "./team-management.css";

const PROFILE_ROLES = [...COMP_ROLES, "SUB", ...STAFF_ROLES];
const TABS = [
  { id: "roster", label: "Effectif", icon: Users },
  { id: "access", label: "Invitations et accès", icon: UserPlus },
  { id: "settings", label: "Équipe", icon: Shield },
];

export function TeamManagementPanel({ team, edit, setEdit, onAvatarFile, onSaveTeam, onCopyInvite, onRevokeInvites, canManageRoster, canEditIdentity, canInvite, canManageMembers, canDeleteTeam, members, roster, inviteCodes = [], saving, onRoleChange, onLink, onRemoveMember, onDeletePlayer, onDeleteTeam, playerForm, setPlayerForm, onCreatePlayer, editingPlayer, playerEditForm, setPlayerEditForm, onUpdatePlayer, onClosePlayerEdit, onEditPlayer, routeSearch = "", children }) {
  useLanguage();
  const [activeTab, setActiveTab] = useState("roster");
  const rosterRequested = new URLSearchParams(routeSearch).get("section") === "roster";
  const [adding, setAdding] = useState(rosterRequested || roster.length === 0);
  const [nowTick, setNowTick] = useState(Date.now());
  const profileSectionRef = useRef(null);
  const profileEditRef = useRef(null);
  const editTriggerRef = useRef(null);
  const editButtons = useRef(new Map());
  const editedProfileId = useRef("");
  const rosterHeadingRef = useRef(null);
  const addTriggerRef = useRef(null);
  const restoreAddFocus = useRef(false);
  const pendingAddFocus = useRef(rosterRequested);
  const editingPlayerId = editingPlayer?.id || "";

  useEffect(() => {
    if (!rosterRequested || !canManageRoster) return;
    pendingAddFocus.current = true;
    setActiveTab("roster");
    setAdding(true);
  }, [rosterRequested, routeSearch, team.id, canManageRoster]);
  useEffect(() => {
    if (!pendingAddFocus.current || !adding || activeTab !== "roster" || !canManageRoster) return;
    pendingAddFocus.current = false;
    profileSectionRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    profileSectionRef.current?.querySelector("input:not(:disabled)")?.focus({ preventScroll: true });
  }, [adding, activeTab, rosterRequested, routeSearch, canManageRoster]);
  useEffect(() => {
    if (!editingPlayerId || !canManageRoster) return;
    profileEditRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    profileEditRef.current?.querySelector("input:not(:disabled)")?.focus({ preventScroll: true });
  }, [editingPlayerId, canManageRoster]);
  useEffect(() => {
    if (adding || !restoreAddFocus.current) return;
    restoreAddFocus.current = false;
    addTriggerRef.current?.focus();
  }, [adding]);
  useEffect(() => {
    if (editingPlayerId || saving) return;
    if (editedProfileId.current && activeTab === "roster") {
      const trigger = editButtons.current.get(editedProfileId.current) || editTriggerRef.current;
      if (trigger?.isConnected) trigger.focus();
      else rosterHeadingRef.current?.focus();
    }
    editedProfileId.current = "";
    editTriggerRef.current = null;
  }, [editingPlayerId, saving, activeTab]);
  useEffect(() => {
    if (activeTab !== "access" || !inviteCodes.length) return;
    setNowTick(Date.now());
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeTab, inviteCodes]);

  const linkedPlayerByUser = new Map(roster.filter((player) => player.user_id).map((player) => [player.user_id, player]));
  const gameplayCount = new Set(roster.filter((player) => player.id && isGameplayRole(player.role)).map((player) => String(player.id))).size;
  const activeCodes = inviteCodes.filter((code) => new Date(code.expires_at).getTime() > nowTick);
  const mainPlayers = rosterPlayersByStatus(roster, "MAIN");
  const subPlayers = rosterPlayersByStatus(roster, "SUB");
  const activePlayers = new Set([...mainPlayers, ...subPlayers]);
  const groups = [
    { id: "main", label: t("Titulaires"), players: mainPlayers },
    { id: "sub", label: t("Remplaçants"), players: subPlayers },
    { id: "staff", label: t("Encadrement"), players: roster.filter((player) => isStaffRole(player.role)) },
    { id: "inactive", label: t("Hors effectif actif"), players: roster.filter((player) => !isStaffRole(player.role) && !activePlayers.has(player)) },
  ];
  const openAdd = (event) => {
    addTriggerRef.current = event.currentTarget;
    pendingAddFocus.current = true;
    setAdding(true);
  };
  const closeAdd = () => {
    restoreAddFocus.current = true;
    setAdding(false);
  };

  return <div className="team-manager">
    <TabNav items={TABS} activeId={activeTab} onChange={setActiveTab} label={t("Gestion de l’équipe")} idPrefix="team-manager" className="team-manager-tabs" />

    <section id="team-manager-panel-roster" role="tabpanel" aria-labelledby="team-manager-tab-roster" hidden={activeTab !== "roster"} className="team-manager-panel" tabIndex={0}>
      <Surface variant="glass" className="team-manager-surface">
        <div className="team-manager-toolbar">
          <div><h3 ref={rosterHeadingRef} tabIndex={-1}>{t("Joueurs et staff")}</h3></div>
          {canManageRoster && <Button type="button" icon={Plus} onClick={openAdd} hidden={adding} disabled={saving} aria-expanded={adding} aria-controls="team-roster-setup">{t("Ajouter un profil")}</Button>}
        </div>
        <section ref={profileSectionRef} id="team-roster-setup" aria-labelledby="team-roster-setup-title" hidden={!adding || !canManageRoster} className="team-manager-add-form">
          <div className="team-manager-toolbar"><h4 id="team-roster-setup-title">{t("Ajouter un joueur ou un membre du staff")}</h4>{roster.length > 0 && <Button type="button" variant="ghost" icon={X} disabled={saving} onClick={closeAdd}>{t("Fermer l’ajout")}</Button>}</div>
          <p className="team-manager-description">{t("Crée son profil ici. Tu pourras ensuite l’associer à son compte NXT5.")}</p>
          {canManageRoster ? <form onSubmit={onCreatePlayer} className="team-profile-form" aria-labelledby="team-roster-setup-title">
        <TextInput label={t("Nom")} value={playerForm.name} onChange={(name) => setPlayerForm({ ...playerForm, name })} placeholder={t("Nom du joueur ou staff")} required />
        <TextInput label={t("Riot ID")} value={playerForm.riotId} onChange={(riotId) => setPlayerForm({ ...playerForm, riotId })} placeholder={isStaffRole(playerForm.role) ? t("Optionnel pour staff") : "Pseudo#TAG"} required={!isStaffRole(playerForm.role)} disabled={isStaffRole(playerForm.role)} />
        <TextInput label={t("OP.GG (facultatif)")} value={playerForm.opggUrl} onChange={(opggUrl) => setPlayerForm({ ...playerForm, opggUrl })} placeholder={isStaffRole(playerForm.role) ? t("Non utilisé pour staff") : "https://op.gg/..."} disabled={isStaffRole(playerForm.role)} />
        <SelectInput label={t("Poste ou fonction")} value={playerForm.role} onChange={(role) => setPlayerForm({ ...playerForm, role, riotId: isStaffRole(role) ? "" : playerForm.riotId, opggUrl: isStaffRole(role) ? "" : playerForm.opggUrl, rosterStatus: isStaffRole(role) ? "INACTIVE" : role === "SUB" ? "SUB" : playerForm.rosterStatus === "INACTIVE" ? "AUTO" : playerForm.rosterStatus })}>{PROFILE_ROLES.map((role) => <option key={role} value={role}>{t(roleLabel(role))}</option>)}</SelectInput>
        <SelectInput label={t("Effectif")} value={playerForm.rosterStatus} onChange={(rosterStatus) => setPlayerForm({ ...playerForm, rosterStatus })} disabled={isStaffRole(playerForm.role) || playerForm.role === "SUB"}><option value="AUTO">{t("Automatique")}</option>{ROSTER_STATUS_OPTIONS.map((item) => <option key={item.id} value={item.id}>{t(item.label)}</option>)}</SelectInput>
        <div className="flex items-end"><Button type="submit" disabled={saving || !canManageRoster} icon={saving ? Loader2 : UserPlus} className="w-full">{isStaffRole(playerForm.role) ? t("Ajouter au staff") : t("Ajouter le joueur")}</Button></div>
      </form> : <p className="mt-4 text-sm leading-6 text-slate-300">{t("Seul le staff peut ajouter des profils. Demande à ton capitaine, coach ou manager d’ajouter les joueurs.")}</p>}

        </section>
        {!canManageRoster && <p className="team-manager-help">{t("Seul le staff peut ajouter des profils. Demande à ton capitaine, coach ou manager d’ajouter les joueurs.")}</p>}
        {groups.filter((group) => group.players.length).map((group) => <section key={group.id} aria-label={group.label}>
          <h4 className="team-manager-group-title">{group.label}<span>{group.players.length}</span></h4>
          <ul className="team-manager-list">{[...group.players].sort((a, b) => PROFILE_ROLES.indexOf(a.role) - PROFILE_ROLES.indexOf(b.role)).map((player) => <li key={player.id}>
            <div className="team-manager-row">
              <div className="team-manager-role"><span aria-hidden="true"><RoleIcon role={player.role} /></span><span>{t(roleLabel(player.role))}</span></div>
              <div className="team-manager-person"><strong>{player.name}</strong><span>{player.riot_id || (isStaffRole(player.role) ? t("Staff") : t("Riot ID manquant"))}</span></div>
              <Button ref={(node) => { if (node) editButtons.current.set(player.id, node); else editButtons.current.delete(player.id); }} type="button" variant="ghost" icon={Pencil} aria-label={t("Modifier {0}", [player.name])} aria-expanded={editingPlayerId === player.id} aria-controls={editingPlayerId === player.id ? `team-edit-${player.id}` : undefined} onClick={(event) => { if (editingPlayerId) return; editedProfileId.current = player.id; editTriggerRef.current = event.currentTarget; onEditPlayer(player); }} disabled={saving || !canManageRoster || Boolean(editingPlayerId)}><span>{t("Modifier")}</span></Button>
            </div>
            {canManageRoster && editingPlayerId === player.id && <div id={`team-edit-${player.id}`}><form ref={profileEditRef} onSubmit={onUpdatePlayer} className="team-profile-edit" style={{ scrollMarginTop: "6rem" }}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><Badge tone="brand">{t("Modification")}</Badge><h4 className="mt-3 text-xl font-black text-white">{t("Modifier ")}{editingPlayer.name}</h4><p className="mt-1 text-sm font-semibold text-cyan-100/80">{t("Corrige le nom, le Riot ID ou l’OP.GG du profil.")}</p></div><Button type="button" variant="ghost" icon={X} disabled={saving} onClick={onClosePlayerEdit}>{t("Fermer")}</Button></div>
        <div className="team-profile-edit-fields"><TextInput label={t("Nom")} value={playerEditForm.name} onChange={(name) => setPlayerEditForm({ ...playerEditForm, name })} placeholder={t("Nom visible")} required /><TextInput label={t("Riot ID")} value={playerEditForm.riotId} onChange={(riotId) => setPlayerEditForm({ ...playerEditForm, riotId })} placeholder={isStaffRole(editingPlayer.role) ? t("Non utilisé pour staff") : "Pseudo#TAG"} required={!isStaffRole(editingPlayer.role)} disabled={isStaffRole(editingPlayer.role)} /><TextInput label="OP.GG" value={playerEditForm.opggUrl} onChange={(opggUrl) => setPlayerEditForm({ ...playerEditForm, opggUrl })} placeholder={isStaffRole(editingPlayer.role) ? t("Non utilisé pour staff") : "https://op.gg/..."} disabled={isStaffRole(editingPlayer.role)} /><SelectInput label={t("Effectif")} value={playerEditForm.rosterStatus} onChange={(rosterStatus) => setPlayerEditForm({ ...playerEditForm, rosterStatus })} disabled={isStaffRole(editingPlayer.role) || editingPlayer.role === "SUB"}>{ROSTER_STATUS_OPTIONS.map((item) => <option key={item.id} value={item.id}>{t(item.label)}</option>)}</SelectInput></div>
        <div className="team-manager-link-field">
          <SelectInput label={t("Compte NXT5 associé")} value={player.user_id || ""} onChange={(userId) => onLink(player.id, userId)} disabled={saving || !canManageRoster}>
            <option value="">{t("Aucun compte associé")}</option>
            {members.map((member) => {
              const linked = linkedPlayerByUser.get(member.user_id);
              const blocked = Boolean(linked && linked.id !== player.id);
              return <option key={member.user_id} value={member.user_id} disabled={blocked}>{member.name || member.account_name || t("Compte NXT5")}{blocked ? t(" · Déjà lié") : ""}</option>;
            })}
          </SelectInput>
          <p className="team-manager-description">{t("Associe le compte de connexion à ce profil. Ce choix est enregistré immédiatement.")}</p>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" disabled={saving} onClick={onClosePlayerEdit}>{t("Annuler")}</Button><Button type="submit" icon={saving ? Loader2 : Check} disabled={saving || !canManageRoster}>{t("Enregistrer")}</Button></div>
        <details className="team-manager-danger">
          <summary>{t("Retirer ce profil")}</summary>
          <p>{t("Le profil sera supprimé de l’effectif. Pour le conserver, choisis « Hors effectif actif ».")}</p>
          <Button type="button" variant="danger" icon={Trash2} disabled={saving || !canManageRoster} onClick={() => onDeletePlayer(player.id, player.name)}>{t("Supprimer le profil")}</Button>
        </details>
      </form></div>}
          </li>)}</ul>
        </section>)}
        {canManageRoster && adding && <div className="team-import-next" aria-label={t("Après les joueurs")}>
          <div><h5>{t("Ensuite, ajoute une partie")}</h5><p>{gameplayCount >= 5 ? t("Les profils joueurs sont prêts. Tu pourras vérifier qui a joué avant d’enregistrer la partie.") : t("Profils joueurs : {0}/5 minimum. Les membres du staff ne comptent pas parmi ces cinq joueurs.", [gameplayCount])}</p></div>
          {gameplayCount >= 5 && <LinkButton href="/games?import=1" navigate={openAppPath} variant="ghost" icon={Upload}>{t("Importer une partie")}</LinkButton>}
        </div>}
      </Surface>
    </section>

    <section id="team-manager-panel-access" role="tabpanel" aria-labelledby="team-manager-tab-access" hidden={activeTab !== "access"} className="team-manager-panel" tabIndex={0}>
      <Surface variant="glass" className="team-manager-surface">
        <div className="team-manager-invite">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-black text-white">{t("Inviter dans l’équipe")}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-300">{t("Un lien valable 1h, à transmettre au joueur ou au staff. Créer un nouveau lien révoque les précédents.")}</p>
          </div>
          <Button type="button" icon={saving ? Loader2 : UserPlus} onClick={onCopyInvite} disabled={saving || !canInvite}>{t("Créer et copier un lien")}</Button>
        </div>
        <div className="team-invitation-list">
          {activeCodes.length ? activeCodes.map((code) => {
            const remaining = Math.max(0, Math.ceil((new Date(code.expires_at).getTime() - nowTick) / 1000));
            return <div key={code.id} className="team-invitation-code">
              <div className="flex items-center justify-between gap-3"><p className="min-w-0 break-all font-mono text-sm font-bold text-white">{code.code}</p><Badge tone={remaining > 900 ? "green" : remaining > 300 ? "yellow" : "red"}>{formatCountdown(remaining)}</Badge></div>
              <p className="mt-1 break-words text-xs text-slate-300">{t("Créé par ")}{code.created_by_name || "staff"}</p>
            </div>;
          }) : <p className="team-empty-row">{t("Aucune invitation active.")}</p>}
          {activeCodes.length > 0 && canInvite && <Button type="button" variant="danger" onClick={onRevokeInvites} disabled={saving}>{t("Révoquer les invitations")}</Button>}
        </div>
      </div>
        <div className="team-manager-toolbar team-manager-accounts-heading"><div><h3>{t("Comptes de l’équipe")}</h3><p className="team-manager-description">{t("Ces comptes peuvent se connecter à l’espace d’équipe. Les droits sont enregistrés dès leur modification.")}</p></div><Badge tone="brand">{members.length}</Badge></div>
        {!canInvite && <p className="team-manager-help">{t("Seuls le propriétaire, le capitaine et le manager peuvent créer une invitation.")}</p>}
        {!canManageMembers && <p className="team-manager-help">{t("Seuls le propriétaire et le capitaine peuvent modifier les droits d’accès.")}</p>}
        <ul className="team-manager-accounts">{members.map((member) => {
          const linked = linkedPlayerByUser.get(member.user_id);
          const memberName = member.name || member.account_name || t("Compte invité");
          const isOwner = member.user_id === team.owner_id || String(member.role || "").toLowerCase() === "owner";
          const access = String(member.role || "").toLowerCase();
          return <li key={member.user_id} className="team-manager-account">
            <div className="team-manager-person"><strong>{memberName}</strong><span>{linked ? t("Profil associé : {0}", [linked.name]) : t("Aucun profil associé")}</span></div>
            <div className="team-manager-account-role">{isOwner ? <Badge tone="brand">{t("Propriétaire")}</Badge> : <SelectInput label={t("Droit d’accès")} aria-label={t("Accès de {0}", [memberName])} value={TEAM_ACCESS_ROLES.some(([id]) => id === access) ? access : "player"} onChange={(value) => onRoleChange(member.user_id, value)} disabled={saving || !canManageMembers}>{TEAM_ACCESS_ROLES.map(([id, label]) => <option key={id} value={id}>{t(label)}</option>)}</SelectInput>}</div>
            {!isOwner && canManageMembers && <details className="team-manager-account-actions"><summary>{t("Retirer l’accès")}</summary><p>{t("Ce compte ne pourra plus accéder à l’équipe. Son profil joueur sera conservé.")}</p><Button type="button" variant="danger" icon={UserMinus} disabled={saving} onClick={() => onRemoveMember(member.user_id, memberName)}>{t("Retirer l’accès de {0}", [memberName])}</Button></details>}
          </li>;
        })}</ul>
        {members.length === 0 && <p className="team-empty-row">{t("Aucun compte dans cette équipe. Partage une invitation pour commencer.")}</p>}
        <p className="team-manager-help">{t("Pour associer un compte à un joueur, ouvre « Modifier » sur son profil dans Effectif.")}</p>
      </Surface>
    </section>

    <section id="team-manager-panel-settings" role="tabpanel" aria-labelledby="team-manager-tab-settings" hidden={activeTab !== "settings"} className="team-manager-panel" tabIndex={0}>
      <Surface variant="glass" className="team-manager-surface">
        <div className="team-manager-toolbar"><div><h3>{t("Identité de l’équipe")}</h3><p className="team-manager-description">{t("Le nom, le tag et l’image affichés dans votre espace.")}</p></div></div>
        <div className="team-manager-settings"><form onSubmit={onSaveTeam} className="team-identity-form">
        <div className="team-identity-fields">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-cyan-300/25 bg-black/30">
            {edit.avatarDataUrl ? <img src={edit.avatarDataUrl} alt={team.name} className="h-full w-full object-cover" loading="lazy" decoding="async" style={{ transform: "scale(" + Number(edit.avatarZoom || 1) + ")", objectPosition: Number(edit.avatarX ?? 50) + "% " + Number(edit.avatarY ?? 50) + "%" }} /> : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-9 w-9 text-slate-400" /></div>}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <TextInput disabled={!canEditIdentity || saving} label={t("Nom de l'équipe")} value={edit.name} onChange={(name) => setEdit({ ...edit, name })} placeholder={t("Nom")} required icon={Trophy} />
            <TextInput disabled={!canEditIdentity || saving} label={t("Tag")} value={edit.tag} onChange={(tag) => setEdit({ ...edit, tag })} placeholder="TAG" required icon={Shield} />
          </div>
        </div>
        <details className="team-image-options">
          <summary className="team-disclosure-label">{t("Image de l’équipe")}</summary>
          <label className="team-image-upload"><Upload className="h-4 w-4" />{t(" Choisir une image")}<input type="file" accept="image/*" className="sr-only" onChange={(event) => onAvatarFile(event.target.files?.[0])} disabled={!canEditIdentity || saving} /></label>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <label className="block"><span className="nxt5-field-label">{t("Zoom")}</span><input type="range" min="1" max="2.5" step="0.05" value={edit.avatarZoom} onChange={(event) => setEdit({ ...edit, avatarZoom: event.target.value })} disabled={!canEditIdentity || saving} className="w-full" /></label>
            <label className="block"><span className="nxt5-field-label">{t("Horizontal")}</span><input type="range" min="0" max="100" value={edit.avatarX} onChange={(event) => setEdit({ ...edit, avatarX: event.target.value })} disabled={!canEditIdentity || saving} className="w-full" /></label>
            <label className="block"><span className="nxt5-field-label">{t("Vertical")}</span><input type="range" min="0" max="100" value={edit.avatarY} onChange={(event) => setEdit({ ...edit, avatarY: event.target.value })} disabled={!canEditIdentity || saving} className="w-full" /></label>
          </div>
        </details>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit" icon={saving ? Loader2 : Check} disabled={saving || !canEditIdentity}>{t("Enregistrer l’équipe")}</Button>
        </div>
        {!canEditIdentity && <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3 text-sm font-semibold text-amber-100">{t("Seuls le propriétaire, le capitaine et le manager peuvent modifier l’identité de l’équipe.")}</p>}
      </form></div>
        {canDeleteTeam && <details className="team-manager-danger"><summary>{t("Supprimer l’équipe")}</summary><p>{t("Cette suppression est définitive : profils, parties, débriefs et invitations seront supprimés.")}</p><Button type="button" variant="danger" icon={Trash2} disabled={saving} onClick={onDeleteTeam}>{t("Supprimer définitivement l’équipe")}</Button></details>}
      </Surface>
      {activeTab === "settings" && children}
    </section>
  </div>;
}
