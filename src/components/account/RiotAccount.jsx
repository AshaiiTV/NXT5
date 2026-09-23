import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Link2, Loader2, Lock, Unlink } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { writeRememberPreference } from "../../app/helpers.js";
import { Badge, Button, Surface, TextInput } from "../ui/Core.jsx";

const CALLBACK_MESSAGES = {
  linked: "Ton compte Riot est associé. Tu peux maintenant l’utiliser pour te connecter à NXT5.",
  unlinked: "Ton compte Riot est dissocié. Ton mot de passe NXT5 reste utilisable.",
  not_linked: "Ce compte Riot n’est pas encore associé à NXT5. Connecte-toi à ton compte NXT5 ou crée un compte avec un mot de passe, puis choisis « Associer mon compte Riot » dans Paramètres.",
  cancelled: "Tu as annulé l’autorisation Riot. Tu peux recommencer quand tu le souhaites.",
  expired: "Cette demande Riot a expiré ou a déjà été utilisée. Recommence depuis cette page.",
  account_changed: "Le compte NXT5 connecté a changé. Vérifie ton compte puis recommence l’association.",
  account_already_linked: "Ton compte NXT5 est déjà associé à un autre compte Riot. Dissocie-le dans Paramètres avant d’en associer un nouveau.",
  conflict: "Ce compte Riot est déjà associé à un autre compte NXT5. Aucune association n’a été modifiée.",
  unavailable: "La connexion Riot est indisponible pour le moment. Utilise ton mot de passe NXT5.",
  failed: "La vérification Riot n’a pas abouti. Réessaie ou utilise ton mot de passe NXT5.",
};

export function riotCallbackStatus(search = globalThis.window?.location?.search || "") {
  const status = new URLSearchParams(search).get("riot");
  return Object.hasOwn(CALLBACK_MESSAGES, status) ? status : "";
}

export function RiotNotice({ status, message }) {
  const ref = useRef(null);
  const text = message || CALLBACK_MESSAGES[status];
  const success = status === "linked" || status === "unlinked";
  const informative = status === "not_linked" || status === "cancelled";
  useEffect(() => { if (text) ref.current?.focus(); }, [text]);
  if (!text) return null;
  return <div ref={ref} tabIndex={-1} role={success || informative ? "status" : "alert"} className={`rounded-xl border p-3 text-sm font-semibold leading-6 ${success ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100" : informative ? "border-cyan-300/25 bg-cyan-400/10 text-cyan-100" : "border-rose-300/25 bg-rose-500/10 text-rose-100"}`}>{text}</div>;
}

function useRiotStatus() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let mounted = true;
    setStatus(null);
    setError("");
    apiFetch("auth-riot-status").then((result) => {
      if (typeof result?.enabled !== "boolean" || typeof result?.linked !== "boolean") throw new Error("Invalid Riot status");
      if (mounted) setStatus(result);
    }).catch(() => { if (mounted) setError("La disponibilité de Riot n’a pas pu être vérifiée. Ta connexion NXT5 habituelle reste disponible."); });
    return () => { mounted = false; };
  }, [revision]);
  return { status, setStatus, error, refresh };
}

// Only the server builds this URL. Reject an unexpected destination before navigation.
function redirectToRiot(authorizationUrl) {
  const destination = new URL(authorizationUrl);
  if (destination.origin !== "https://auth.riotgames.com" || destination.pathname !== "/authorize" || destination.username || destination.password || destination.hash) {
    throw new Error("L’adresse d’autorisation Riot n’a pas pu être vérifiée.");
  }
  window.location.assign(destination.href);
}

function Availability({ status, error, refresh, id }) {
  if (error) return <div className="space-y-2"><p id={id} role="status" className="text-sm leading-6 text-slate-300">{error}</p><Button variant="ghost" type="button" onClick={refresh}>Réessayer la vérification</Button></div>;
  if (!status) return <p id={id} role="status" className="text-sm leading-6 text-slate-300">Vérification de la disponibilité Riot…</p>;
  if (!status.enabled) return <p id={id} className="text-sm leading-6 text-slate-300">Riot Sign On n’est pas encore disponible sur NXT5. La connexion avec ton mot de passe reste accessible.</p>;
  return null;
}

export function RiotLogin({ rememberMe = false, disabled = false }) {
  const { status, error: statusError, refresh } = useRiotStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function start() {
    if (busy || disabled || !status?.enabled) return;
    setBusy(true);
    setError("");
    try {
      const result = await apiFetch("auth-riot-start", { method: "POST", body: JSON.stringify({ flow: "login", rememberMe }) });
      writeRememberPreference(rememberMe);
      redirectToRiot(result?.authorizationUrl);
    } catch {
      setError("La connexion Riot n’a pas pu démarrer. Réessaie ou utilise ton mot de passe NXT5.");
      setBusy(false);
    }
  }
  return <section aria-label="Connexion avec Riot" className="mt-5 space-y-3 border-t border-white/10 pt-5">
    <Button type="button" variant="ghost" icon={busy ? Loader2 : ExternalLink} disabled={busy || disabled || !status?.enabled} onClick={start} aria-busy={busy} aria-describedby="riot-login-help" className="w-full">{busy ? "Ouverture de Riot…" : "Se connecter avec Riot"}</Button>
    {status?.enabled && <p id="riot-login-help" className="text-sm leading-6 text-slate-300">Pour un compte Riot déjà associé à NXT5. Tu t’authentifies sur le site officiel de Riot.</p>}
    <Availability status={status} error={statusError} refresh={refresh} id="riot-login-help" />
    <RiotNotice message={error} />
  </section>;
}

export function RiotAccount() {
  const { status, setStatus, error: statusError, refresh } = useRiotStatus();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(riotCallbackStatus);
  const actionsRef = useRef(null);
  const passwordRef = useRef(null);
  const wasConfirming = useRef(false);
  useEffect(() => {
    if (confirming) passwordRef.current?.querySelector("input")?.focus();
    else if (wasConfirming.current) actionsRef.current?.querySelector("button")?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  async function link() {
    if (busy || !status?.enabled || status.linked) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await apiFetch("auth-riot-start", { method: "POST", body: JSON.stringify({ flow: "link" }) });
      redirectToRiot(result?.authorizationUrl);
    } catch {
      setError("L’association Riot n’a pas pu démarrer. Réessaie dans quelques instants.");
      setBusy(false);
    }
  }

  function cancelUnlink() {
    setConfirming(false);
    setPassword("");
    setError("");
  }

  async function unlink(event) {
    event.preventDefault();
    if (busy || !password || !status?.linked) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiFetch("auth-riot-unlink", { method: "POST", body: JSON.stringify({ currentPassword: password }) });
      setStatus((current) => ({ ...current, linked: false, identity: undefined }));
      setPassword("");
      setConfirming(false);
      setNotice("unlinked");
    } catch (err) {
      setPassword("");
      setError(err?.status === 401 || err?.status === 403 ? "La dissociation n’a pas été autorisée. Vérifie ton mot de passe NXT5 et ta session, puis réessaie." : "La dissociation n’a pas pu être confirmée. Réessaie dans quelques instants.");
    } finally {
      setBusy(false);
    }
  }

  const identity = status?.linked ? status.identity : null;
  const linkedDate = identity?.linkedAt ? new Date(identity.linkedAt) : null;
  const verifiedNotice = notice === "linked" && !status?.linked || notice === "unlinked" && status?.linked !== false ? "" : notice;
  return <Surface className="p-5 xl:col-span-2">
    <section aria-labelledby="riot-account-title" className="space-y-4">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Badge tone="cyan">Connexion Riot</Badge><h3 id="riot-account-title" className="mt-3 text-2xl font-black text-white">Compte Riot</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-300">Associe ton compte Riot pour te connecter à ton compte NXT5 habituel. Tes équipes, tes droits et ton historique sont conservés.</p></div><Link2 aria-hidden="true" className="h-5 w-5 shrink-0 text-cyan-100" /></div>
      <RiotNotice status={verifiedNotice} message={error} />
      <Availability status={status} error={statusError} refresh={refresh} id="riot-account-availability" />
      {status?.linked ? <div className="space-y-4">
        <div><Badge tone="green">Associé</Badge><p className="mt-2 break-words text-lg font-black text-white">{identity?.gameName && identity?.tagLine ? `${identity.gameName}#${identity.tagLine}` : "Compte Riot associé"}</p>{linkedDate && !Number.isNaN(linkedDate.getTime()) && <p className="mt-1 text-sm text-slate-300">Depuis le {linkedDate.toLocaleDateString("fr-FR")}</p>}</div>
        <p className="text-sm leading-6 text-slate-300">Tu peux toujours te connecter avec ton e-mail ou ton pseudo et ton mot de passe NXT5.</p>
        <div ref={actionsRef}><Button type="button" variant="ghost" icon={Unlink} onClick={() => { setConfirming(true); setError(""); }} disabled={confirming || busy} aria-expanded={confirming} aria-controls="riot-unlink-form">Dissocier mon compte Riot</Button></div>
        {confirming && <form id="riot-unlink-form" onSubmit={unlink} onKeyDown={(event) => { if (event.key === "Escape" && !busy) { event.preventDefault(); cancelUnlink(); } }} className="space-y-3 border-t border-white/10 pt-4">
          <p id="riot-unlink-help" className="text-sm leading-6 text-slate-300">Confirme avec ton mot de passe NXT5. Après dissociation, utilise ce mot de passe pour te connecter. Tes autres sessions NXT5 seront fermées ; celle-ci restera ouverte. Aucune donnée d’équipe n’est supprimée.</p>
          <div ref={passwordRef} className="max-w-md"><TextInput label="Mot de passe NXT5 actuel" type="password" icon={Lock} value={password} onChange={setPassword} autoComplete="current-password" aria-describedby="riot-unlink-help" required disabled={busy} /></div>
          <div className="flex flex-wrap gap-2"><Button type="submit" variant="danger" icon={busy ? Loader2 : Unlink} disabled={busy || !password} aria-busy={busy}>{busy ? "Dissociation…" : "Confirmer la dissociation"}</Button><Button type="button" variant="ghost" onClick={cancelUnlink} disabled={busy}>Annuler</Button></div>
        </form>}
      </div> : status && <div className="space-y-3"><p className="text-sm leading-6 text-slate-300">Aucun compte Riot associé. Cette association est distincte du Riot ID déclaré dans ton roster.</p><Button type="button" variant="ghost" icon={busy ? Loader2 : ExternalLink} onClick={link} disabled={busy || !status.enabled} aria-busy={busy}>{busy ? "Ouverture de Riot…" : "Associer mon compte Riot"}</Button>{status.enabled && <p className="text-sm leading-6 text-slate-300">Tu vas être redirigé vers Riot pour autoriser cette association. NXT5 ne te demande jamais ton mot de passe Riot.</p>}</div>}
      <a href="/confidentialite#document-confidentialite-3" className="inline-block py-2 text-sm font-semibold text-cyan-200 underline underline-offset-4 hover:text-white">Données utilisées pour l’association Riot</a>
    </section>
  </Surface>;
}
