import React, { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, Clock3, Copy, Link2, Loader2, Plug, RefreshCw, ShieldOff, Trash2, Wand2, X } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { errorToast } from "../../app/helpers.js";
import { Badge, Button, SelectInput, Surface } from "../ui/Core.jsx";
import { getLocale } from "../../i18n/locale.js";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import "./importer-auto-link.css";

const LINK_TONES = { connected: "green", waiting: "yellow", expired: "slate", revoked: "slate" };
const LINK_LABELS = { connected: "Connectée", waiting: "En attente de l’Importer", expired: "Expirée", revoked: "Révoquée" };
const SUBMISSION_TONES = { imported: "green", pending: "yellow", skipped: "slate", receiving: "cyan" };
const SUBMISSION_LABELS = { imported: "Importée", pending: "À finaliser", skipped: "Ignorée", receiving: "Réception en cours" };

function formatDate(value, withTime = true) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return withTime ? date.toLocaleString(getLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : date.toLocaleDateString(getLocale(), { day: "numeric", month: "long" });
}

export function ImporterAutoLink({ teamId, categories = [], canManage = false, busy = false, pushToast, onFinalize, refreshKey }) {
  useLanguage();
  const [state, setState] = useState({ loading: true, error: "", result: null, teamId: null });
  const [code, setCode] = useState(null);
  const [categoryId, setCategoryId] = useState("");
  const [working, setWorking] = useState("");
  const [copied, setCopied] = useState(false);

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
  const connectedLinks = links.filter((link) => link.status === "connected");
  const submissions = result?.submissions || [];
  const pending = submissions.filter((row) => row.status === "pending");
  const recent = submissions.filter((row) => row.status !== "pending").slice(0, 12);
  let statusText = t("Lier NXT5 Importer pour recevoir les parties jouées avec l’application ouverte.");
  if (state.loading) statusText = t("Chargement des imports…");
  else if (pending.length && !canManage) statusText = pending.length === 1 ? t("1 partie en attente du staff") : t("{0} parties en attente du staff", [pending.length]);
  else if (pending.length) statusText = pending.length === 1 ? t("1 partie à finaliser") : t("{0} parties à finaliser", [pending.length]);
  else if (connectedLinks.length) statusText = t("Les parties reconnues sont ajoutées à la bibliothèque ci-dessous.");
  else if (links.length) statusText = t("Code en attente dans l’Importer");

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

  function receivedRow(row, actionable = false) {
    return <li key={row.id}>
      <div className="importer-auto-game">
        <strong>{t("Reçue le {0}", [formatDate(row.createdAt)])}</strong>
        <span translate="no">{row.gameId}</span>
        {row.reason && <span>{row.reason}</span>}
      </div>
      {!actionable && <Badge tone={SUBMISSION_TONES[row.status] || "slate"}>{t(SUBMISSION_LABELS[row.status] || row.status)}</Badge>}
      {actionable && canManage && <div className="importer-auto-actions">
        <Button icon={working === row.id ? Loader2 : Check} disabled={Boolean(working) || busy} onClick={() => finalize(row)}>{t("Finaliser")}</Button>
        <Button variant="ghost" icon={Trash2} disabled={Boolean(working) || busy} onClick={() => act(row.id, { action: "dismiss", submissionId: row.id })}>{t("Ignorer")}</Button>
      </div>}
    </li>;
  }

  const createControls = <div className="importer-auto-create">
    {categories.length > 1 && <SelectInput label="Tag des parties reçues" value={categoryId} onChange={setCategoryId}><option value="">{t("Tag par défaut de l’équipe")}</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</SelectInput>}
    <Button icon={working === "create" ? Loader2 : Link2} disabled={Boolean(working) || busy} onClick={createCode}>{links.length ? t("Lier un autre ordinateur") : t("Lier NXT5 Importer")}</Button>
  </div>;

  if (!teamId) return null;
  // Players only see the panel once the staff linked something or games arrived.
  if (!canManage && result && !links.length && !submissions.length) return null;
  return <Surface className="importer-auto-link">
    <div className="importer-auto-head">
      <Wand2 aria-hidden="true" />
      <h3>{t("Imports automatiques")}</h3>
      <Button variant="ghost" icon={state.loading ? Loader2 : RefreshCw} disabled={state.loading} onClick={() => load()} className="importer-auto-refresh" aria-label={t("Actualiser les imports")}><span className="importer-auto-refresh-label">{t("Actualiser")}</span></Button>
      <p>{statusText}</p>
    </div>
    {state.error && <div role="alert" className="importer-auto-error"><p>{state.error}</p><Button variant="ghost" icon={RefreshCw} onClick={() => load()}>{t("Réessayer")}</Button></div>}

    {canManage && pending.length > 0 && <section className="importer-auto-pending" aria-label={t("Parties à finaliser")}>
      <h4><Clock3 aria-hidden="true" />{t("À finaliser")}<Badge tone="yellow">{pending.length}</Badge></h4>
      <ul>{pending.slice(0, 2).map((row) => receivedRow(row, true))}</ul>
      {pending.length > 2 && <details className="importer-auto-more"><summary>{t("Voir les {0} autres parties à finaliser", [pending.length - 2])}<ChevronDown aria-hidden="true" /></summary><ul>{pending.slice(2).map((row) => receivedRow(row, true))}</ul></details>}
    </section>}

    {code ? <div className="importer-auto-code" role="status">
      <p className="importer-auto-code-label">{t("Colle ce code dans l’onglet Collecte automatique de NXT5 Importer. Il n’est valable qu’une fois, pendant 15 minutes.")}</p>
      <div className="importer-auto-code-row"><code translate="no">{code.code}</code><Button variant="ghost" icon={copied ? Check : Copy} onClick={copyCode}>{copied ? t("Copié") : t("Copier")}</Button><Button variant="ghost" icon={X} onClick={() => setCode(null)}>{t("Fermer")}</Button></div>
      <p className="importer-auto-hint">{t("Expire le {0}.", [formatDate(code.expiresAt)])}</p>
    </div> : canManage && !links.length && createControls}
    {!canManage && result && !links.length && <p className="importer-auto-hint">{t("Aucune liaison active. Le staff de l’équipe peut lier NXT5 Importer depuis cette page.")}</p>}

    {links.length > 0 && <details className="importer-auto-disclosure" key={teamId}>
      <summary><span>{t("Gérer les ordinateurs liés")}{links.length > 0 && <Badge tone={connectedLinks.length ? "green" : "yellow"}>{links.length}</Badge>}</span><ChevronDown aria-hidden="true" /></summary>
      <div className="importer-auto-disclosure-body">
        {canManage && !code && links.length > 0 && createControls}
        {links.length > 0 && <ul className="importer-auto-links" aria-label={t("Liaisons de l’Importer")}>{links.map((link) => <li key={link.id}>
      <Plug aria-hidden="true" />
      <div><strong>{link.label || t("Ordinateur sans nom")}</strong><span>{link.status === "connected" ? t("Vu le {0} · expire le {1}", [formatDate(link.lastSeenAt || link.connectedAt), formatDate(link.expiresAt, false)]) : t("Code en attente dans l’Importer")}</span></div>
      <Badge tone={LINK_TONES[link.status] || "slate"}>{t(LINK_LABELS[link.status] || link.status)}</Badge>
      {canManage && <Button variant="ghost" icon={working === link.id ? Loader2 : ShieldOff} disabled={Boolean(working) || busy} onClick={() => act(link.id, { action: "revoke", linkId: link.id }, [t("Liaison révoquée"), t("Cet ordinateur ne peut plus envoyer de parties.")])}>{t("Révoquer")}</Button>}
        </li>)}</ul>}
      </div>
    </details>}

    {recent.length > 0 && <details className="importer-auto-disclosure importer-auto-history" key={`history-${teamId}`}>
      <summary><span>{t("Réceptions récentes")}<Badge tone="slate">{recent.length}</Badge></span><ChevronDown aria-hidden="true" /></summary>
      <ul>{recent.map((row) => receivedRow(row))}</ul>
    </details>}
  </Surface>;
}

export default ImporterAutoLink;
