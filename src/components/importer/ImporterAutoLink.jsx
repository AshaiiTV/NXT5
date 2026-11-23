import React, { useCallback, useEffect, useState } from "react";
import { Check, Clock3, Copy, Link2, Loader2, Plug, RefreshCw, ShieldOff, Trash2, Wand2, X } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { errorToast } from "../../app/helpers.js";
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

export function useImporterAutoLink({ teamId, busy, pushToast, refreshKey, dialogOpen }) {
  const [state, setState] = useState({ loading: true, error: "", result: null, teamId: null });
  const [code, setCode] = useState(null);
  const [working, setWorking] = useState("");

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
  useEffect(() => { setCode(null); }, [teamId]);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, refreshKey, dialogOpen]);

  const result = state.teamId === teamId ? state.result : null;
  const links = (result?.links || []).filter((link) => link.status === "connected" || link.status === "waiting");
  const pending = (result?.submissions || []).filter((row) => row.status === "pending");

  async function act(key, body, success) {
    if (!teamId || working || busy) return null;
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
  return { result, links, pending, code, setCode, working, disabled: Boolean(working || busy), loading: state.loading, error: state.teamId === teamId ? state.error : "", load, act };
}

function RefreshButton({ importer }) {
  const { loading, working, load } = importer;
  return <Button variant="ghost" icon={loading ? Loader2 : RefreshCw} aria-label={t("Actualiser")} title={t("Actualiser")} disabled={loading || Boolean(working)} onClick={() => load()} className="importer-auto-refresh"><span>{t("Actualiser")}</span></Button>;
}

function LoadError({ importer }) {
  const { error, load } = importer;
  return error && <div role="alert" className="importer-auto-error"><p>{error}</p><Button variant="ghost" icon={RefreshCw} onClick={() => load()}>{t("Réessayer")}</Button></div>;
}

export function ImporterQueue({ importer, canManage, onFinalize }) {
  useLanguage();
  const { pending, links, working, disabled, act } = importer;
  async function finalize(submission) {
    const response = await act(submission.id, { action: "pending", submissionId: submission.id });
    if (response?.payload) await onFinalize?.(response.payload, submission);
  }

  return <>
    {pending.length > 0 && <Surface className="importer-auto-link">
      <div className="importer-auto-head">
        <Wand2 aria-hidden="true" />
        <h3>{t("Import automatique")}</h3>
        <RefreshButton importer={importer} />
      </div>
      <div className="importer-auto-received">
        <h4><Clock3 aria-hidden="true" />{t("Parties à finaliser")}</h4>
        <ul>{pending.map((row) => <li key={row.id}>
          <div><strong translate="no">{row.gameId}</strong><span>{formatDate(row.createdAt)}{row.reason ? ` · ${row.reason}` : ""}</span></div>
          {canManage && <div className="importer-auto-actions">
            <Button icon={working === row.id ? Loader2 : Check} disabled={disabled} aria-label={t("Finaliser la partie {0}", [row.gameId])} onClick={() => finalize(row)}>{t("Finaliser")}</Button>
            <Button variant="ghost" icon={Trash2} disabled={disabled} aria-label={t("Ignorer la partie {0}", [row.gameId])} onClick={() => act(row.id, { action: "dismiss", submissionId: row.id })}>{t("Ignorer")}</Button>
          </div>}
        </li>)}</ul>
      </div>
      {!canManage && !links.length && <p className="importer-auto-hint">{t("Aucune liaison active. Le staff de l’équipe peut lier NXT5 Importer depuis cette page.")}</p>}
    </Surface>}
    <LoadError importer={importer} />
  </>;
}

export function ImporterLinkSettings({ importer, categories = [], canManage }) {
  useLanguage();
  const { result, links, code, setCode, working, disabled, act } = importer;
  const [categoryId, setCategoryId] = useState("");
  const [copied, setCopied] = useState(false);
  async function createCode() {
    const response = await act("create", { action: "create", ...(categoryId ? { categoryId } : {}) });
    if (response) { setCode(response); setCopied(false); }
  }
  async function copyCode() {
    try { await navigator.clipboard.writeText(code.code); setCopied(true); } catch { setCopied(false); }
  }
  return <>
    <LoadError importer={importer} />
    {canManage && result && !links.length && <p className="importer-auto-hint">{t("Lie NXT5 Importer pour importer les parties personnalisées de ton équipe.")}</p>}
    {canManage && (code ? <div className="importer-auto-code" role="status">
      <p className="importer-auto-code-label">{t("Colle ce code dans l’onglet Collecte automatique de NXT5 Importer. Il n’est valable qu’une fois, pendant 15 minutes.")}</p>
      <div className="importer-auto-code-row"><code translate="no">{code.code}</code><Button variant="ghost" icon={copied ? Check : Copy} onClick={copyCode}>{copied ? t("Copié") : t("Copier")}</Button><Button variant="ghost" icon={X} onClick={() => setCode(null)}>{t("Fermer")}</Button></div>
      <p className="importer-auto-hint">{t("Expire le {0}.", [formatDate(code.expiresAt)])}</p>
    </div> : result && <div className="importer-auto-create">
      {categories.length > 1 && <SelectInput label="Tag des parties reçues" value={categoryId} onChange={setCategoryId}><option value="">{t("Tag par défaut de l’équipe")}</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</SelectInput>}
      <Button variant="ghost" icon={working === "create" ? Loader2 : Link2} disabled={disabled} onClick={createCode}>{links.length ? t("Lier un autre ordinateur") : t("Lier NXT5 Importer")}</Button>
    </div>)}

    {links.length > 0 && <ul className="importer-auto-links" aria-label={t("Liaisons de l’Importer")}>{links.map((link) => <li key={link.id}>
      <Plug aria-hidden="true" />
      <div><strong>{link.label || t("Ordinateur sans nom")}</strong><span>{link.status === "connected" ? t("Vu le {0} · expire le {1}", [formatDate(link.lastSeenAt || link.connectedAt), formatDate(link.expiresAt, false)]) : t("Code en attente dans l’Importer")}</span></div>
      <Badge tone={LINK_TONES[link.status] || "slate"}>{t(LINK_LABELS[link.status] || link.status)}</Badge>
      {canManage && <Button variant="ghost" icon={working === link.id ? Loader2 : ShieldOff} disabled={disabled} onClick={() => act(link.id, { action: "revoke", linkId: link.id }, [t("Liaison révoquée"), t("Cet ordinateur ne peut plus envoyer de parties.")])}>{t("Révoquer")}</Button>}
    </li>)}</ul>}
    {!importer.error && <div className="importer-auto-dialog-footer"><RefreshButton importer={importer} /></div>}
  </>;
}
