import { useEffect, useState } from "react";
import { Link2, RefreshCw } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { Badge, Button, Surface } from "../ui/Core.jsx";

export default function DiscordAccount({ user }) {
  const [token] = useState(() => new URLSearchParams(globalThis.window?.location?.search || "").get("lier") || "");
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unlink, setUnlink] = useState(false);

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
    try { await apiFetch("discord-account", { method: "DELETE" }); setState({ link: null }); setUnlink(false); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const request = state?.request;
  return <Surface className="mb-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-lg font-black text-white"><Link2 size={20} aria-hidden="true" /> Mon compte Discord</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Lie ton compte personnel pour utiliser les commandes de tes équipes. Cette liaison reste distincte de la connexion du serveur.</p>
      </div>
      {state?.link && <Badge tone="cyan">Compte lié</Badge>}
    </div>
    {loading ? <p className="mt-4 text-sm text-slate-300" role="status">Chargement de ta liaison…</p>
      : state?.link ? <div className="mt-4 space-y-3">
        <p className="break-words text-sm leading-6 text-slate-200">Compte Discord : <strong>{state.link.discord_label}</strong><br /><span className="text-slate-400">Identifiant {state.link.discord_user_id}</span></p>
        <p className="text-sm leading-6 text-slate-300">Dans Discord, utilise <code className="break-words text-cyan-200">/nxt equipe choisir</code> puis <code className="text-cyan-200">/nxt help</code> pour commencer.</p>
        {unlink ? <div className="space-y-3" role="group" aria-label="Confirmer la déliaison">
          <p className="text-sm leading-6 text-slate-200">Retirer cette liaison révoque les accès Discord à ton compte et les actions en attente.</p>
          <div className="flex flex-wrap gap-3"><Button variant="danger" disabled={busy} onClick={remove}>{busy ? "Déliaison…" : "Confirmer la déliaison"}</Button><Button variant="ghost" disabled={busy} onClick={() => setUnlink(false)}>Conserver la liaison</Button></div>
        </div> : <Button variant="ghost" onClick={() => setUnlink(true)}>Délier mon compte</Button>}
      </div> : request ? <div className="mt-4 space-y-4">
        <dl className="space-y-2 text-sm leading-6">
          <div><dt className="text-slate-400">Ton compte NXT5</dt><dd className="break-words font-bold text-white">{state.accountName || user?.account_name}</dd></div>
          <div><dt className="text-slate-400">Le compte Discord à associer</dt><dd className="break-words font-bold text-white">{request.discordLabel} <span className="font-normal text-slate-400">({request.discordUserId})</span></dd></div>
        </dl>
        {request.prepared ? <p className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm leading-6 text-cyan-100" role="status">Compte NXT5 confirmé. Reviens dans Discord, clique sur « Vérifier la liaison », puis sur « Confirmer la liaison » après avoir vérifié les deux comptes.</p>
          : <><p className="text-sm leading-6 text-slate-300">Confirme si ces deux comptes sont les tiens. La dernière validation se fera dans Discord.</p><Button disabled={busy} onClick={prepare}>{busy ? "Confirmation…" : "Confirmer mon compte NXT5"}</Button></>}
        <p className="text-xs leading-5 text-slate-400">Le lien expire à {new Date(request.expiresAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}. Tu peux en générer un nouveau avec /nxt compte lier.</p>
      </div> : !error ? <div className="mt-4 space-y-3">
        <p className="text-sm leading-6 text-slate-200">Dans ton serveur Discord, saisis <code className="break-words text-cyan-200">/nxt compte lier</code> et ouvre le lien personnel proposé par le bot.</p>
        <p className="text-sm leading-6 text-slate-400">Le guide <code>/nxt help</code> est accessible avant la liaison du compte.</p>
      </div> : null}
    {error && <p className="mt-4 break-words text-sm leading-6 text-rose-200" role="alert">{error}</p>}
    {!loading && <Button variant="ghost" icon={RefreshCw} className="mt-4" disabled={busy} onClick={refresh}>Actualiser la liaison</Button>}
  </Surface>;
}
