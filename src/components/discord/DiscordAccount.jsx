import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import { useEffect, useId, useState } from "react";
import { Check, Copy, RefreshCw, UserRound } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { Badge, Button, Surface } from "../ui/Core.jsx";
import "./discord.css";

export default function DiscordAccount({ user }) {
  useLanguage();
  const [token] = useState(() => new URLSearchParams(globalThis.window?.location?.search || "").get("lier") || "");
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [unlink, setUnlink] = useState(false);
  const [managing, setManaging] = useState(false);
  const manageId = useId();

  async function refresh() {
    setLoading(true);
    setError("");
    try { setState(await apiFetch(`discord-account${token ? `?token=${encodeURIComponent(token)}` : ""}`)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    // The short-lived personal link need not remain in browser history.
    if (token) {
      const url = new URL(window.location.href);
      url.searchParams.delete("lier");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    refresh();
  }, [token]);

  async function prepare() {
    setBusy(true); setError("");
    try { setState(await apiFetch("discord-account", { method: "POST", body: JSON.stringify({ token }) })); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError("");
    try { await apiFetch("discord-account", { method: "DELETE" }); setState({ link: null }); setUnlink(false); setManaging(false); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function copyCommand() {
    try {
      await navigator.clipboard.writeText("/nxt lier");
      setCopied(true);
      setCopyNotice("Commande copiée. Colle-la dans Discord, puis ouvre le lien du bot.");
    } catch {
      setCopied(false);
      setCopyNotice("La copie n’a pas fonctionné. Saisis /nxt lier directement dans Discord.");
    }
  }

  const request = state?.request;
  const linked = Boolean(state?.link);
  const initiallyLoading = loading && !state;
  const status = linked ? "Compte lié" : error ? "À vérifier" : request?.prepared ? "À terminer dans Discord" : request ? "À confirmer ici" : "Compte non lié";

  return <Surface className={`discord-account${linked ? " discord-account-linked" : ""}`}>
    <div className="discord-account-heading">
      <div className="discord-account-identity">
        <h3 className="discord-account-title"><UserRound size={20} aria-hidden="true" />{t(" Toi sur Discord")}</h3>
        {linked ? <p className="discord-account-description"><strong>{state.link.discord_label}</strong>{t(" · ton compte personnel est reconnu par NXT5.")}</p> : <p className="discord-account-description">{t("Relie ton compte personnel pour utiliser les commandes du bot avec ton équipe.")}</p>}
      </div>
      {!initiallyLoading && <div className="discord-account-heading-actions">
        <Badge tone={linked ? "green" : request || error ? "yellow" : "slate"}>{t(status)}</Badge>
        {linked && <Button type="button" variant="ghost" disabled={busy} aria-expanded={managing} aria-controls={managing ? manageId : undefined} onClick={() => { setManaging((open) => !open); setUnlink(false); }}>{managing ? t("Fermer la gestion") : t("Gérer")}</Button>}
      </div>}
    </div>
    {initiallyLoading ? <p className="mt-4 text-sm text-slate-300" role="status">{t("Vérification de ton compte Discord…")}</p> : linked ? <>
        <p className="discord-account-next">{t("Pour commencer : lance ")}<code>/nxt help</code>{t(" dans le salon Discord associé à ton équipe.")}</p>
        {managing && <div id={manageId} className="discord-account-management">
          <p className="break-words text-sm leading-6 text-slate-300">{t("Identifiant Discord : ")}{state.link.discord_user_id}</p>
          <p className="text-sm leading-6 text-slate-300">{t("Cette liaison concerne ton compte personnel. L’installation du bot et les publications se règlent pour toute l’équipe ci-dessous.")}</p>
          {unlink ? <div className="discord-confirm" role="group" aria-label={t("Confirmer la déliaison")}>
            <p className="text-sm leading-6 text-slate-200">{t("Retirer cette liaison révoque les accès Discord à ton compte et les actions en attente.")}</p>
            <div className="flex flex-wrap gap-3"><Button type="button" variant="danger" disabled={busy || loading} onClick={remove}>{busy ? t("Déliaison…") : t("Confirmer la déliaison")}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setUnlink(false)}>{t("Conserver la liaison")}</Button></div>
          </div> : <Button type="button" variant="ghost" disabled={loading} onClick={() => setUnlink(true)}>{t("Délier mon compte")}</Button>}
          <Button type="button" variant="ghost" icon={RefreshCw} disabled={busy || loading} onClick={refresh}>{loading ? t("Vérification…") : t("Actualiser la liaison")}</Button>
        </div>}
      </> : request ? <div className="discord-account-request">
        <p className="discord-account-step-label">{t("Étape ")}{request.prepared ? t("3 sur 3 · Retour dans Discord") : t("2 sur 3 · Confirmation sur NXT5")}</p>
        <dl className="discord-account-pair">
          <div><dt className="text-slate-400">{t("Ton compte NXT5")}</dt><dd className="break-words font-bold text-white">{state.accountName || user?.account_name}</dd></div>
          <div><dt className="text-slate-400">{t("Ton compte Discord")}</dt><dd className="break-words font-bold text-white">{request.discordLabel}<span className="discord-account-user-id">{t("Identifiant : ")}{request.discordUserId}</span></dd></div>
        </dl>
        {request.prepared ? <div className="discord-feedback" role="status"><strong>{t("Compte NXT5 confirmé. Dernière étape dans Discord.")}</strong><p>{t("Reviens dans Discord, clique sur « Vérifier la liaison », puis sur « Confirmer la liaison » après avoir vérifié les deux comptes.")}</p></div> : <><p className="text-sm leading-6 text-slate-300">{t("Ces deux comptes sont bien les tiens ? Confirme ici, puis termine la validation dans Discord.")}</p><Button type="button" disabled={busy || loading} onClick={prepare}>{busy ? t("Confirmation…") : t("Confirmer mon compte NXT5")}</Button></>}
        <p className="discord-help">{t("Ce lien personnel expire à ")}{new Date(request.expiresAt).toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" })}{t(". Pour recommencer, lance ")}<code>/nxt lier</code>{t(" dans Discord.")}</p>
        <Button type="button" variant="ghost" icon={RefreshCw} disabled={busy || loading} onClick={refresh}>{loading ? t("Vérification…") : request.prepared ? t("J’ai confirmé dans Discord · Vérifier") : t("Actualiser la liaison")}</Button>
      </div> : <div className="discord-account-start">
        <div className="discord-account-command">
          <p>{t("Dans Discord, lance ")}<code>/nxt lier</code>{t(", puis ouvre le lien du bot.")}</p>
          <Button type="button" variant="ghost" icon={copied ? Check : Copy} onClick={copyCommand}>{copied ? t("Commande copiée") : t("Copier /nxt lier")}</Button>
        </div>
        {copyNotice && <p className="discord-account-copy-notice" role="status">{t(copyNotice)}</p>}
        <details className="discord-guide discord-account-guide">
          <summary>{t("Comment relier mon compte ?")}</summary>
          <ol className="discord-account-steps">
            <li><strong>{t("Dans Discord")}</strong><span>{t("Lance ")}<code>/nxt lier</code>{t(" et ouvre ton lien personnel.")}</span></li>
            <li><strong>{t("Sur NXT5")}</strong><span>{t("Vérifie les deux comptes, puis confirme ton compte NXT5.")}</span></li>
            <li><strong>{t("De retour dans Discord")}</strong><span>{t("Clique sur « Vérifier la liaison », puis « Confirmer la liaison ».")}</span></li>
          </ol>
          <p className="discord-help">{t("Cette liaison est personnelle. Le bot de l’équipe se configure séparément ci-dessous. La commande ")}<code>/nxt help</code>{t(" reste accessible sans compte lié.")}</p>
          <Button type="button" variant="ghost" icon={RefreshCw} disabled={busy || loading} onClick={refresh}>{loading ? t("Vérification…") : t("Actualiser la liaison")}</Button>
        </details>
      </div>}
    {error && <div className="discord-account-error">
      <p className="break-words text-sm leading-6 text-rose-200" role="alert">{t(error)}</p>
      {!state && <Button type="button" variant="ghost" icon={RefreshCw} disabled={loading} onClick={refresh}>{t("Réessayer la vérification")}</Button>}
    </div>}
  </Surface>;
}
