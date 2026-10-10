import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Clipboard, Loader2, Plus, Shield, Trophy, UserPlus, Users, X, Check, Image as ImageIcon, Pencil, Trash2, UserMinus, Upload } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { RIOT_SYNC_CLIENT_TIMEOUT_MS } from "../../../shared/riot-sync-policy.js";
import { openAppPath } from "../../app/routing.js";
import { Badge, Button, EmptyState, PageHeader, ReadingDetails, SelectInput, Surface, TextAreaInput, TextInput } from "../../components/ui/Core.jsx";
import { cx, profileStatusLabel, profileStatusTone } from "../../app/helpers.js";
import { multiOpggUrlFromRoster, playerRosterStatus, rosterPlayersByStatus, rosterStatusMeta, ROSTER_STATUS_OPTIONS } from "../../utils/roster.js";
import { RoleIcon } from "../../components/brand/BrandAssets.jsx";
import { ROSTER_ROLE_ORDER, canStaffManage, isGameplayRole, isStaffRole, formatCountdown, championDisplayName, lazyNamed, loadNextPhase, TEAM_ACCESS_ROLES, COMP_ROLES, STAFF_ROLES, ChampionPortrait, playerIntegratedRows } from "./workspace-shared.jsx";
import { roleLabel } from "./shell-shared.jsx";
import "./Teams.css";
import { LinkButton } from "../public/PublicPages.jsx";

const TeamDataHealthPanel = lazyNamed(loadNextPhase, "TeamDataHealthPanel");

const PROFILE_ROLES = [...COMP_ROLES, "SUB", ...STAFF_ROLES];

function emptyPlayerForm(roster = []) {
  const occupiedRoles = new Set(rosterPlayersByStatus(roster, "MAIN").map((player) => String(player.role || "").toUpperCase()));
  const role = COMP_ROLES.find((candidate) => !occupiedRoles.has(candidate)) || "TOP";
  return { name: "", riotId: "", opggUrl: "", role, rosterStatus: "AUTO" };
}

function rosterRoleIndex(role) {
  const normalized = String(role || "").toUpperCase();
  const index = [...COMP_ROLES, "SUB"].indexOf(normalized);
  return index === -1 ? 99 : index;
}

function RoleTag({ role, staff = false, className = "" }) {
  useLanguage();
  const label = roleLabel(role);
  return (
    <Badge tone={staff ? "purple" : "blue"} className={cx("overflow-hidden justify-center px-2 sm:justify-start sm:px-2.5", className)} title={t(label)}>
      <span className="block max-w-full truncate">{t(label)}</span>
    </Badge>
  );
}

function decodeLoose(value) {
  let output = String(value || "").replace(/\+/g, " ");
  for (let i = 0; i < 2; i += 1) {
    try {
      const decoded = decodeURIComponent(output);
      if (decoded === output) break;
      output = decoded;
    } catch {
      break;
    }
  }
  return output;
}

function parseMultiOpgg(input) {
  const text = decodeLoose(input);
  const players = [];
  const seen = new Set();

  function addRiotId(name, tag) {
    const cleanName = String(name || "").trim().replace(/\s+/g, " ");
    const cleanTag = String(tag || "").trim().toUpperCase();
    if (!cleanName || !cleanTag) return;
    const riotId = `${cleanName}#${cleanTag}`;
    const key = riotId.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    players.push({ name: cleanName, riotId });
  }

  const riotIdPattern = /([\p{L}\p{N} _.'-]{2,32})\s*#\s*([A-Za-z0-9]{2,8})/gu;
  for (const match of text.matchAll(riotIdPattern)) addRiotId(match[1], match[2]);

  const urlPattern = /https?:\/\/\S+/g;
  for (const urlText of text.match(urlPattern) || []) {
    try {
      const url = new URL(urlText);
      const summoners = [
        ...url.searchParams.getAll("summoners"),
        ...url.searchParams.getAll("summoner"),
        ...url.searchParams.getAll("summonerName"),
      ].join(",");
      for (const entry of decodeLoose(summoners).split(/[,;\n|]+/)) {
        for (const match of entry.matchAll(riotIdPattern)) addRiotId(match[1], match[2]);
      }
    } catch {}
  }

  const opggPathPattern = /(?:summoners\/|^)(?:[a-z]{2,5}\/)?([^/?#&,;|\n]+)-([A-Za-z0-9]{2,8})/gi;
  for (const match of text.matchAll(opggPathPattern)) {
    addRiotId(decodeLoose(match[1]).replace(/-/g, " "), match[2]);
  }

  return players;
}

function opggUrlFromRiotId(riotId, region) {
  const [name, tag] = String(riotId).split("#");
  if (!name || !tag) return "";
  const slug = encodeURIComponent(`${name}-${tag}`);
  return `https://www.op.gg/lol/summoners/${String(region || "EUW").toLowerCase()}/${slug}`;
}

function Teams({ data, refreshAll, selectedTeamId, setSelectedTeamId, currentMember, routeSearch = "", pushToast, user, managementOnly = false, setupOnly = false, teamCreation = {} }) {
  useLanguage();
  const [teamForm, setTeamForm] = useState({ name: "", tag: "", region: "EUW", multiOpgg: "" });
  const pendingCreation = teamCreation.pending;
  const [playerForm, setPlayerForm] = useState(() => emptyPlayerForm());
  const [joinCode, setJoinCode] = useState("");
  const [setupIntent, setSetupIntent] = useState("choose");
  const [joinError, setJoinError] = useState("");
  const intentFocus = useRef(false);
  const [localSaving, setSaving] = useState(false);
  const saving = localSaving || teamCreation.busy;
  const [syncingPlayerId, setSyncingPlayerId] = useState("");
  const [teamSetupOpen, setTeamSetupOpen] = useState(false);
  const [dismissedCreationId, setDismissedCreationId] = useState(null);
  const pageRef = useRef(null);
  const setupRef = useRef(null);
  const focusSetup = useRef(false);
  const [riotCooldownUntil, setRiotCooldownUntil] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());
  const [teamEdit, setTeamEdit] = useState({ name: "", tag: "", avatarDataUrl: "", avatarZoom: 1, avatarX: 50, avatarY: 50 });
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [playerEditForm, setPlayerEditForm] = useState({ name: "", riotId: "", opggUrl: "", rosterStatus: "MAIN" });
  const selectedTeam = data.teams.find((team) => team.id === selectedTeamId) || data.teams[0];
  const roster = selectedTeam ?data.players.filter((player) => player.team_id === selectedTeam.id) : [];
  const gameplayRoster = roster.filter((player) => isGameplayRole(player.role));
  const mainTeamRoster = rosterPlayersByStatus(gameplayRoster, "MAIN");
  const substituteRoster = rosterPlayersByStatus(gameplayRoster, "SUB");
  const activeRoster = [...mainTeamRoster, ...substituteRoster];
  const teamMembers = selectedTeam ?(data.teamMembers || []).filter((member) => member.team_id === selectedTeam.id) : [];
  const inviteCodes = selectedTeam ?(data.inviteCodes || []).filter((code) => code.team_id === selectedTeam.id) : [];
  const multiPlayers = useMemo(() => parseMultiOpgg(teamForm.multiOpgg), [teamForm.multiOpgg]);
  const hasTeams = data.teams.length > 0;
  const showSetup = !hasTeams || teamSetupOpen || setupOnly || (pendingCreation && dismissedCreationId !== pendingCreation.team.id);
  const owner = Boolean(user?.id && selectedTeam?.owner_id === user.id);
  const accessRole = String(currentMember?.role || "").toLowerCase();
  const canManageRoster = owner || canStaffManage(accessRole);
  const canEditIdentity = owner || ["owner", "captain", "manager"].includes(accessRole);
  const canInvite = canEditIdentity;
  const canManageMembers = owner || ["owner", "captain"].includes(accessRole);
  const canDeleteTeam = owner;
  const riotCooldownSeconds = Math.max(0, Math.ceil((riotCooldownUntil - nowTick) / 1000));

  useEffect(() => {
    if (!selectedTeamId && data.teams[0]?.id) setSelectedTeamId(data.teams[0].id);
  }, [data.teams, selectedTeamId, setSelectedTeamId]);

  useEffect(() => {
    const params = new URLSearchParams(routeSearch || window.location.search);
    setTeamSetupOpen(["create", "setup", "join"].some(key => params.get(key) === "1") || params.has("invite"));
    setSetupIntent(params.has("invite") || params.get("join") === "1" ? "join" : params.get("create") === "1" ? "create" : "choose");
    setJoinError("");
    if (params.has("invite")) setJoinCode(params.get("invite") || "");
  }, [routeSearch]);

  useEffect(() => {
    if (!intentFocus.current) return;
    intentFocus.current = false;
    const target = setupIntent === "choose" ? pageRef.current?.querySelector(".team-entry-choice") : setupRef.current?.querySelector("input");
    target?.focus({ preventScroll: true });
  }, [setupIntent]);

  function chooseSetup(intent) {
    if (saving) return;
    intentFocus.current = true;
    setJoinError("");
    setSetupIntent(intent);
  }

  useEffect(() => {
    if (!riotCooldownUntil) return undefined;
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [riotCooldownUntil]);

  useEffect(() => {
    if (!selectedTeam) return;
    setPlayerForm(emptyPlayerForm(roster));
    setTeamEdit({
      name: selectedTeam.name || "",
      tag: selectedTeam.tag || "",
      avatarDataUrl: selectedTeam.avatar_data_url || "",
      avatarZoom: Number(selectedTeam.avatar_zoom || 1),
      avatarX: Number(selectedTeam.avatar_x ?? 50),
      avatarY: Number(selectedTeam.avatar_y ?? 50),
    });
  }, [selectedTeam?.id]);

  const previousCompletion = useRef(teamCreation.completed);
  useEffect(() => {
    if (teamCreation.completed !== previousCompletion.current) {
      previousCompletion.current = teamCreation.completed;
      setTeamForm({ name: "", tag: "", region: "EUW", multiOpgg: "" });
      setTeamSetupOpen(false);
    }
  }, [teamCreation.completed]);

  useEffect(() => {
    if (showSetup && focusSetup.current) {
      focusSetup.current = false;
      setupRef.current?.querySelector('button[type="submit"]')?.focus();
    }
  }, [showSetup]);

  function closeSetup() {
    setTeamSetupOpen(false);
    setDismissedCreationId(pendingCreation?.team.id || null);
    openAppPath("/equipes");
    // Return focus to the page heading (a named, focusable landmark) rather than an unnamed container.
    const heading = pageRef.current?.querySelector(".nxt5-page-title");
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }

  function abandonCreation() {
    if (saving || !teamCreation.abandon()) return;
    setTeamForm({ name: "", tag: "", region: "EUW", multiOpgg: "" });
    closeSetup();
  }

  function createTeam(event) {
    event.preventDefault();
    if (saving) return;
    return teamCreation.create(teamForm, multiPlayers.map((player, index) => ({
      ...player, opggUrl: opggUrlFromRiotId(player.riotId, teamForm.region), role: ROSTER_ROLE_ORDER[index] || "SUB",
    })));
  }

  async function joinTeam(event) {
    event.preventDefault();
    if (saving) return;
    setJoinError("");
    setSaving(true);
    try {
      const result = await apiFetch("teams-join", { method: "POST", body: JSON.stringify({ invite: joinCode }) });
      setSelectedTeamId(result.team.id);
      setJoinCode("");
      setTeamSetupOpen(false);
      await refreshAll({ teamId: result.team.id });
      openAppPath("/accueil");
      pushToast({ type: "green", title: "Team rejointe", text: "Tu as maintenant accès à cette structure." });
    } catch (err) {
      setJoinError(err.message || "Impossible de rejoindre l’équipe. Vérifie ton code et réessaie.");
      pushToast({ type: "red", title: "Invitation invalide", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function createPlayer(event) {
    event.preventDefault();
    if (!selectedTeam || !canManageRoster || saving) return;
    setSaving(true);
    try {
      await apiFetch("players-create", { method: "POST", body: JSON.stringify({ ...playerForm, rosterStatus: playerForm.rosterStatus === "AUTO" ? "" : playerForm.rosterStatus, teamId: selectedTeam.id }) });
      setPlayerForm(emptyPlayerForm([...roster, playerForm]));
      await refreshAll();
      pushToast({ type: "green", title: isStaffRole(playerForm.role) ? "Staff ajouté" : "Joueur ajouté", text: "Effectif mis à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Ajout impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function copyInviteLink() {
    if (!canInvite || saving) return;
    if (!selectedTeam) return;
    setSaving(true);
    try {
      const result = await apiFetch("teams-invite-code", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id }) });
      await navigator.clipboard.writeText(`${window.location.origin}/equipes?invite=${encodeURIComponent(result.code)}`);
      await refreshAll();
      pushToast({ type: "green", title: "Lien d’invitation copié", text: "Valable 1h maximum. Les anciens liens ont été révoqués." });
    } catch (err) {
      pushToast({ type: "red", title: "Code impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function revokeInvites() {
    if (!canInvite || saving) return;
    if (!selectedTeam) return;
    setSaving(true);
    try {
      await apiFetch("teams-invite-code", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, action: "revoke" }) });
      await refreshAll();
      pushToast({ type: "green", title: "Invitations révoquées", text: "Les anciens liens ne permettent plus de rejoindre l’équipe." });
    } catch (err) { pushToast({ type: "red", title: "Révocation impossible", text: err.message }); }
    finally { setSaving(false); }
  }

  async function copyMultiOpggLink(players, label) {
    if (!selectedTeam || !players.length) return;
    const link = multiOpggUrlFromRoster(players, selectedTeam.region);
    if (!link) {
      pushToast({ type: "red", title: "Multi OP.GG impossible", text: "Ajoute des Riot IDs au format Pseudo#TAG." });
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      const linkedCount = new URL(link).searchParams.get("summoners").split(",").length;
      pushToast({ type: "green", title: `Multi OP.GG ${label} copié`, text: `${linkedCount} joueur${linkedCount > 1 ?"s" : ""} dans le lien.` });
    } catch {
      pushToast({ type: "red", title: "Copie impossible", text: "Le navigateur n’a pas autorisé la copie. Réessaie depuis le bouton." });
    }
  }

  async function copyPlayerOpggLink(player) {
    const link = String(player?.opgg_url || "").trim() || opggUrlFromRiotId(player?.riot_id, selectedTeam?.region);
    if (!link) {
      pushToast({ type: "red", title: "OP.GG introuvable", text: "Ajoute un Riot ID ou un lien OP.GG sur ce profil." });
      return;
    }
    await navigator.clipboard.writeText(link);
    pushToast({ type: "green", title: "OP.GG copié", text: `${player?.name || "Profil"} est dans le presse-papiers.` });
  }

  function openPlayerEdit(player) {
    setEditingPlayer(player);
    setPlayerEditForm({
      name: player?.name || "",
      riotId: player?.riot_id || "",
      opggUrl: player?.opgg_url || "",
      rosterStatus: playerRosterStatus(player),
    });
  }

  function closePlayerEdit() {
    setEditingPlayer(null);
    setPlayerEditForm({ name: "", riotId: "", opggUrl: "", rosterStatus: "MAIN" });
  }

  async function updatePlayer(event) {
    event.preventDefault();
    if (!selectedTeam || !editingPlayer) return;
    setSaving(true);
    try {
      await apiFetch("players-update", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, playerId: editingPlayer.id, ...playerEditForm }) });
      closePlayerEdit();
      await refreshAll();
      pushToast({ type: "green", title: "Profil modifié", text: "Identité, OP.GG et effectif sont à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Modification impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function updatePlayerRosterStatus(player, rosterStatus) {
    if (!selectedTeam || !player || playerRosterStatus(player) === rosterStatus) return;
    setSaving(true);
    try {
      await apiFetch("players-update", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, playerId: player.id, name: player.name, riotId: player.riot_id || "", opggUrl: player.opgg_url || "", rosterStatus }) });
      await refreshAll();
      pushToast({ type: "green", title: "Effectif mis à jour", text: `${player.name} passe dans ${rosterStatusMeta(rosterStatus).label}.` });
    } catch (err) {
      pushToast({ type: "red", title: "Modification impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function linkPlayerAccount(playerId, userId) {
    if (!selectedTeam) return;
    setSaving(true);
    try {
      await apiFetch("players-link-account", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, playerId, userId: userId || null }) });
      await refreshAll();
      pushToast({ type: "green", title: userId ?"Compte lié" : "Compte délié", text: "La gestion de la team est à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Liaison impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function updateMemberRole(userId, role) {
    if (!canManageMembers || saving) return;
    if (!selectedTeam) return;
    setSaving(true);
    try {
      await apiFetch("team-member-role", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, userId, role }) });
      await refreshAll();
      pushToast({ type: "green", title: "Statut mis à jour", text: "Le profil reflète son rôle dans la team." });
    } catch (err) {
      pushToast({ type: "red", title: "Modification impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  function loadTeamAvatar(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      pushToast({ type: "red", title: "Avatar invalide", text: "Choisis une image depuis ton PC." });
      return;
    }
    if (file.size > 900000) {
      pushToast({ type: "yellow", title: "Image trop lourde", text: "Prends une image sous 900 Ko pour garder l’avatar léger." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setTeamEdit((current) => ({ ...current, avatarDataUrl: String(reader.result || "") }));
    reader.readAsDataURL(file);
  }

  async function updateTeam(event) {
    event.preventDefault();
    if (!canEditIdentity || saving) return;
    if (!selectedTeam) return;
    setSaving(true);
    try {
      await apiFetch("teams-update", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, ...teamEdit }) });
      await refreshAll();
      pushToast({ type: "green", title: "Team mise à jour", text: "Nom et avatar sont synchronisés." });
    } catch (err) {
      pushToast({ type: "red", title: "Modification impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(userId, label) {
    if (!canManageMembers || saving) return;
    if (!selectedTeam) return;
    if (!window.confirm(t("Renvoyer {0} de la team ?", [label || t("ce profil")]))) return;
    setSaving(true);
    try {
      await apiFetch("team-member-remove", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, userId }) });
      await refreshAll();
      pushToast({ type: "green", title: "Profil renvoyé", text: "Le compte n'a plus accès à cette team." });
    } catch (err) {
      pushToast({ type: "red", title: "Renvoi impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function deletePlayer(playerId, label) {
    if (!selectedTeam) return;
    if (!window.confirm(t("Supprimer le profil \"{0}\" du roster ?", [label || t("sélectionné")]))) return;
    setSaving(true);
    try {
      await apiFetch("players-delete", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, playerId }) });
      if (editingPlayer?.id === playerId) closePlayerEdit();
      await refreshAll();
      pushToast({ type: "green", title: "Profil supprimé", text: "Le roster de gestion est à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function syncPlayerMostPlayed(player) {
    if (!selectedTeam || !player) return;
    if (riotCooldownSeconds > 0) {
      pushToast({ type: "yellow", title: "Riot refroidit", text: `Réessaie dans ${formatCountdown(riotCooldownSeconds)}.` });
      return;
    }
    setSyncingPlayerId(player.id);
    try {
      const result = await apiFetch("players-sync-most-played", { method: "POST", timeoutMs: RIOT_SYNC_CLIENT_TIMEOUT_MS, body: JSON.stringify({ teamId: selectedTeam.id, playerId: player.id }) });
      await refreshAll();
      const firstFailed = result.results?.find((item) => !item.ok);
      if (firstFailed?.retryAfter && firstFailed.code !== "RIOT_SYNC_FRESH") {
        const retryAfter = Number(firstFailed.retryAfter || 120);
        setRiotCooldownUntil(Date.now() + Math.max(30, retryAfter) * 1000);
      }
      if (firstFailed) {
        pushToast({ type: "yellow", title: "Analyse incomplète", text: `${player.name} n'a pas été analysé : ${firstFailed.error}` });
      } else {
        pushToast({ type: "green", title: "Profil analysé", text: `${player.name} est à jour.` });
      }
    } catch (err) {
      if (err.code === "RIOT_RATE_LIMIT" || err.status === 429) {
        const retryAfter = Number(err.retryAfter || 120);
        setRiotCooldownUntil(Date.now() + Math.max(30, retryAfter) * 1000);
      }
      pushToast({ type: "red", title: "Analyse impossible", text: err.message });
    } finally {
      setSyncingPlayerId("");
    }
  }

  async function deleteTeam() {
    if (!canDeleteTeam || saving) return;
    if (!selectedTeam) return;
    const confirmed = window.confirm(t("Supprimer définitivement la team \"{0}\" ? Cette action supprime aussi roster, matchs, reviews et invitations liés.", [selectedTeam.name]));
    if (!confirmed) return;

    setSaving(true);
    try {
      await apiFetch("teams-delete", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id }) });
      setSelectedTeamId(null);
      await refreshAll();
      pushToast({ type: "green", title: "Team supprimée", text: "La structure et ses données liées ont été supprimées." });
    } catch (err) {
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  if (managementOnly) return <div className="nxt5-data-dense nxt5-teams-page nxt5-team-management-page">
    <PageHeader eyebrow={t("Gestion")} title={t("Gestion de l’équipe")} subtitle={t("Ajoute tes joueurs, puis organise les invitations et les accès de l’équipe.")}>
      <LinkButton href="/equipes" navigate={openAppPath} variant="ghost" icon={ArrowLeft}>{t("Retour à l’équipe")}</LinkButton>
    </PageHeader>
    {selectedTeam ? <div className="space-y-5">
      <TeamManagementPanel team={selectedTeam} edit={teamEdit} setEdit={setTeamEdit} onAvatarFile={loadTeamAvatar} onSaveTeam={updateTeam} onCopyInvite={copyInviteLink} onRevokeInvites={revokeInvites} canManageRoster={canManageRoster} canEditIdentity={canEditIdentity} canInvite={canInvite} canManageMembers={canManageMembers} canDeleteTeam={canDeleteTeam} members={teamMembers} roster={roster} inviteCodes={inviteCodes} saving={saving} onRoleChange={updateMemberRole} onRosterStatusChange={updatePlayerRosterStatus} onLink={linkPlayerAccount} onRemoveMember={removeMember} onDeletePlayer={deletePlayer} onDeleteTeam={deleteTeam} playerForm={playerForm} setPlayerForm={setPlayerForm} onCreatePlayer={createPlayer} editingPlayer={editingPlayer} playerEditForm={playerEditForm} setPlayerEditForm={setPlayerEditForm} onUpdatePlayer={updatePlayer} onClosePlayerEdit={closePlayerEdit} onEditPlayer={openPlayerEdit} routeSearch={routeSearch} />
      <Surface className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><h3 className="text-lg font-black text-white">{t("Bot Discord")}</h3><p className="mt-1 text-sm leading-6 text-slate-300">{t("Invitation, connexion du serveur, salons et historique des publications de ton équipe.")}</p></div>
          <LinkButton href="/bot-discord" navigate={openAppPath} variant="ghost" icon={ArrowRight} className="min-h-11 shrink-0">{t("Configurer le bot Discord")}</LinkButton>
        </div>
      </Surface>
      <TeamDataHealthPanel team={selectedTeam} players={data.players || []} matches={data.matches || []} />
    </div> : <Surface glow><EmptyState icon={Users} title={t("Aucune équipe")} text={t("Crée ou rejoins une équipe avant d’ouvrir la gestion.")} /></Surface>}
  </div>;

  return <div ref={pageRef} className="nxt5-teams-page" data-entry={showSetup ? "true" : undefined}><PageHeader eyebrow={showSetup ? t("Bienvenue dans NXT5") : t("Équipe")} title={showSetup ? pendingCreation ? t("Ton équipe est créée. On continue.") : setupIntent === "create" ? t("Créons ton espace d’équipe.") : setupIntent === "join" ? t("Retrouve ton équipe.") : t("Comment veux-tu commencer ?") : selectedTeam.name} subtitle={showSetup ? setupIntent === "choose" && !pendingCreation ? t("Choisis ta situation. On te guide pour la suite.") : undefined : [selectedTeam.tag, selectedTeam.region, t(activeRoster.length === 1 ? "{0} joueur actif" : "{0} joueurs actifs", [activeRoster.length])].filter(Boolean).join(" · ")}>{hasTeams && <>
      {!showSetup && <Button type="button" icon={Clipboard} disabled={!activeRoster.length} title={activeRoster.length ? t("Copier le lien des titulaires et des remplaçants") : t("Ajoute un titulaire ou un remplaçant pour copier le multi OP.GG")} onClick={() => copyMultiOpggLink(activeRoster, "de l’équipe")}>{t("Copier le multi OP.GG")}</Button>}
      {canManageRoster && !showSetup && <LinkButton href="/gestion-equipe" navigate={openAppPath} variant="ghost" icon={Shield}>{t("Gestion de l’équipe")}</LinkButton>}
      {showSetup && <Button type="button" variant="ghost" icon={X} disabled={saving} onClick={closeSetup}>{t("Fermer les formulaires")}</Button>}
      {pendingCreation && !showSetup && <Button type="button" variant="ghost" onClick={() => { focusSetup.current = true; setTeamSetupOpen(true); }}>{t("Reprendre l’import de joueurs")}</Button>}
    </>}</PageHeader>
    {showSetup && setupIntent === "choose" && !pendingCreation && <div className="team-entry-choices">
      <button type="button" className="team-entry-choice" onClick={() => chooseSetup("create")}>
        <Shield size={28} aria-hidden="true" /><span className="team-entry-audience">{t("Je suis responsable de l’équipe")}</span><strong>{t("Créer mon équipe")}</strong><span>{t("Un espace commun pour vos parties, vos débriefs et vos entraînements.")}</span><span className="team-entry-action">{t("Créer mon espace ")}<ArrowRight size={18} aria-hidden="true" /></span>
      </button>
      <button type="button" className="team-entry-choice" onClick={() => chooseSetup("join")}>
        <Users size={28} aria-hidden="true" /><span className="team-entry-audience">{t("Mon équipe est déjà sur NXT5")}</span><strong>{t("Rejoindre mon équipe")}</strong><span>{t("Utilise l’invitation de ton responsable pour retrouver ton équipe.")}</span><span className="team-entry-action">{t("J’ai une invitation ")}<ArrowRight size={18} aria-hidden="true" /></span>
      </button>
    </div>}
    <div className="teams-workspace-layout">
      {showSetup && (setupIntent !== "choose" || pendingCreation) && <div ref={setupRef} className="team-setup-forms">
        {!pendingCreation && <button type="button" className="team-entry-back" disabled={saving} onClick={() => chooseSetup("choose")}><ArrowLeft size={16} aria-hidden="true" />{t("Changer de choix")}</button>}
        {(setupIntent === "create" || pendingCreation) && <Surface>
          <h3 className="text-xl font-black text-white">{t("Créer une équipe")}</h3>
          <p className="mt-1 text-sm text-slate-300">{t("Pour organiser les joueurs et retrouver les parties de ton équipe.")}</p>
          <form onSubmit={createTeam} className="mt-5 space-y-4">
            {!pendingCreation && <>
            <TextInput label={t("Nom de l’équipe")} value={teamForm.name} onChange={(name) => setTeamForm({ ...teamForm, name })} placeholder={t("Ex. Les Renards")} required disabled={saving} icon={Trophy} />
            <div className="team-entry-fields"><TextInput label={t("Tag")} value={teamForm.tag} onChange={(tag) => setTeamForm({ ...teamForm, tag })} placeholder={t("Ex. REN")} required disabled={saving} icon={Shield} />
            <SelectInput label={t("Région")} value={teamForm.region} onChange={(region) => setTeamForm({ ...teamForm, region })} disabled={saving}><option>EUW</option><option>{t("EUNE")}</option><option>{t("NA")}</option><option>{t("KR")}</option><option>{t("BR")}</option><option>{t("LAN")}</option><option>{t("LAS")}</option><option>{t("JP")}</option><option>{t("OCE")}</option><option>{t("TR")}</option></SelectInput></div>
            <details className="team-entry-optional"><summary>{t("Ajouter aussi mes joueurs ")}<span>{t("Facultatif")}</span></summary><p>{t("Tu pourras aussi créer les profils pendant l’import de ta première partie.")}</p>
            <TextAreaInput label={t("Joueurs à ajouter (facultatif)")} value={teamForm.multiOpgg} onChange={(multiOpgg) => setTeamForm({ ...teamForm, multiOpgg })} disabled={saving} placeholder={t("Colle un lien multi OP.GG ou une liste :\nToplaner#EUW\nJungler#EUW\nMidlaner#EUW\nADC#EUW\nSupport#EUW")} icon={Clipboard} />
            {multiPlayers.length > 0 && <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">{multiPlayers.length}{t(multiPlayers.length > 1 ? " joueurs" : " joueur")}{t(multiPlayers.length > 1 ? " détectés" : " détecté")}</p><div className="mt-2 flex flex-wrap gap-2">{multiPlayers.map((player, index) => <Badge key={player.riotId} tone={index < 5 ?"cyan" : "slate"}>{ROSTER_ROLE_ORDER[index] || "SUB"} · {player.riotId}</Badge>)}</div></div>}
            </details></>}
            {pendingCreation && <p role="status" className="break-words text-sm text-slate-300">{t("L’équipe ")}{pendingCreation.team.name}{t(" est créée. Joueurs restant à ajouter : ")}{pendingCreation.players.slice(pendingCreation.next).map(player => player.riotId).join(", ")}.</p>}
            {teamCreation.error && <p role="alert" className="team-entry-error">{teamCreation.error}</p>}
            <Button type="submit" disabled={saving} icon={saving ? Loader2 : Plus} className="w-full">{saving ? t("Création en cours…") : pendingCreation ? t("Reprendre les joueurs manquants") : t("Créer l’équipe")}</Button>
            {pendingCreation && <>
              <p className="text-sm text-slate-300">{t("L’abandon conserve l’équipe et les joueurs déjà ajoutés.")}</p>
              <Button type="button" variant="ghost" disabled={saving} onClick={abandonCreation} className="w-full">{t("Abandonner l’import restant")}</Button>
            </>}
          </form>
        </Surface>}

        {setupIntent === "join" && !pendingCreation && <Surface>
          <h3 className="text-xl font-black text-white">{t("Rejoindre une équipe")}</h3>
          <p className="mt-1 text-sm text-slate-300">{t("Colle le code transmis par ton responsable. Si tu as ouvert son lien d’invitation, il est déjà renseigné.")}</p>
          <form onSubmit={joinTeam} className="mt-5 space-y-4">
            <TextInput label={t("Code d’invitation")} value={joinCode} onChange={setJoinCode} placeholder="NXT5-ABC123" disabled={saving} required icon={UserPlus} autoComplete="off" />
            {joinError && <p role="alert" className="team-entry-error">{joinError}</p>}
            <Button type="submit" disabled={saving || !joinCode.trim()} icon={saving ?Loader2 : ArrowRight} className="w-full">{saving ? t("Connexion à l’équipe…") : t("Rejoindre l’équipe")}</Button>
          </form>
          <details className="team-entry-optional"><summary>{t("Je n’ai pas de code, ou il a expiré")}</summary><p>{t("Demande une invitation au coach, manager ou capitaine. Le code est valable une heure ; une nouvelle invitation remplace la précédente.")}</p></details>
        </Surface>}

      </div>}

      {selectedTeam && !showSetup && <div>
        <Surface className="team-roster-surface">
          <PremiumRosterTable key={selectedTeam.id} roster={roster} matches={data.matches || []} currentUserId={user?.id} canManage={canManageRoster} />
          {activeRoster.length > 0 && <details className="team-roster-options">
            <summary>{t("Liens OP.GG par groupe")}</summary>
            <div className="team-roster-copy-actions">
              {mainTeamRoster.length > 0 && <Button type="button" variant="ghost" icon={Clipboard} onClick={() => copyMultiOpggLink(mainTeamRoster, "des titulaires")}>{t("Copier OP.GG titulaires · ")}{mainTeamRoster.length}</Button>}
              {substituteRoster.length > 0 && <Button type="button" variant="ghost" icon={Clipboard} onClick={() => copyMultiOpggLink(substituteRoster, "des remplaçants")}>{t("Copier OP.GG remplaçants · ")}{substituteRoster.length}</Button>}
            </div>
          </details>}
        </Surface>
      </div>}
    </div>
    {showSetup && <p className="team-entry-help">{t("Un doute ? ")}<a href="/guide?section=getting-started">{t("Consulter les premiers pas")}</a></p>}
  </div>;
}

function TeamManagementPanel({ team, edit, setEdit, onAvatarFile, onSaveTeam, onCopyInvite, onRevokeInvites, canManageRoster, canEditIdentity, canInvite, canManageMembers, canDeleteTeam, members, roster, inviteCodes = [], saving, onRoleChange, onRosterStatusChange, onLink, onRemoveMember, onDeletePlayer, onDeleteTeam, playerForm, setPlayerForm, onCreatePlayer, editingPlayer, playerEditForm, setPlayerEditForm, onUpdatePlayer, onClosePlayerEdit, onEditPlayer, routeSearch = "" }) {
  useLanguage();
  const [nowTick, setNowTick] = useState(Date.now());
  const profileSectionRef = useRef(null);
  const profileEditRef = useRef(null);
  const editTriggerRef = useRef(null);
  const editingPlayerId = editingPlayer?.id || "";
  const rosterRequested = new URLSearchParams(routeSearch).get("section") === "roster";
  useEffect(() => {
    if (!rosterRequested || !canManageRoster) return;
    const section = profileSectionRef.current;
    section?.scrollIntoView({ behavior: "auto", block: "start" });
    section?.querySelector("input:not(:disabled)")?.focus({ preventScroll: true });
  }, [rosterRequested, routeSearch, team.id, canManageRoster]);
  useEffect(() => {
    if (!editingPlayerId || !canManageRoster) return;
    profileEditRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    profileEditRef.current?.querySelector("input:not(:disabled)")?.focus({ preventScroll: true });
  }, [editingPlayerId, canManageRoster]);
  useEffect(() => {
    if (editingPlayerId || saving) return;
    if (editTriggerRef.current?.isConnected) editTriggerRef.current.focus();
    editTriggerRef.current = null;
  }, [editingPlayerId, saving]);
  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const linkedPlayerByUser = new Map(roster.filter((player) => player.user_id).map((player) => [player.user_id, player]));
  const memberByUser = new Map(members.map((member) => [member.user_id, member]));
  const unlinkedMemberRows = members.filter((member) => !linkedPlayerByUser.has(member.user_id));
  const linkedCount = roster.filter((player) => player.user_id).length;
  const gameplayCount = new Set(roster.filter((player) => player.id && isGameplayRole(player.role)).map((player) => String(player.id))).size;
  const staffCount = roster.filter((player) => isStaffRole(player.role)).length;
  const activeCodes = inviteCodes.filter((code) => new Date(code.expires_at).getTime() > nowTick);
  const roleValue = (role) => TEAM_ACCESS_ROLES.some(([id]) => id === String(role || "").toLowerCase()) ? String(role || "").toLowerCase() : "player";
  const linkedProfileLabel = (member) => {
    const linked = linkedPlayerByUser.get(member.user_id);
    const accountName = member.name || member.account_name || "Compte NXT5";
    return linked ? accountName + " · " + (linked.riot_id || roleLabel(linked.role)) : accountName + " · Non-lié";
  };
  const isLinkedElsewhere = (member, player) => {
    const linked = linkedPlayerByUser.get(member.user_id);
    return Boolean(linked && linked.id !== player.id);
  };
  return <Surface className="team-management-panel">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h3 className="team-management-name">{team.name}</h3>
      </div>
      <dl className="team-management-summary">
        <div><dt>{t("Profils liés")}</dt><dd>{linkedCount}<span> / {roster.length}</span></dd></div>
        <div><dt>{t("Joueurs")}</dt><dd>{gameplayCount}</dd></div>
        <div><dt>{t("Staff")}</dt><dd>{staffCount}</dd></div>
      </dl>
    </div>

    <section ref={profileSectionRef} id="team-roster-setup" aria-labelledby="team-roster-setup-title" className="team-management-section team-roster-setup">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div><h4 id="team-roster-setup-title" className="text-xl font-black text-white">{t("Ajouter un joueur ou un membre du staff")}</h4><p className="mt-1 text-sm text-slate-300">{t("Le profil représente une personne dans l’équipe. Son compte NXT5, utilisé pour se connecter, pourra être associé plus tard.")}</p></div>
        <Badge tone="purple">{t("Effectif")}</Badge>
      </div>
      {canManageRoster ? <form onSubmit={onCreatePlayer} className="team-profile-form" aria-labelledby="team-roster-setup-title">
        <TextInput label={t("Nom")} value={playerForm.name} onChange={(name) => setPlayerForm({ ...playerForm, name })} placeholder={t("Nom du joueur ou staff")} required />
        <TextInput label={t("Riot ID")} value={playerForm.riotId} onChange={(riotId) => setPlayerForm({ ...playerForm, riotId })} placeholder={isStaffRole(playerForm.role) ? t("Optionnel pour staff") : "Pseudo#TAG"} required={!isStaffRole(playerForm.role)} disabled={isStaffRole(playerForm.role)} />
        <TextInput label={t("OP.GG (facultatif)")} value={playerForm.opggUrl} onChange={(opggUrl) => setPlayerForm({ ...playerForm, opggUrl })} placeholder={isStaffRole(playerForm.role) ? t("Non utilisé pour staff") : "https://op.gg/..."} disabled={isStaffRole(playerForm.role)} />
        <SelectInput label={t("Poste ou fonction")} value={playerForm.role} onChange={(role) => setPlayerForm({ ...playerForm, role, riotId: isStaffRole(role) ? "" : playerForm.riotId, opggUrl: isStaffRole(role) ? "" : playerForm.opggUrl, rosterStatus: isStaffRole(role) ? "INACTIVE" : role === "SUB" ? "SUB" : playerForm.rosterStatus === "INACTIVE" ? "AUTO" : playerForm.rosterStatus })}>{PROFILE_ROLES.map((role) => <option key={role} value={role}>{t(roleLabel(role))}</option>)}</SelectInput>
        <SelectInput label={t("Effectif")} value={playerForm.rosterStatus} onChange={(rosterStatus) => setPlayerForm({ ...playerForm, rosterStatus })} disabled={isStaffRole(playerForm.role) || playerForm.role === "SUB"}><option value="AUTO">{t("Automatique")}</option>{ROSTER_STATUS_OPTIONS.map((item) => <option key={item.id} value={item.id}>{t(item.label)}</option>)}</SelectInput>
        <div className="flex items-end"><Button type="submit" disabled={saving || !canManageRoster} icon={saving ? Loader2 : UserPlus} className="w-full">{isStaffRole(playerForm.role) ? t("Ajouter au staff") : t("Ajouter le joueur")}</Button></div>
      </form> : <p className="mt-4 text-sm leading-6 text-slate-300">{t("Seul le staff peut ajouter des profils. Demande à ton capitaine, coach ou manager d’ajouter les joueurs.")}</p>}
      {canManageRoster && <div className="team-import-next" aria-label={t("Après les joueurs")}>
        <div><h5>{t("Ensuite, ajoute une partie")}</h5><p>{gameplayCount >= 5 ? t("Les profils joueurs sont prêts. Tu pourras vérifier qui a joué avant d’enregistrer la partie.") : t("{0} profil{1} joueur{2} sur 5 nécessaires. Les membres du staff ne comptent pas parmi ces cinq joueurs.", [gameplayCount, gameplayCount > 1 ? "s" : "", gameplayCount > 1 ? "s" : ""])}</p></div>
        {gameplayCount >= 5 && <LinkButton href="/games?import=1" navigate={openAppPath} variant="ghost" icon={Upload}>{t("Importer une partie")}</LinkButton>}
      </div>}
      {canManageRoster && editingPlayer && <form ref={profileEditRef} onSubmit={onUpdatePlayer} className="team-profile-edit" style={{ scrollMarginTop: "6rem" }}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><Badge tone="orange">{t("Modification")}</Badge><h4 className="mt-3 text-xl font-black text-white">{t("Modifier ")}{editingPlayer.name}</h4><p className="mt-1 text-sm font-semibold text-cyan-100/80">{t("Corrige le nom, le Riot ID ou l’OP.GG du profil.")}</p></div><Button type="button" variant="ghost" icon={X} onClick={onClosePlayerEdit}>{t("Fermer")}</Button></div>
        <div className="team-profile-edit-fields"><TextInput label={t("Nom")} value={playerEditForm.name} onChange={(name) => setPlayerEditForm({ ...playerEditForm, name })} placeholder={t("Nom visible")} required /><TextInput label={t("Riot ID")} value={playerEditForm.riotId} onChange={(riotId) => setPlayerEditForm({ ...playerEditForm, riotId })} placeholder={isStaffRole(editingPlayer.role) ? t("Non utilisé pour staff") : "Pseudo#TAG"} required={!isStaffRole(editingPlayer.role)} disabled={isStaffRole(editingPlayer.role)} /><TextInput label="OP.GG" value={playerEditForm.opggUrl} onChange={(opggUrl) => setPlayerEditForm({ ...playerEditForm, opggUrl })} placeholder={isStaffRole(editingPlayer.role) ? t("Non utilisé pour staff") : "https://op.gg/..."} disabled={isStaffRole(editingPlayer.role)} /><SelectInput label={t("Effectif")} value={playerEditForm.rosterStatus} onChange={(rosterStatus) => setPlayerEditForm({ ...playerEditForm, rosterStatus })} disabled={isStaffRole(editingPlayer.role) || editingPlayer.role === "SUB"}>{ROSTER_STATUS_OPTIONS.map((item) => <option key={item.id} value={item.id}>{t(item.label)}</option>)}</SelectInput></div>
        <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClosePlayerEdit}>{t("Annuler")}</Button><Button type="submit" icon={saving ? Loader2 : Check} disabled={saving || !canManageRoster}>{t("Enregistrer")}</Button></div>
      </form>}
    </section>

    <div className="team-management-section team-invitations">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h4 className="text-xl font-black text-white">{t("Invitations temporaires")}</h4>
            <p className="mt-1 text-sm font-semibold text-slate-300">{t("Un lien valable 1h, à transmettre au joueur ou au staff. Créer un nouveau lien révoque les précédents.")}</p>
          </div>
          <Button type="button" variant="ghost" icon={saving ? Loader2 : UserPlus} onClick={onCopyInvite} disabled={saving || !canInvite}>{t("Créer et copier un lien")}</Button>
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

    <div className="team-management-section">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div><h4 className="text-xl font-black text-white">{t("Profils & accès")}</h4><p className="mt-1 text-sm font-semibold text-slate-300">{t("Lie un compte, choisis son accès, et retire un profil depuis la même ligne.")}</p></div>
        <Badge tone="purple">{roster.length}{t(roster.length > 1 ? " profils" : " profil")}</Badge>
      </div>
      <div className="nxt5-management-profiles mt-4">
        {roster.map((player) => {
          const linkedMember = player.user_id ? memberByUser.get(player.user_id) : null;
          const staff = isStaffRole(player.role);
          return <div key={player.id} className="nxt5-management-profile">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2"><RoleTag role={player.role} staff={staff} className="max-w-[7rem] sm:max-w-[8.5rem]" /><Badge tone={player.user_id ? "green" : "orange"}>{player.user_id ? t("Lié") : t("Non-lié")}</Badge>{!staff && <label><span className="sr-only">{t("Effectif de ")}{player.name}</span><select value={playerRosterStatus(player)} onChange={(event) => onRosterStatusChange?.(player, event.target.value)} disabled={saving || !canManageRoster || player.role === "SUB"} title={t("Groupe d’effectif")} className="nxt5-input-shell nxt5-control team-roster-select">{ROSTER_STATUS_OPTIONS.map((item) => <option key={item.id} value={item.id}>{t(item.label)}</option>)}</select></label>}</div>
              <p className="mt-2 break-words text-lg font-semibold text-white">{linkedMember?.name || linkedMember?.account_name || player.name}</p>
              <p className="break-words text-xs text-slate-300">{player.riot_id || (staff ? t("Staff") : t("Riot ID manquant"))}</p>
            </div>
            <label className="block min-w-0"><span className="nxt5-field-label">{t("Compte lié")}</span><select value={player.user_id || ""} onChange={(event) => onLink(player.id, event.target.value)} disabled={saving || !canManageRoster} className="nxt5-input-shell nxt5-control team-access-select"><option value="">{t("Non-lié")}</option>{members.map((member) => { const blocked = isLinkedElsewhere(member, player); return <option key={member.user_id} value={member.user_id} disabled={blocked}>{t(linkedProfileLabel(member))}{blocked ? t(" · Déjà lié") : ""}</option>; })}</select></label>
            <label className="block min-w-0"><span className="nxt5-field-label">{t("Accès")}</span><select value={linkedMember ? roleValue(linkedMember.role) : "player"} onChange={(event) => linkedMember && onRoleChange(linkedMember.user_id, event.target.value)} disabled={!linkedMember || saving || !canManageMembers || String(linkedMember?.role || "").toLowerCase() === "owner"} className="nxt5-input-shell nxt5-control team-access-select">{TEAM_ACCESS_ROLES.map(([id, label]) => <option key={id} value={id}>{t(label)}</option>)}</select></label>
            <div className="nxt5-management-actions">
              {linkedMember && <Button type="button" variant="ghost" icon={UserMinus} className="px-3" onClick={() => onRemoveMember(linkedMember.user_id, roleLabel(player.role) + " · " + (linkedMember.name || player.name))} disabled={saving || !canManageMembers || String(linkedMember.role || "").toLowerCase() === "owner"}><span>{t("Renvoyer")}</span></Button>}
              <Button type="button" variant="ghost" icon={Pencil} className="px-3" onClick={(event) => { editTriggerRef.current = event.currentTarget; onEditPlayer(player); }} disabled={saving || !canManageRoster}><span>{t("Modifier")}</span></Button>
              <Button type="button" variant="danger" icon={Trash2} className="px-3" onClick={() => onDeletePlayer(player.id, player.name)} disabled={saving || !canManageRoster}><span>{t("Supprimer")}</span></Button>
            </div>
          </div>;
        })}
      </div>
    </div>

    {unlinkedMemberRows.length > 0 && <div className="team-management-section">
      <h4 className="text-xl font-black text-white">{t("Comptes sans profil")}</h4>
      <div className="mt-4 grid gap-2 lg:grid-cols-2">
        {unlinkedMemberRows.map((member) => <div key={member.id} className="team-unlinked-account">
          <div className="min-w-0"><div className="flex flex-wrap gap-2"><Badge tone="slate">{t("Non-lié")}</Badge><Badge tone={profileStatusTone(member)}>{t(profileStatusLabel(member))}</Badge></div><p className="mt-2 truncate text-sm font-black text-white">{member.name || member.account_name || t("Compte invité")}</p></div>
          <div className="flex flex-wrap gap-2"><select value={roleValue(member.role)} onChange={(event) => onRoleChange(member.user_id, event.target.value)} disabled={saving || !canManageMembers || String(member.role || "").toLowerCase() === "owner"} aria-label={t("Accès de {0}", [member.name || member.account_name || t("ce compte")])} className="nxt5-input-shell nxt5-control team-access-select">{TEAM_ACCESS_ROLES.map(([id, label]) => <option key={id} value={id}>{t(label)}</option>)}</select><Button type="button" variant="danger" icon={UserMinus} onClick={() => onRemoveMember(member.user_id, member.name || t("ce compte non lié"))} disabled={saving || !canManageMembers || String(member.role || "").toLowerCase() === "owner"}>{t("Renvoyer")}</Button></div>
        </div>)}
      </div>
    </div>}

    <ReadingDetails title={t("Identité de l’équipe")} description={t("Nom, tag et image de l’équipe.")} className="team-identity-details">
      <form onSubmit={onSaveTeam} className="team-identity-form">
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
          <Button type="submit" icon={saving ? Loader2 : Check} disabled={saving || !canEditIdentity}>{t("Enregistrer")}</Button>
          {canDeleteTeam && <Button type="button" variant="danger" icon={saving ? Loader2 : Trash2} onClick={onDeleteTeam} disabled={saving}>{t("Supprimer")}</Button>}
        </div>
        {!canEditIdentity && <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3 text-sm font-semibold text-amber-100">{t("Ton statut actuel ne permet pas de modifier la gestion.")}</p>}
      </form>
    </ReadingDetails>
  </Surface>;
}

function ChampionCircle({ champion }) {
  useLanguage();
  const label = `${championDisplayName(champion.champion)} · ${champion.games} partie${champion.games > 1 ? "s" : ""}`;
  return <span className="team-roster-champion" role="img" aria-label={t(label)} title={t(label)}>
    <ChampionPortrait champion={champion.champion} alt={t(label)} />
  </span>;
}

function playerImportedChampionStats(player, matches = []) {
  const rows = playerIntegratedRows(player, matches);
  return Array.from(rows.reduce((map, row) => {
    const champion = row.champion || "Champion";
    const current = map.get(champion) || { champion, games: 0, wins: 0 };
    current.games += 1;
    current.wins += row.match?.result === "Victoire" ? 1 : 0;
    map.set(champion, current);
    return map;
  }, new Map()).values()).sort((a, b) => b.games - a.games || b.wins - a.wins || championDisplayName(a.champion).localeCompare(championDisplayName(b.champion)));
}

function ImportedChampionBadges({ player, matches = [] }) {
  useLanguage();
  const items = playerImportedChampionStats(player, matches).slice(0, 3);
  if (!items.length) return null;
  return <span className="team-roster-champions"><span className="sr-only">{t("Champions les plus joués : ")}</span>{items.map((champion) => <ChampionCircle key={champion.champion} champion={champion} />)}</span>;
}

function PremiumRosterTable({ roster, matches = [], currentUserId = "", canManage = false }) {
  useLanguage();
  const sortRoster = (items) => [...items].sort((a, b) => rosterRoleIndex(a.role) - rosterRoleIndex(b.role) || String(a.name || "").localeCompare(String(b.name || "")));
  const players = roster.filter((item) => !isStaffRole(item.role));
  const mainRoster = sortRoster(players.filter((item) => playerRosterStatus(item) === "MAIN"));
  const subRoster = sortRoster(players.filter((item) => playerRosterStatus(item) === "SUB"));
  const inactiveRoster = sortRoster(players.filter((item) => playerRosterStatus(item) === "INACTIVE"));
  const staffRoster = roster.filter((item) => isStaffRole(item.role));
  const hasActivePlayers = mainRoster.length + subRoster.length > 0;
  const addPlayer = canManage && <LinkButton href="/gestion-equipe?section=roster" navigate={openAppPath} variant="ghost" icon={Plus}>{t("Ajouter un joueur")}</LinkButton>;

  function renderPlayers(items, title) {
    return <ul className="team-roster-list" aria-label={t(title)}>
      {items.map((player) => {
        const href = `/mon-profil?player=${encodeURIComponent(player.id)}`;
        const isMe = Boolean(currentUserId && player.user_id && String(player.user_id) === String(currentUserId));
        return <li key={player.id}>
          <a href={href} className="team-roster-row" onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            openAppPath(href);
          }}>
            <span className="team-roster-role"><span aria-hidden="true"><RoleIcon role={player.role} className="h-5 w-5" /></span><span>{t(roleLabel(player.role))}</span></span>
            <span className="team-roster-identity"><span className="team-roster-name"><span className="sr-only">{t("Voir le profil de ")}</span>{player.name}{isMe && <span className="team-roster-me">{t("Toi")}</span>}</span><span className="team-roster-riot">{player.riot_id || t("Riot ID à renseigner")}</span></span>
            <ImportedChampionBadges player={player} matches={matches} />
            <ArrowRight aria-hidden="true" className="team-roster-arrow" />
          </a>
        </li>;
      })}
    </ul>;
  }

  return <div className="team-roster">
    {!hasActivePlayers && <div className="team-roster-empty">
      <div><h3>{inactiveRoster.length ? t("Aucun joueur actif") : canManage ? t("Ajoute ton premier joueur") : t("Le roster est en préparation")}</h3>
        <p>{canManage ? inactiveRoster.length ? t("Ajoute un joueur ou réactive un profil depuis la gestion de l’équipe.") : t("Un nom, un Riot ID et un poste suffisent pour commencer.") : t("Demande à ton staff d’ajouter les joueurs.")}</p>
      </div>
      {addPlayer}
    </div>}
    {mainRoster.length > 0 && <section className="team-roster-section" aria-label={t("Titulaires")}>
      <div className="team-roster-heading"><h3>{t("Titulaires ")}<span>{mainRoster.length}</span></h3>{addPlayer}</div>
      {renderPlayers(mainRoster, "Titulaires")}
    </section>}
    {subRoster.length > 0 && <section className="team-roster-section" aria-label={t("Remplaçants")}>
      <div className="team-roster-heading"><h3>{t("Remplaçants ")}<span>{subRoster.length}</span></h3>{!mainRoster.length && addPlayer}</div>
      {renderPlayers(subRoster, "Remplaçants")}
    </section>}
    {staffRoster.length > 0 && <section className="team-roster-section" aria-label={t("Encadrement")}>
      <div className="team-roster-heading"><h3>{t("Encadrement ")}<span>{staffRoster.length}</span></h3></div>
      <ul className="team-roster-staff">{staffRoster.map((member) => <li key={member.id}><span>{member.name}</span><span>{t(roleLabel(member.role))}</span></li>)}</ul>
    </section>}
    {inactiveRoster.length > 0 && <details className="team-roster-options">
      <summary>{t("Hors effectif actif ")}<span>{inactiveRoster.length}</span></summary>
      {renderPlayers(inactiveRoster, "Hors effectif actif")}
    </details>}
  </div>;
}
export { Teams, parseMultiOpgg, decodeLoose, opggUrlFromRiotId, TeamManagementPanel, PROFILE_ROLES, RoleTag, PremiumRosterTable, rosterRoleIndex, ImportedChampionBadges, ChampionCircle, playerImportedChampionStats };
