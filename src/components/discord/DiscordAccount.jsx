import { useEffect, useId, useState } from "react";
import { Check, Copy, RefreshCw, UserRound } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { Badge, Button, Surface } from "../ui/Core.jsx";
import "./discord.css";

export default function DiscordAccount({ user }) {
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
        <h3 className="discord-account-title"><UserRound size={20} aria-hidden="true" /> Toi sur Discord</h3>
        {linked ? <p className="discord-account-description"><strong>{state.link.discord_label}</strong> · ton compte personnel est reconnu par NXT5.</p>
          : <p className="discord-account-description">Relie ton compte personnel pour utiliser les commandes du bot avec ton équipe.</p>}
      </div>
      {!initiallyLoading && <div className="discord-account-heading-actions">
        <Badge tone={linked ? "green" : request || error ? "yellow" : "slate"}>{status}</Badge>
        {linked && <Button type="button" variant="ghost" disabled={busy} aria-expanded={managing} aria-controls={managing ? manageId : undefined} onClick={() => { setManaging((open) => !open); setUnlink(false); }}>{managing ? "Fermer la gestion" : "Gérer"}</Button>}
      </div>}
    </div>
    {initiallyLoading ? <p className="mt-4 text-sm text-slate-300" role="status">Vérification de ton compte Discord…</p>
      : linked ? <>
        <p className="discord-account-next">Pour commencer : lance <code>/nxt help</code> dans le salon Discord associé à ton équipe.</p>
        {managing && <div id={manageId} className="discord-account-management">
          <p className="break-words text-sm leading-6 text-slate-300">Identifiant Discord : {state.link.discord_user_id}</p>
          <p className="text-sm leading-6 text-slate-300">Cette liaison concerne ton compte personnel. L’installation du bot et les publications se règlent pour toute l’équipe ci-dessous.</p>
          {unlink ? <div className="discord-confirm" role="group" aria-label="Confirmer la déliaison">
            <p className="text-sm leading-6 text-slate-200">Retirer cette liaison révoque les accès Discord à ton compte et les actions en attente.</p>
            <div className="flex flex-wrap gap-3"><Button type="button" variant="danger" disabled={busy || loading} onClick={remove}>{busy ? "Déliaison…" : "Confirmer la déliaison"}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setUnlink(false)}>Conserver la liaison</Button></div>
          </div> : <Button type="button" variant="ghost" disabled={loading} onClick={() => setUnlink(true)}>Délier mon compte</Button>}
          <Button type="button" variant="ghost" icon={RefreshCw} disabled={busy || loading} onClick={refresh}>{loading ? "Vérification…" : "Actualiser la liaison"}</Button>
        </div>}
      </> : request ? <div className="discord-account-request">
        <p className="discord-account-step-label">Étape {request.prepared ? "3 sur 3 · Retour dans Discord" : "2 sur 3 · Confirmation sur NXT5"}</p>
        <dl className="discord-account-pair">
          <div><dt className="text-slate-400">Ton compte NXT5</dt><dd className="break-words font-bold text-white">{state.accountName || user?.account_name}</dd></div>
          <div><dt className="text-slate-400">Ton compte Discord</dt><dd className="break-words font-bold text-white">{request.discordLabel}<span className="discord-account-user-id">Identifiant : {request.discordUserId}</span></dd></div>
        </dl>
        {request.prepared ? <div className="discord-feedback" role="status"><strong>Compte NXT5 confirmé. Dernière étape dans Discord.</strong><p>Reviens dans Discord, clique sur « Vérifier la liaison », puis sur « Confirmer la liaison » après avoir vérifié les deux comptes.</p></div>
          : <><p className="text-sm leading-6 text-slate-300">Ces deux comptes sont bien les tiens ? Confirme ici, puis termine la validation dans Discord.</p><Button type="button" disabled={busy || loading} onClick={prepare}>{busy ? "Confirmation…" : "Confirmer mon compte NXT5"}</Button></>}
        <p className="discord-help">Ce lien personnel expire à {new Date(request.expiresAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}. Pour recommencer, lance <code>/nxt lier</code> dans Discord.</p>
        <Button type="button" variant="ghost" icon={RefreshCw} disabled={busy || loading} onClick={refresh}>{loading ? "Vérification…" : request.prepared ? "J’ai confirmé dans Discord · Vérifier" : "Actualiser la liaison"}</Button>
      </div> : <div className="discord-account-start">
        <div className="discord-account-command">
          <p>Dans Discord, lance <code>/nxt lier</code>, puis ouvre le lien du bot.</p>
          <Button type="button" variant="ghost" icon={copied ? Check : Copy} onClick={copyCommand}>{copied ? "Commande copiée" : "Copier /nxt lier"}</Button>
        </div>
        {copyNotice && <p className="discord-account-copy-notice" role="status">{copyNotice}</p>}
        <details className="discord-guide discord-account-guide">
          <summary>Comment relier mon compte ?</summary>
          <ol className="discord-account-steps">
            <li><strong>Dans Discord</strong><span>Lance <code>/nxt lier</code> et ouvre ton lien personnel.</span></li>
            <li><strong>Sur NXT5</strong><span>Vérifie les deux comptes, puis confirme ton compte NXT5.</span></li>
            <li><strong>De retour dans Discord</strong><span>Clique sur « Vérifier la liaison », puis « Confirmer la liaison ».</span></li>
          </ol>
          <p className="discord-help">Cette liaison est personnelle. Le bot de l’équipe se configure séparément ci-dessous. La commande <code>/nxt help</code> reste accessible sans compte lié.</p>
          <Button type="button" variant="ghost" icon={RefreshCw} disabled={busy || loading} onClick={refresh}>{loading ? "Vérification…" : "Actualiser la liaison"}</Button>
        </details>
      </div>}
    {error && <div className="discord-account-error">
      <p className="break-words text-sm leading-6 text-rose-200" role="alert">{error}</p>
      {!state && <Button type="button" variant="ghost" icon={RefreshCw} disabled={loading} onClick={refresh}>Réessayer la vérification</Button>}
    </div>}
  </Surface>;
}
