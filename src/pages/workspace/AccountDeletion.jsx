import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, Trash2 } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { Button, SelectInput, Surface, TextInput } from "../../components/ui/Core.jsx";

const PENDING_KEY = "nxt5_account_deletion_pending";
function pendingToken() {
  try { return window.sessionStorage.getItem(PENDING_KEY) || ""; } catch { return ""; }
}

export function AccountDeletion({ onDeleted }) {
  const [token, setToken] = useState(pendingToken);
  const [step, setStep] = useState(() => pendingToken() ? 2 : 0);
  const [uncertain, setUncertain] = useState(() => Boolean(pendingToken()));
  const [teams, setTeams] = useState([]);
  const [teamPlan, setTeamPlan] = useState({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [deleteEmptyTeams, setDeleteEmptyTeams] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestPending = useRef(false);
  const heading = useRef(null);
  const section = useRef(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (step) heading.current?.focus();
    else if (previousStep.current) section.current?.querySelector("button")?.focus();
    previousStep.current = step;
  }, [step]);

  const emptyTeams = teams.filter((team) => !team.members.length);
  const planReady = teams.every((team) => !team.members.length ? deleteEmptyTeams : Boolean(teamPlan[team.id]));
  const post = (body) => apiFetch("auth-delete-account", { method: "POST", body: JSON.stringify(body), timeoutMs: 45000 });
  function reset() {
    if (requestPending.current || uncertain) return;
    setStep(0); setToken(""); setPassword(""); setConfirmation(""); setError("");
    setAcknowledged(false); setDeleteEmptyTeams(false); setTeamPlan({});
  }
  function complete(result) {
    if (!result?.ok || !result.receipt?.reference) throw new Error("Le résultat n'a pas pu être confirmé.");
    try { window.sessionStorage.removeItem(PENDING_KEY); } catch {}
    setPassword(""); setToken("");
    onDeleted?.(result.receipt);
  }
  async function perform(action) {
    if (requestPending.current) return;
    requestPending.current = true; setBusy(true); setError("");
    try { await action(); }
    catch (err) { setError(err.message || "Le service est temporairement indisponible."); }
    finally { requestPending.current = false; setBusy(false); }
  }
  async function open() {
    await perform(async () => {
      const result = await post({ action: "inspect" });
      setTeams(result.teams); setStep(1);
    });
  }
  async function prepare(event) {
    event.preventDefault();
    if (!acknowledged || !planReady) return;
    await perform(async () => {
      const plan = Object.fromEntries(teams.map((team) => [team.id, team.members.length ? teamPlan[team.id] : "delete"]));
      const result = await post({ action: "prepare", acknowledged, deleteEmptyTeams, teamPlan: plan });
      setToken(result.confirmationToken); setStep(2);
    });
  }
  async function remove(event) {
    event.preventDefault();
    if (confirmation !== "SUPPRIMER" || !password || !token) return;
    await perform(async () => {
      try { window.sessionStorage.setItem(PENDING_KEY, token); } catch {}
      try {
        complete(await post({ action: "delete", confirmationToken: token, currentPassword: password, confirmation, acknowledged: true }));
      } catch (err) {
        setPassword("");
        if (!err.status || err.status >= 500 || err.code === "ACCOUNT_DELETED") {
          setUncertain(true);
          try {
            const result = await post({ action: "status", confirmationToken: token });
            if (result?.ok) { complete(result); return; }
          } catch {}
          throw new Error("La réponse a été interrompue. La suppression peut avoir abouti : vérifie son résultat ci-dessous avant toute autre action.");
        }
        try { window.sessionStorage.removeItem(PENDING_KEY); } catch {}
        if (["DELETION_CONFIRMATION_EXPIRED", "DELETION_TEAM_CHANGED", "ACCOUNT_CHANGED"].includes(err.code)) {
          setStep(0); setToken(""); setConfirmation(""); setAcknowledged(false);
          setTeamPlan({}); setDeleteEmptyTeams(false);
        }
        throw err;
      }
    });
  }
  async function checkStatus() {
    await perform(async () => {
      const result = await post({ action: "status", confirmationToken: token });
      if (result?.ok) { complete(result); return; }
      setError("Aucune suppression confirmée pour le moment. Tu peux vérifier à nouveau, ou ressaisir ton mot de passe et renvoyer la même confirmation sans doubler l'opération.");
    });
  }

  return <section ref={section} aria-label="Suppression du compte">
    <Surface className="border-rose-300/25 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-rose-200" />
        <div className="min-w-0">
          <h3 className="text-lg font-black text-white">Supprimer mon compte</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">Cette action est définitive. Deux confirmations sont nécessaires et ton mot de passe sera demandé.</p>
        </div>
      </div>
      {error && <p role="alert" className="mt-4 break-words rounded-xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm leading-6 text-rose-100">{error}</p>}
      {step === 0 && <Button type="button" variant="danger" icon={busy ? Loader2 : Trash2} disabled={busy} onClick={open} className="mt-5 w-full sm:w-auto">Supprimer mon compte</Button>}
      {step > 0 && <div className="mt-5 border-t border-white/10 pt-5" aria-busy={busy}>
        <h4 ref={heading} tabIndex={-1} className="font-black text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">{step === 1 ? "Confirmation 1 sur 2 : les conséquences" : "Confirmation 2 sur 2 : suppression définitive"}</h4>
        {step === 1 ? <form onSubmit={prepare} className="mt-4 space-y-4">
          <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
            <li>Ton accès sera désactivé, ton profil de compte anonymisé et toutes tes sessions fermées.</li>
            <li>Tes profils joueur liés, pools de champions, disponibilités, objectifs et notes de coaching seront supprimés.</li>
            <li>Les historiques de match et contenus partagés des équipes conservées restent disponibles. Des mentions de ton pseudo peuvent subsister dans les imports et les textes partagés.</li>
            <li>Une preuve datée de la suppression sera conservée, sans ton nom ni ton e-mail.</li>
          </ul>
          {teams.filter((team) => team.members.length).map((team) => <div key={team.id} className="rounded-xl border border-white/10 p-3">
            <SelectInput label={`Nouveau propriétaire : ${team.name}`} value={teamPlan[team.id] || ""} required disabled={busy} onChange={(value) => setTeamPlan((plan) => ({ ...plan, [team.id]: value }))}>
              <option value="">Choisir un membre</option>
              {team.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </SelectInput>
            <p className="mt-2 text-xs leading-5 text-slate-400">Ce membre deviendra propriétaire et capitaine lors de la suppression de ton compte.</p>
          </div>)}
          {emptyTeams.length > 0 && <label className="flex min-h-11 items-start gap-3 rounded-xl border border-rose-300/25 p-3 text-sm leading-6 text-rose-100">
            <input type="checkbox" checked={deleteEmptyTeams} disabled={busy} onChange={(event) => setDeleteEmptyTeams(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-rose-400" />
            <span>Je confirme aussi la suppression définitive de mes équipes sans autre membre et de toutes leurs données : {emptyTeams.map((team) => team.name).join(", ")}.</span>
          </label>}
          <label className="flex min-h-11 items-start gap-3 text-sm leading-6 text-slate-200">
            <input type="checkbox" checked={acknowledged} disabled={busy} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-cyan-300" />
            <span>J'ai compris les conséquences et je souhaite poursuivre.</span>
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="ghost" disabled={busy} onClick={reset}>Annuler</Button>
            <Button type="submit" variant="danger" icon={busy ? Loader2 : undefined} disabled={busy || !acknowledged || !planReady}>Confirmer et continuer</Button>
          </div>
        </form> : <form onSubmit={remove} className="mt-4 max-w-xl space-y-4">
          <p className="text-sm leading-6 text-slate-300">Dernière étape : saisis exactement SUPPRIMER et ton mot de passe actuel. La confirmation expire après dix minutes.</p>
          <TextInput label="Saisis SUPPRIMER" value={confirmation} onChange={setConfirmation} required disabled={busy} autoComplete="off" spellCheck={false} maxLength={9} />
          <TextInput label="Mot de passe actuel pour supprimer le compte" type="password" value={password} onChange={setPassword} required disabled={busy} autoComplete="current-password" maxLength={128} />
          {uncertain && <Button type="button" variant="ghost" disabled={busy} onClick={checkStatus} className="w-full">Vérifier le résultat de la suppression</Button>}
          <div className="flex flex-col gap-3 sm:flex-row">
            {!uncertain && <Button type="button" variant="ghost" disabled={busy} onClick={reset}>Annuler</Button>}
            <Button type="submit" variant="danger" icon={busy ? Loader2 : Trash2} disabled={busy || confirmation !== "SUPPRIMER" || !password}>{busy ? "Traitement en cours…" : "Supprimer définitivement mon compte"}</Button>
          </div>
        </form>}
      </div>}
    </Surface>
  </section>;
}

export function AccountDeletionReceipt({ receipt, onContinue }) {
  return <main className="relative mx-auto min-h-screen w-full max-w-2xl px-3 py-10 text-white sm:px-6 sm:py-20">
    <Surface glow className="p-5 sm:p-8">
      <div role="status">
        <Check aria-hidden="true" className="h-8 w-8 text-emerald-300" />
        <h1 className="mt-4 text-2xl font-black">Ton compte a été supprimé</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">Ton accès est désactivé, ton profil anonymisé et tes données personnelles directement liées ont été purgées. Toutes tes sessions sont fermées.</p>
        <p className="mt-3 text-sm leading-6 text-slate-300">Les historiques et contenus partagés des équipes conservées restent disponibles et peuvent contenir des mentions de ton pseudo.</p>
        <p className="mt-4 break-all text-sm text-cyan-100">Référence : {receipt.reference}</p>
        <p className="mt-2 text-sm text-slate-400">{new Date(receipt.completedAt).toLocaleString("fr-FR")}</p>
      </div>
      <Button type="button" variant="ghost" onClick={onContinue} className="mt-6 w-full sm:w-auto">Retour à la connexion</Button>
    </Surface>
  </main>;
}
