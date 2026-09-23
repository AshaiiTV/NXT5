import React, { useEffect, useState } from "react";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import { Badge, Button } from "../ui/Core.jsx";
import { DiscordFeedback, discordQuery, useDiscordAction, useDiscordResource } from "./discord-shared.jsx";

export default function DiscordRoleAccess({ teamId, metadata, canManage = false, revision = 0 }) {
  const guildId = metadata.connection?.guildId;
  const [localRevision, setLocalRevision] = useState(0);
  const [draft, setDraft] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const resource = useDiscordResource(discordQuery("team-discord-role-access", { teamId }), `${revision}:${localRevision}`, { keepPreviousData: true });
  const action = useDiscordAction();
  const policy = resource.data;
  const stale = Boolean(policy?.enabled && policy.configuredGuildId !== guildId);
  const availableRoles = Array.isArray(metadata.roles) ? [...metadata.roles].sort((a, b) => a.name.localeCompare(b.name, "fr")) : [];
  const roleIds = new Set(availableRoles.map((role) => role.id));
  const missingIds = draft.filter((id) => !roleIds.has(id));
  const canEdit = canManage && metadata.health?.verified === true && !resource.loading && !resource.error && !action.busy;
  const canSave = canEdit && !stale && dirty && draft.length > 0 && draft.length <= 25 && missingIds.length === 0;

  useEffect(() => {
    if (dirty || !policy) return;
    setDraft(policy.configuredGuildId === guildId ? policy.roleIds || [] : []);
  }, [dirty, policy, guildId]);

  function toggleRole(roleId) {
    setDraft((current) => {
      if (current.includes(roleId)) return current.filter((id) => id !== roleId);
      return current.length < 25 ? [...current, roleId] : current;
    });
    setDirty(true);
  }

  function save(event) {
    event.preventDefault();
    if (!canSave) return;
    action.run("team-discord-role-access", { teamId, guildId, roleIds: draft }, (saved) => {
      setDraft(saved.roleIds);
      setDirty(false);
      setLocalRevision((value) => value + 1);
    }, "Rôles autorisés enregistrés pour cette équipe.");
  }

  function remove() {
    if (!canEdit || !policy?.enabled) return;
    action.run("team-discord-role-access", { teamId, guildId, roleIds: [] }, () => {
      setDraft([]);
      setDirty(false);
      setConfirmRemove(false);
      setLocalRevision((value) => value + 1);
    }, "Restriction par rôles supprimée pour cette équipe.");
  }

  return <section className="discord-section discord-role-access" aria-label="Accès aux commandes de l’équipe">
    <div className="discord-heading"><h4><ShieldCheck aria-hidden="true" className="h-5 w-5" />Accès aux commandes de l’équipe</h4><Badge tone={policy?.enabled ? stale ? "red" : "cyan" : "slate"}>{policy?.enabled ? stale ? "À reconfigurer" : "Rôles requis" : "Droits NXT5"}</Badge></div>
    <p>Un membre doit toujours être lié à cette équipe NXT5 et posséder les droits correspondant à la commande. Tu peux exiger en plus au moins un des rôles Discord choisis ci-dessous, uniquement pour les commandes du bot de cette équipe.</p>
    <p className="discord-help">Ce réglage ne masque pas les messages déjà publiés : leur visibilité dépend des permissions des salons Discord.</p>
    <DiscordFeedback loading={resource.loading && !policy} error={resource.error || action.error} notice={action.notice} />
    {policy && <>
      {stale && <p role="alert" className="discord-feedback discord-feedback-error">Cette règle vient d’un autre serveur Discord. Les commandes de l’équipe restent bloquées tant qu’un responsable ne supprime pas cette ancienne restriction, puis choisit les rôles du serveur actuel.</p>}
      {!stale && policy.enabled && <p className="discord-help">Au moins un de ces rôles est requis : {policy.roleIds.map((id) => `@${availableRoles.find((role) => role.id === id)?.name || "rôle indisponible"}`).join(", ")}.</p>}
      {!policy.enabled && <p className="discord-help">Aucun rôle Discord supplémentaire n’est exigé actuellement. Les droits NXT5 de l’équipe restent contrôlés.</p>}
      {canManage && <form onSubmit={save}>
        <fieldset disabled={!canEdit || stale}>
          <legend>Rôles Discord autorisés</legend>
          <p className="discord-help">Coche un ou plusieurs rôles. Un administrateur Discord sans l’un de ces rôles ne pourra pas utiliser les commandes de cette équipe. Maximum 25 rôles.</p>
          {metadata.health?.verified !== true && <p className="discord-feedback">Impossible de modifier les rôles tant que la connexion au serveur n’est pas vérifiée. Actualise Discord pour réessayer.</p>}
          <div className="discord-role-grid">{availableRoles.map((role) => <label key={role.id} className="discord-check"><input type="checkbox" checked={draft.includes(role.id)} onChange={() => toggleRole(role.id)} /><span>@{role.name}</span></label>)}
            {missingIds.map((id) => <label key={id} className="discord-check"><input type="checkbox" checked onChange={() => toggleRole(id)} /><span>Rôle indisponible ({id}) · décocher pour le retirer</span></label>)}
          </div>
          {!availableRoles.length && metadata.health?.verified === true && <p className="discord-help">Aucun rôle configurable trouvé sur ce serveur.</p>}
          {missingIds.length > 0 && <p className="discord-help" role="alert">Un rôle enregistré n’est plus disponible. Retire-le de la sélection avant d’enregistrer.</p>}
          <div className="discord-actions"><Button type="submit" icon={action.busy ? Loader2 : Check} disabled={!canSave}>Enregistrer les rôles autorisés</Button>{dirty && <p role="status" className="discord-help">Modifications non enregistrées · {draft.length} rôle{draft.length > 1 ? "s" : ""} sélectionné{draft.length > 1 ? "s" : ""}.</p>}</div>
        </fieldset>
      </form>}
      {canManage && policy.enabled && !confirmRemove && <Button type="button" variant="ghost" icon={X} disabled={!canEdit} onClick={() => setConfirmRemove(true)}>Supprimer la restriction par rôles</Button>}
      {canManage && policy.enabled && confirmRemove && <div className="discord-confirm"><p>Supprimer la restriction par rôles pour cette équipe ? Ses membres liés à NXT5 pourront de nouveau utiliser les commandes selon leurs droits NXT5, même sans rôle Discord choisi ici.</p><div className="discord-actions"><Button type="button" variant="danger" disabled={action.busy} onClick={remove}>Confirmer la suppression</Button><Button type="button" variant="ghost" disabled={action.busy} onClick={() => setConfirmRemove(false)}>Annuler</Button></div></div>}
    </>}
  </section>;
}
