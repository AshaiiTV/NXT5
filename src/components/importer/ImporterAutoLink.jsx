import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Clock3, Copy, Link2, Loader2, Plug, RefreshCw, ShieldOff, Trash2, Wand2, X } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { errorToast } from "../../app/helpers.js";
import { GameOperationDialog } from "../games/GameOperationDialog.jsx";
import { Badge, Button, SelectInput, Surface } from "../ui/Core.jsx";
import { getLocale } from "../../i18n/locale.js";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import "./importer-auto-link.css";

const LINK_TONES = { connected: "green", waiting: "yellow", expired: "slate", revoked: "slate" };
const LINK_LABELS = { connected: "Connectée", waiting: "En attente de l’Importer", expired: "Expirée", revoked: "Révoquée" };

function formatDate(value, withTime = true) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return withTime ? date.toLocaleString(getLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : date.toLocaleDateString(getLocale(), { day: "numeric", month: "long" });
}

export function ImporterAutoLink({ teamId, categories = [], canManage = false, busy = false, pushToast, onFinalize, refreshKey, actionContainer }) {
  useLanguage();
  const [state, setState] = useState({ loading: true, error: "", result: null, teamId: null });
  const [code, setCode] = useState(null);
  const [categoryId, setCategoryId] = useState("");
  const [working, setWorking] = useState("");
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = useCallback(async (signal) => {
    if (!teamId) return;
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const result = await apiFetch(`team-import-link?teamId=${encodeURIComponent(teamId)}`, { signal });
      if (!signal?.aborted) setState({ loading: false, error: "", result, teamId });
    } catch (err) {
      if (!signal?.aborted) setState({ loading: false, error: err?.message || t("Chargement impossible. Réessaie."), result: null, teamId });
    }
  }, [teamId]);
  useEffect(() => { const controller = new AbortController(); setCode(null); load(controller.signal); return () => controller.abort(); }, [load, refreshKey]);

  const result = state.teamId === teamId ? state.result : null;
  const links = (result?.links || []).filter((link) => link.status === "connected" || link.status === "waiting");
  const pending = (result?.submissions || []).filter((row) => row.status === "pending");

  async function act(key, body, success) {
    if (working || busy) return null;
    setWorking(key);
    try {
      const response = await apiFetch("team-import-link", { method: "POST", body: JSON.stringify({ teamId, ...body }) });
      if (success) pushToast?.({ type: "green", title: success[0], text: success[1] });
      await load();
      return response;
    } catch (err) {
      pushToast?.(errorToast(err, t("Action impossible")));
      return null;
    } finally {
      setWorking("");
    }
  }
  async function createCode() {
    const response = await act("create", { action: "create", ...(categoryId ? { categoryId } : {}) });
    if (response) { setCode(response); setCopied(false); }
  }
  async function copyCode() {
    try { await navigator.clipboard.writeText(code.code); setCopied(true); } catch { setCopied(false); }
  }
  async function finalize(submission) {
    const response = await act(submission.id, { action: "pending", submissionId: submission.id });
    if (response?.payload) await onFinalize?.(response.payload, submission);
  }

  if (!teamId) return null;
  if (!canManage && result && !links.length && !pending.length) return null;
  const linkButton = (canManage || links.length > 0) && <Button
    type="button" variant="ghost" className="importer-auto-launcher" icon={Link2} aria-haspopup="dialog"
    aria-label={t("Liaison avec l’Importer")} title={t("Liaison avec l’Importer")}
    onClick={() => setSettingsOpen(true)}
  >{t("Liaison")}</Button>;
  const refreshButton = <Button variant="ghost" icon={state.loading ? Loader2 : RefreshCw} aria-label={t("Actualiser")} title={t("Actualiser")} disabled={state.loading || Boolean(working)} onClick={() => load()} className="importer-auto-refresh"><span>{t("Actualiser")}</span></Button>;
  const loadError = state.error && <div role="alert" className="importer-auto-error"><p>{state.error}</p><Button variant="ghost" icon={RefreshCw} onClick={() => load()}>{t("Réessayer")}</Button></div>;
  return <>
    {pending.length > 0 && <Surface className="importer-auto-link">
      <div className="importer-auto-head">
        <Wand2 aria-hidden="true" />
        <h3>{t("Import automatique")}</h3>
        {refreshButton}
      </div>
      <div className="importer-auto-received">
        <h4><Clock3 aria-hidden="true" />{t("Parties à finaliser")}</h4>
        <ul>{pending.map((row) => <li key={row.id}>
          <div><strong translate="no">{row.gameId}</strong><span>{formatDate(row.createdAt)}{row.reason ? ` · ${row.reason}` : ""}</span></div>
          {canManage && <div className="importer-auto-actions">
            <Button icon={working === row.id ? Loader2 : Check} disabled={Boolean(working) || busy} aria-label={t("Finaliser la partie {0}", [row.gameId])} onClick={() => finalize(row)}>{t("Finaliser")}</Button>
            <Button variant="ghost" icon={Trash2} disabled={Boolean(working) || busy} aria-label={t("Ignorer la partie {0}", [row.gameId])} onClick={() => act(row.id, { action: "dismiss", submissionId: row.id })}>{t("Ignorer")}</Button>
          </div>}
        </li>)}</ul>
      </div>
      {!canManage && !links.length && <p className="importer-auto-hint">{t("Aucune liaison active. Le staff de l’équipe peut lier NXT5 Importer depuis cette page.")}</p>}
    </Surface>}
    {actionContainer?.nodeType === 1 ? createPortal(linkButton, actionContainer) : linkButton}
    {!settingsOpen && loadError}
    {settingsOpen && <GameOperationDialog compact title={t("Liaison avec l’Importer")} onClose={() => setSettingsOpen(false)} busy={Boolean(working)}>
      {loadError}
      {canManage && result && !links.length && <p className="importer-auto-hint">{t("Lie NXT5 Importer pour importer les parties personnalisées de ton équipe.")}</p>}
      {canManage && (code ? <div className="importer-auto-code" role="status">
        <p className="importer-auto-code-label">{t("Colle ce code dans l’onglet Collecte automatique de NXT5 Importer. Il n’est valable qu’une fois, pendant 15 minutes.")}</p>
        <div className="importer-auto-code-row"><code translate="no">{code.code}</code><Button variant="ghost" icon={copied ? Check : Copy} onClick={copyCode}>{copied ? t("Copié") : t("Copier")}</Button><Button variant="ghost" icon={X} onClick={() => setCode(null)}>{t("Fermer")}</Button></div>
        <p className="importer-auto-hint">{t("Expire le {0}.", [formatDate(code.expiresAt)])}</p>
      </div> : result && <div className="importer-auto-create">
        {categories.length > 1 && <SelectInput label="Tag des parties reçues" value={categoryId} onChange={setCategoryId}><option value="">{t("Tag par défaut de l’équipe")}</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</SelectInput>}
        <Button icon={working === "create" ? Loader2 : Link2} disabled={Boolean(working) || busy} onClick={createCode}>{links.length ? t("Lier un autre ordinateur") : t("Lier NXT5 Importer")}</Button>
      </div>)}

      {links.length > 0 && <ul className="importer-auto-links" aria-label={t("Liaisons de l’Importer")}>{links.map((link) => <li key={link.id}>
        <Plug aria-hidden="true" />
        <div><strong>{link.label || t("Ordinateur sans nom")}</strong><span>{link.status === "connected" ? t("Vu le {0} · expire le {1}", [formatDate(link.lastSeenAt || link.connectedAt), formatDate(link.expiresAt, false)]) : t("Code en attente dans l’Importer")}</span></div>
        <Badge tone={LINK_TONES[link.status] || "slate"}>{t(LINK_LABELS[link.status] || link.status)}</Badge>
        {canManage && <Button variant="ghost" icon={working === link.id ? Loader2 : ShieldOff} disabled={Boolean(working) || busy} onClick={() => act(link.id, { action: "revoke", linkId: link.id }, [t("Liaison révoquée"), t("Cet ordinateur ne peut plus envoyer de parties.")])}>{t("Révoquer")}</Button>}
      </li>)}</ul>}
      {!state.error && <div className="importer-auto-dialog-footer">{refreshButton}</div>}
    </GameOperationDialog>}
  </>;
}

export default ImporterAutoLink;
