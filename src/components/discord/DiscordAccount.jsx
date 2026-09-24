import { useEffect, useId, useState } from "react";
import { Link2, RefreshCw } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { Badge, Button, Surface } from "../ui/Core.jsx";
import "./discord.css";

export default function DiscordAccount({ user }) {
  const [token] = useState(() => new URLSearchParams(globalThis.window?.location?.search || "").get("lier") || "");
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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

  const request = state?.request;
  return <Surface className="discord-account">
    <div className="discord-account-heading">
      <div className="min-w-0">
        <h3 className="discord-account-title"><Link2 size={20} aria-hidden="true" /> Mon compte Discord</h3>
        {!state?.link && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Commence par relier tes deux comptes pour utiliser les commandes de ton équipe.</p>}
      </div>
      {state?.link && <Badge tone="cyan">Compte lié</Badge>}
    </div>
    {loading ? <p className="mt-4 text-sm text-slate-300" role="status">Chargement de ta liaison…</p>
      : state?.link ? <div className="discord-account-state">
        <p className="break-words text-sm leading-6 text-slate-200">Compte lié à <strong>{state.link.discord_label}</strong>. <span className="block text-slate-300">Va dans le salon Discord de ton équipe et lance <code className="text-cyan-200">/nxt help</code> pour commencer.</span></p>
        <Button type="button" variant="ghost" aria-expanded={managing} aria-controls={managing ? manageId : undefined} onClick={() => { setManaging((open) => !open); setUnlink(false); }}>{managing ? "Fermer la gestion" : "Gérer"}</Button>
        {managing && <div id={manageId} className="discord-account-management">
          <p className="break-words text-sm leading-6 text-slate-300">Identifiant Discord : {state.link.discord_user_id}</p>
          <p className="text-sm leading-6 text-slate-300">Le salon Discord détermine l’équipe concernée par tes commandes. Tes droits restent ceux de ton compte NXT5.</p>
          {unlink ? <div className="discord-confirm" role="group" aria-label="Confirmer la déliaison">
            <p className="text-sm leading-6 text-slate-200">Retirer cette liaison révoque les accès Discord à ton compte et les actions en attente.</p>
            <div className="flex flex-wrap gap-3"><Button type="button" variant="danger" disabled={busy} onClick={remove}>{busy ? "Déliaison…" : "Confirmer la déliaison"}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setUnlink(false)}>Conserver la liaison</Button></div>
          </div> : <Button type="button" variant="ghost" onClick={() => setUnlink(true)}>Délier mon compte</Button>}
          <Button type="button" variant="ghost" icon={RefreshCw} disabled={busy || loading} onClick={refresh}>Actualiser la liaison</Button>
        </div>}
      </div> : request ? <div className="mt-4 space-y-4">
        <dl className="discord-account-pair">
          <div><dt className="text-slate-400">Ton compte NXT5</dt><dd className="break-words font-bold text-white">{state.accountName || user?.account_name}</dd></div>
          <div><dt className="text-slate-400">Le compte Discord à associer</dt><dd className="break-words font-bold text-white">{request.discordLabel} <span className="font-normal text-slate-400">({request.discordUserId})</span></dd></div>
        </dl>
        {request.prepared ? <p className="discord-feedback" role="status">Compte NXT5 confirmé. Reviens dans Discord, clique sur « Vérifier la liaison », puis sur « Confirmer la liaison » après avoir vérifié les deux comptes.</p>
          : <><p className="text-sm leading-6 text-slate-300">Confirme si ces deux comptes sont les tiens. La dernière validation se fera dans Discord.</p><Button disabled={busy} onClick={prepare}>{busy ? "Confirmation…" : "Confirmer mon compte NXT5"}</Button></>}
        <p className="discord-help">Le lien expire à {new Date(request.expiresAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}. Tu peux en générer un nouveau avec /nxt lier.</p>
      </div> : !error ? <div className="mt-4 space-y-3">
        <ol className="discord-steps text-sm leading-6 text-slate-200">
          <li>Dans Discord, lance <code className="break-words text-cyan-200">/nxt lier</code>.</li>
          <li>Ouvre le lien personnel du bot et confirme ton compte NXT5.</li>
          <li>Reviens dans Discord pour terminer la liaison.</li>
        </ol>
        <p className="text-sm leading-6 text-slate-400">Le guide <code>/nxt help</code> est accessible avant la liaison du compte.</p>
      </div> : null}
    {error && <p className="mt-4 break-words text-sm leading-6 text-rose-200" role="alert">{error}</p>}
    {!loading && !state?.link && <Button type="button" variant="ghost" icon={RefreshCw} className="mt-4" disabled={busy} onClick={refresh}>Actualiser la liaison</Button>}
  </Surface>;
}
