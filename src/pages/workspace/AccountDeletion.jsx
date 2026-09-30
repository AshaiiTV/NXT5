import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { Badge, Button, SelectInput, Surface, TextInput } from "../../components/ui/Core.jsx";
import "./account-settings.css";

// The confirmation token survives the provider redirect of a reauthentication.
// It never contains a password and stays in this tab only (sessionStorage).
export const ACCOUNT_DELETION_CONFIRMATION_KEY = "nxt5_account_deletion_confirmation";
// Set just before the final request: lets the app recover the receipt after a lost response.
export const ACCOUNT_DELETION_PENDING_KEY = "nxt5_account_deletion_pending";
const PROVIDER_LABELS = { google: "Google", discord: "Discord", apple: "Apple", riot: "Riot" };
const REAUTH_MESSAGES = {
  mismatch: (provider) => `Ce compte ${provider} n’est pas celui associé à NXT5. Réessaie avec le compte associé.`,
  cancelled: (provider) => `La confirmation avec ${provider} a été annulée. Ton compte est inchangé.`,
  expired: () => "La confirmation d’identité a expiré. Réessaie.",
  failed: (provider) => `La confirmation avec ${provider} n’a pas abouti. Réessaie dans quelques instants.`,
  account_changed: () => "Ta session a changé pendant la confirmation. Recommence depuis cette page.",
};

function storage() {
  try { return window.sessionStorage; } catch { return null; }
}
function readConfirmation() {
  try {
    const stored = JSON.parse(storage()?.getItem(ACCOUNT_DELETION_CONFIRMATION_KEY) || "null");
    if (stored && /^[A-Za-z0-9_-]{43}$/.test(stored.token) && Number(stored.expiresAt) > Date.now()) return stored.token;
  } catch {}
  forget(ACCOUNT_DELETION_CONFIRMATION_KEY);
  return "";
}
function remember(key, value) {
  try { storage()?.setItem(key, value); } catch {}
}
function forget(key) {
  try { storage()?.removeItem(key); } catch {}
}
function pendingToken() {
  try { return storage()?.getItem(ACCOUNT_DELETION_PENDING_KEY) || ""; } catch { return ""; }
}
/** Reads and removes the provider result added to /parametres by the reauthentication. */
function consumeReauthResult() {
  try {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("reauth");
    if (!status) return null;
    const provider = PROVIDER_LABELS[params.get("provider")] || "ce service";
    params.delete("reauth");
    params.delete("provider");
    const query = params.toString();
    window.history?.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    return { status, provider };
  } catch { return null; }
}

function Checkbox({ checked, onChange, disabled, children, danger = false }) {
  return <label className={`nxt5-account-deletion-check ${danger ? "is-danger" : ""}`}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    <span>{children}</span>
  </label>;
}

export function AccountDeletion({ onDeleted }) {
  const [token, setToken] = useState(() => pendingToken());
  const [step, setStep] = useState(() => pendingToken() ? 2 : 0);
  const [uncertain, setUncertain] = useState(() => Boolean(pendingToken()));
  const [details, setDetails] = useState(null);
  const [teamPlan, setTeamPlan] = useState({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [deleteEmptyTeams, setDeleteEmptyTeams] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const requestPending = useRef(false);
  const heading = useRef(null);
  const section = useRef(null);
  const previousStep = useRef(step);

  useEffect(() => {
    if (step) heading.current?.focus();
    else if (previousStep.current) section.current?.querySelector("button")?.focus();
    previousStep.current = step;
  }, [step]);

  // Back from the provider: resume the final step with the same confirmation.
  useEffect(() => {
    const result = consumeReauthResult();
    if (!result) return;
    section.current?.scrollIntoView?.({ block: "start" });
    const saved = readConfirmation();
    if (!saved || pendingToken()) {
      if (!pendingToken()) setError("La première confirmation a expiré. Recommence la suppression depuis le début.");
      return;
    }
    perform(async () => {
      const inspected = await post({ action: "inspect" });
      setDetails(inspected);
      setToken(saved);
      setAcknowledged(true);
      setStep(2);
      if (result.status === "verified" && inspected.reauthentication?.verifiedWith) {
        setNotice(`Identité confirmée avec ${result.provider}. Termine la suppression dans les 10 minutes.`);
      } else {
        setError((REAUTH_MESSAGES[result.status] || REAUTH_MESSAGES.failed)(result.provider));
      }
    });
  }, []);

  const teams = details?.teams || [];
  const emptyTeams = teams.filter((team) => !team.members.length);
  const planReady = teams.every((team) => !team.members.length ? deleteEmptyTeams : Boolean(teamPlan[team.id]));
  const hasPassword = details?.hasPassword !== false;
  const providers = details?.reauthentication?.providers || [];
  const verifiedWith = details?.reauthentication?.verifiedWith || null;
  const post = (body) => apiFetch("auth-delete-account", { method: "POST", body: JSON.stringify(body), timeoutMs: 45000 });

  function reset() {
    if (requestPending.current || uncertain) return;
    forget(ACCOUNT_DELETION_CONFIRMATION_KEY);
    setStep(0); setToken(""); setPassword(""); setConfirmation(""); setError(""); setNotice("");
    setAcknowledged(false); setDeleteEmptyTeams(false); setTeamPlan({}); setDetails(null);
  }
  function complete(result) {
    if (!result?.ok || !result.receipt?.reference) throw new Error("Le résultat n’a pas pu être confirmé.");
    forget(ACCOUNT_DELETION_PENDING_KEY);
    forget(ACCOUNT_DELETION_CONFIRMATION_KEY);
    setPassword(""); setToken("");
    onDeleted?.(result.receipt);
  }
  async function perform(action) {
    if (requestPending.current) return;
    requestPending.current = true; setBusy(true); setError(""); setNotice("");
    try { await action(); }
    catch (err) { setError(err.message || "Le service est temporairement indisponible. Ton compte est inchangé."); }
    finally { requestPending.current = false; setBusy(false); }
  }
  async function open() {
    await perform(async () => {
      setDetails(await post({ action: "inspect" }));
      setStep(1);
    });
  }
  async function prepare(event) {
    event.preventDefault();
    if (!acknowledged || !planReady) return;
    await perform(async () => {
      const plan = Object.fromEntries(teams.map((team) => [team.id, team.members.length ? teamPlan[team.id] : "delete"]));
      const result = await post({ action: "prepare", acknowledged, deleteEmptyTeams, teamPlan: plan });
      remember(ACCOUNT_DELETION_CONFIRMATION_KEY, JSON.stringify({ token: result.confirmationToken, expiresAt: Date.now() + result.expiresInSeconds * 1000 }));
      setToken(result.confirmationToken); setStep(2);
    });
  }
  async function reauthenticate(provider) {
    await perform(async () => {
      const result = await apiFetch("auth-social-start", { method: "POST", body: JSON.stringify({ provider, flow: "reauth" }) });
      const destination = new URL(result?.authorizationUrl);
      if (destination.protocol !== "https:") throw new Error("Le service n’a pas fourni de lien de connexion valide.");
      window.location.assign(destination.href);
    });
  }
  async function remove(event) {
    event.preventDefault();
    if (confirmation !== "SUPPRIMER" || (hasPassword && !password) || (!hasPassword && !verifiedWith) || !token) return;
    await perform(async () => {
      remember(ACCOUNT_DELETION_PENDING_KEY, token);
      try {
        complete(await post({ action: "delete", confirmationToken: token, confirmation, acknowledged: true, ...(hasPassword ? { currentPassword: password } : {}) }));
      } catch (err) {
        setPassword("");
        if (!err.status || err.status >= 500 || err.code === "ACCOUNT_DELETED") {
          setUncertain(true);
          try {
            const result = await post({ action: "status", confirmationToken: token });
            if (result?.ok) { complete(result); return; }
          } catch {}
          throw new Error("La réponse a été interrompue. La suppression peut avoir abouti : vérifie son résultat avant toute autre action.");
        }
        forget(ACCOUNT_DELETION_PENDING_KEY);
        if (["DELETION_CONFIRMATION_EXPIRED", "DELETION_TEAM_CHANGED", "ACCOUNT_CHANGED"].includes(err.code)) {
          forget(ACCOUNT_DELETION_CONFIRMATION_KEY);
          setStep(0); setToken(""); setConfirmation(""); setAcknowledged(false);
          setTeamPlan({}); setDeleteEmptyTeams(false); setDetails(null);
        }
        if (err.code === "DELETION_REAUTH_REQUIRED") setDetails((current) => current && { ...current, reauthentication: { ...current.reauthentication, verifiedWith: null } });
        throw err;
      }
    });
  }
  async function checkStatus() {
    await perform(async () => {
      const result = await post({ action: "status", confirmationToken: token });
      if (result?.ok) { complete(result); return; }
      // Still signed in and no receipt: the request was not applied. Resending the
      // same confirmation is safe, it can never run twice.
      forget(ACCOUNT_DELETION_PENDING_KEY);
      setUncertain(false);
      setError("Aucune suppression n’a été enregistrée : ton compte est toujours actif. Tu peux renvoyer la confirmation ou annuler.");
    });
  }

  const finalReady = confirmation === "SUPPRIMER" && (hasPassword ? Boolean(password) : Boolean(verifiedWith));
  return <section ref={section} id="suppression-compte" aria-labelledby="account-deletion-title" className="nxt5-account-deletion">
    <Surface className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge tone="red">Zone sensible</Badge>
          <h3 id="account-deletion-title" className="mt-3 text-xl font-semibold text-white">Supprimer mon compte</h3>
          <p className="mt-2 text-sm font-normal leading-6 text-slate-300">Action définitive, en deux confirmations. Ton identité est vérifiée avant la suppression.</p>
        </div>
        <AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0 text-rose-200" />
      </div>
      {error && <p role="alert" className="nxt5-account-deletion-message is-error">{error}</p>}
      {notice && <p role="status" className="nxt5-account-deletion-message is-success">{notice}</p>}
      {step === 0 && <Button type="button" variant="danger" icon={busy ? Loader2 : Trash2} disabled={busy} onClick={open} className="mt-5 w-full sm:w-auto">{busy ? "Chargement…" : "Supprimer mon compte"}</Button>}
      {step > 0 && <div className="nxt5-account-deletion-step" aria-busy={busy}>
        <h4 ref={heading} tabIndex={-1} className="nxt5-account-deletion-heading">{step === 1 ? "Confirmation 1 sur 2 : les conséquences" : "Confirmation 2 sur 2 : suppression définitive"}</h4>
        {step === 1 ? <form onSubmit={prepare} className="mt-4 space-y-4">
          <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
            <li>Ton accès est désactivé, toutes tes sessions sont fermées, ton pseudo et ton e-mail sont effacés.</li>
            <li>Tes profils joueur liés sont supprimés, avec leurs pools de champions, disponibilités, objectifs, notes de coaching et carnets de matchups.</li>
            <li>Tes connexions Google, Discord, Apple ou Riot{details?.discordLinked ? ", la liaison de ton compte Discord au bot" : ""} et ton abonnement sont retirés.</li>
            <li>Les parties, débriefs et contenus partagés des équipes conservées restent disponibles, sans ton nom d’auteur. Des mentions de ton pseudo peuvent subsister dans les fichiers de match importés et les textes rédigés par l’équipe.</li>
            <li>Une preuve datée de la suppression est conservée 12 mois, sans ton nom ni ton e-mail.</li>
          </ul>
          {teams.filter((team) => team.members.length).map((team) => <div key={team.id} className="nxt5-account-deletion-team">
            <SelectInput label={`Nouveau propriétaire de ${team.name}`} value={teamPlan[team.id] || ""} required disabled={busy} onChange={(value) => setTeamPlan((plan) => ({ ...plan, [team.id]: value }))}>
              <option value="">Choisir un membre</option>
              {team.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </SelectInput>
            <p className="mt-2 text-xs leading-5 text-slate-400">Ce membre devient propriétaire et capitaine. L’équipe et ses données restent intactes.</p>
          </div>)}
          {emptyTeams.length > 0 && <Checkbox danger checked={deleteEmptyTeams} disabled={busy} onChange={setDeleteEmptyTeams}>
            Je confirme aussi la suppression définitive de mes équipes sans autre membre et de toutes leurs données : {emptyTeams.map((team) => team.name).join(", ")}.
          </Checkbox>}
          <Checkbox checked={acknowledged} disabled={busy} onChange={setAcknowledged}>J’ai compris les conséquences et je souhaite poursuivre.</Checkbox>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="ghost" disabled={busy} onClick={reset}>Annuler</Button>
            <Button type="submit" variant="danger" icon={busy ? Loader2 : undefined} disabled={busy || !acknowledged || !planReady}>{busy ? "Préparation…" : "Confirmer et continuer"}</Button>
          </div>
        </form> : <form onSubmit={remove} className="mt-4 max-w-xl space-y-4">
          {!hasPassword && !verifiedWith && !uncertain ? <div className="space-y-3">
            <p className="text-sm leading-6 text-slate-300">Ton compte n’a pas de mot de passe NXT5. Reconnecte-toi avec un service associé pour confirmer que c’est bien toi. Tu reviendras ensuite sur cette page.</p>
            {providers.length ? <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {providers.map((provider) => <Button key={provider} type="button" variant="ghost" icon={busy ? Loader2 : ShieldCheck} disabled={busy} onClick={() => reauthenticate(provider)}>{`Confirmer avec ${PROVIDER_LABELS[provider] || provider}`}</Button>)}
            </div> : <p className="text-sm leading-6 text-amber-100">Aucun service associé n’est disponible. Crée d’abord un mot de passe NXT5 dans la section Sécurité, ou écris-nous depuis la page Contact.</p>}
          </div> : <>
            {!hasPassword && verifiedWith && <p className="flex items-center gap-2 text-sm font-semibold text-emerald-100"><Check aria-hidden="true" className="h-4 w-4 shrink-0" />Identité confirmée avec {PROVIDER_LABELS[verifiedWith] || verifiedWith}.</p>}
            <p className="text-sm leading-6 text-slate-300">Dernière étape : saisis exactement SUPPRIMER{hasPassword ? " et ton mot de passe actuel" : ""}. La confirmation expire après 15 minutes.</p>
            <TextInput label="Saisis SUPPRIMER" value={confirmation} onChange={setConfirmation} required disabled={busy} autoComplete="off" spellCheck={false} maxLength={9} />
            {hasPassword && <TextInput label="Mot de passe actuel" type="password" value={password} onChange={setPassword} required disabled={busy} autoComplete="current-password" maxLength={128} />}
          </>}
          {uncertain && <Button type="button" variant="ghost" icon={busy ? Loader2 : undefined} disabled={busy} onClick={checkStatus} className="w-full">Vérifier le résultat de la suppression</Button>}
          <div className="flex flex-col gap-3 sm:flex-row">
            {!uncertain && <Button type="button" variant="ghost" disabled={busy} onClick={reset}>Annuler</Button>}
            {(hasPassword || verifiedWith || uncertain) && <Button type="submit" variant="danger" icon={busy ? Loader2 : Trash2} disabled={busy || !finalReady}>{busy ? "Suppression en cours…" : "Supprimer définitivement mon compte"}</Button>}
          </div>
        </form>}
      </div>}
    </Surface>
  </section>;
}

export function AccountDeletionReceipt({ receipt, onContinue }) {
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const completedAt = new Date(receipt.completedAt);
  return <main className="nxt5-account-deletion-receipt">
    <Surface glow className="p-5 sm:p-8">
      <div role="status">
        <Check aria-hidden="true" className="h-8 w-8 text-emerald-300" />
        <h1 ref={heading} tabIndex={-1} className="mt-4 text-2xl font-semibold text-white outline-none">Ton compte a été supprimé</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">Ton accès est désactivé, toutes tes sessions sont fermées et les données directement liées à ton compte ont été supprimées ou anonymisées.</p>
        <p className="mt-3 text-sm leading-6 text-slate-300">Les parties et contenus partagés des équipes conservées restent disponibles, sans ton nom d’auteur. Des mentions de ton pseudo peuvent subsister dans les fichiers de match importés et les textes de l’équipe : tu peux en demander l’examen depuis la page Contact.</p>
        <p className="mt-4 break-all text-sm text-cyan-100">Référence : {receipt.reference}</p>
        {!Number.isNaN(completedAt.getTime()) && <p className="mt-2 text-sm text-slate-400">{completedAt.toLocaleString("fr-FR")}</p>}
      </div>
      <Button type="button" variant="ghost" onClick={onContinue} className="mt-6 w-full sm:w-auto">Retour à la connexion</Button>
    </Surface>
  </main>;
}
