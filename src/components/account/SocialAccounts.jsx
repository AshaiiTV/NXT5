import React, { useEffect, useRef, useState } from "react";
import { LEGAL_VERSION } from "../../../shared/legal.js";
import { Link2, Loader2, Lock, Mail, ShieldCheck, Unlink, UserPlus } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { isSafeInternalPath } from "../../app/routing.js";
import { writeRememberPreference } from "../../app/helpers.js";
import { Badge, Button, Surface, TextInput } from "../ui/Core.jsx";
import "./SocialAccounts.css";

const PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "discord", label: "Discord" },
  { id: "apple", label: "Apple" },
  { id: "riot", label: "Riot" },
];

function providerLabel(id) {
  return PROVIDERS.find((provider) => provider.id === id)?.label || "ce service";
}

export function socialReturnContext(search = window.location.search) {
  const params = new URLSearchParams(search);
  const next = params.get("next");
  return {
    ...(isSafeInternalPath(next) && !/[\\\u0000-\u001f\u007f]/.test(next) ? { next } : {}),
    ...(params.get("invite") ? { invite: params.get("invite") } : {}),
  };
}

export function socialCallbackStatus(search = window.location.search) {
  const params = new URLSearchParams(search);
  const status = params.get("social");
  return ["linked", "cancelled", "expired", "failed", "account_changed", "conflict", "existing_account"].includes(status) ? status : null;
}

function Feedback({ children, success = false }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, [children]);
  return <div ref={ref} tabIndex={-1} role={success ? "status" : "alert"} className={`rounded-xl border p-3 text-sm font-semibold leading-6 ${success ? "border-cyan-300/25 bg-cyan-400/10 text-cyan-100" : "border-rose-300/25 bg-rose-500/10 text-rose-100"}`}>{children}</div>;
}

export function SocialNotice({ status = socialCallbackStatus() }) {
  const provider = providerLabel(new URLSearchParams(window.location.search).get("provider"));
  const messages = {
    linked: `Ton compte ${provider} est associé à NXT5. Tu peux l’utiliser pour te connecter.`,
    cancelled: `La connexion avec ${provider} a été annulée. Tu peux réessayer.`,
    expired: "Cette demande a expiré. Recommence la connexion ou l’association.",
    failed: `La connexion avec ${provider} n’a pas abouti. Réessaie dans quelques instants.`,
    account_changed: "Ta session NXT5 a changé pendant l’association. Recommence depuis les paramètres du compte voulu.",
    conflict: `Ce compte ${provider} est déjà associé à un autre compte NXT5. Connecte-toi à celui-ci pour gérer l’association.`,
    existing_account: "Un compte NXT5 existe déjà avec cette adresse. Connecte-toi à ton compte existant, puis associe ce service dans Paramètres.",
  };
  return messages[status] ? <Feedback success={status === "linked"}>{messages[status]}</Feedback> : null;
}

function ProviderSignInButton({ provider, disabled, loading, onClick, linking = false }) {
  const branded = provider.id === "google" || provider.id === "apple";
  const label = `Continuer avec ${provider.label}`;
  if (!branded) return <Button type="button" variant="ghost" disabled={disabled} onClick={onClick} icon={loading ? Loader2 : undefined} className="w-full min-h-[52px]" aria-label={linking ? `Associer ${provider.label}` : undefined}>{loading ? `Ouverture de ${provider.label}…` : linking ? "Associer" : label}</Button>;
  return <button type="button" className="nxt5-provider-button" data-provider={provider.id} disabled={disabled} aria-busy={loading || undefined} aria-label={linking ? `${label} pour associer ce compte` : undefined} onClick={onClick}>
    <img className="nxt5-provider-logo" src={provider.id === "google" ? "/assets/auth/google-g.svg" : "/assets/auth/apple-signin-black.svg"} alt="" aria-hidden="true" width={provider.id === "google" ? 20 : 31} height={provider.id === "google" ? 20 : 44} />
    <span className="nxt5-provider-label">{label}</span>
    <span className="nxt5-provider-progress" aria-hidden="true">{loading && <Loader2 className="h-4 w-4 animate-spin" />}</span>
  </button>;
}

async function startSocialFlow(provider, flow, rememberMe = false) {
  const result = await apiFetch("auth-social-start", {
    method: "POST",
    body: JSON.stringify({ provider, flow, rememberMe, ...(flow === "link" ? {} : socialReturnContext()) }),
  });
  const destination = new URL(result?.authorizationUrl);
  if (destination.protocol !== "https:") throw new Error("Le service n’a pas fourni de lien de connexion valide.");
  if (flow !== "link") writeRememberPreference(rememberMe);
  window.location.assign(destination.href);
}

export function SocialLogin({ flow = "login", rememberMe = false, disabled = false }) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const inFlight = useRef(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    apiFetch("auth-social-status").then((result) => {
      if (active) setProviders(PROVIDERS.filter((provider) => result?.providers?.some((entry) => entry.id === provider.id && entry.enabled === true)));
    }).catch(() => { if (active) setError("Les autres méthodes de connexion ne sont pas disponibles pour le moment."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  async function start(provider) {
    if (inFlight.current || disabled) return;
    inFlight.current = true;
    setBusy(provider);
    setError("");
    try { await startSocialFlow(provider, flow, rememberMe); }
    catch (err) { setError(err.message || "La connexion n’a pas pu démarrer."); setBusy(""); inFlight.current = false; }
  }

  if (loading) return <p className="mt-4 text-center text-xs text-slate-300" role="status">Chargement des autres méthodes de connexion…</p>;
  if (!providers.length && !error) return null;
  return <section className="mt-5" aria-label="Autres méthodes de connexion">
    {!!providers.length && <><div className="flex flex-col gap-2">
      {providers.map((provider) => <ProviderSignInButton key={provider.id} provider={provider} disabled={disabled || Boolean(busy)} loading={busy === provider.id} onClick={() => start(provider.id)} />)}
    </div><p className="mt-5 border-t border-white/10 pt-5 text-center text-sm font-semibold text-slate-300">Ou avec ton e-mail</p></>}
    {busy && <p className="mt-3 text-center text-sm text-slate-300" role="status">Ouverture de {providerLabel(busy)}…</p>}
    {error && <div className="mt-3 space-y-2"><Feedback>{error}</Feedback>{!providers.length && <Button type="button" variant="ghost" onClick={() => setAttempt((value) => value + 1)}>Réessayer</Button>}</div>}
  </section>;
}

export function SocialSignup({ onComplete, loginHref }) {
  const [pending, setPending] = useState(null);
  const [form, setForm] = useState({ email: "", displayName: "" });
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [collision, setCollision] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    let active = true;
    apiFetch("auth-social-pending").then((result) => {
      if (!active) return;
      if (!PROVIDERS.some((provider) => provider.id === result?.provider)) throw new Error("Cette inscription a expiré. Recommence avec le service de ton choix.");
      setPending(result);
      setForm({ email: result.email || "", displayName: result.name || "" });
    }).catch((err) => { if (active) setError(err.message || "Cette inscription a expiré. Recommence la connexion."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (inFlight.current || !pending) return;
    if (!legalAccepted) { setError("Accepte les conditions et le règlement pour créer ton compte."); return; }
    if (!form.displayName.trim() || !form.email.trim()) { setError("Renseigne ton pseudo et ton adresse e-mail."); return; }
    inFlight.current = true;
    setSaving(true);
    setError("");
    setCollision(false);
    try {
      const result = await apiFetch("auth-social-complete", { method: "POST", body: JSON.stringify({ displayName: form.displayName.trim(), email: form.email.trim(), acceptLegal: true, legalVersion: LEGAL_VERSION }) });
      if (!result?.user?.id) throw new Error("La création du compte n’a pas pu être confirmée. Réessaie.");
      onComplete(result.user, result.destination);
    } catch (err) {
      const existing = err?.code === "SOCIAL_EMAIL_EXISTS";
      setCollision(existing);
      setError(existing ? "Un compte NXT5 existe déjà avec cette adresse. Connecte-toi à ton compte existant, puis associe ce service dans Paramètres. Tes comptes ne sont pas fusionnés automatiquement." : err.message || "La création du compte n’a pas abouti.");
    } finally { setSaving(false); inFlight.current = false; }
  }

  if (loading) return <p className="mt-5 text-sm text-slate-300" role="status">Préparation de ton inscription…</p>;
  return <div className="mt-5 space-y-4">
    {pending && <><p className="flex items-start gap-2 text-sm leading-6 text-cyan-100"><ShieldCheck aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" /><span>Connexion avec {providerLabel(pending.provider)} confirmée. Choisis ton pseudo NXT5 pour terminer.</span></p>
      <form onSubmit={submit} className="nxt5-auth-form">
        <fieldset disabled={saving} className="min-w-0 space-y-4">
          <TextInput label="Pseudo" value={form.displayName} onChange={(displayName) => setForm((current) => ({ ...current, displayName }))} placeholder="Ex : Joueur NXT5" required icon={UserPlus} autoComplete="nickname" />
          <TextInput label="E-mail de récupération" value={form.email} onChange={(email) => setForm((current) => ({ ...current, email }))} placeholder="joueur@exemple.com" type="email" required icon={Mail} autoComplete="email" />
          {(!pending.emailVerified || form.email.trim().toLowerCase() !== pending.email?.toLowerCase()) && <p className="text-xs leading-5 text-slate-300">Nous t’enverrons un lien pour vérifier cette adresse et protéger la récupération de ton compte.</p>}
          <LegalConsent checked={legalAccepted} onChange={setLegalAccepted} />
          {error && <Feedback>{error}</Feedback>}
          {collision && <a href={loginHref} className="block text-sm font-black text-cyan-200 underline underline-offset-4">Me connecter à mon compte existant</a>}
          <Button type="submit" disabled={saving || !legalAccepted || !form.displayName.trim() || !form.email.trim()} icon={saving ? Loader2 : UserPlus} className="nxt5-auth-submit">{saving ? "Création…" : "Créer mon compte NXT5"}</Button>
        </fieldset>
      </form></>}
    {!pending && error && <Feedback>{error}</Feedback>}
    <a href={loginHref} className="block text-center text-sm font-black text-cyan-200 hover:text-white">Revenir à la connexion</a>
  </div>;
}

export function LegalConsent({ checked, onChange }) {
  return <label className="nxt5-auth-consent"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} required /><span>J’accepte les <a href="/conditions" target="_blank" rel="noopener noreferrer">conditions générales d’utilisation<span className="sr-only"> (nouvel onglet)</span></a>, le <a href="/reglement" target="_blank" rel="noopener noreferrer">règlement NXT5<span className="sr-only"> (nouvel onglet)</span></a> et reconnais avoir lu la <a href="/confidentialite" target="_blank" rel="noopener noreferrer">politique de confidentialité<span className="sr-only"> (nouvel onglet)</span></a> (version {LEGAL_VERSION}).</span></label>;
}

export function SocialAccounts({ onStatus }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState("");
  const [unlinkProvider, setUnlinkProvider] = useState("");
  const [password, setPassword] = useState("");
  const inFlight = useRef(false);
  const trigger = useRef(null);
  const restoreTriggerFocus = useRef(false);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  useEffect(() => {
    if (!unlinkProvider && restoreTriggerFocus.current) {
      restoreTriggerFocus.current = false;
      trigger.current?.focus();
    }
  }, [unlinkProvider]);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch("auth-social-status").then((result) => {
      if (active) { setStatus(result); setError(""); onStatusRef.current?.({ hasPassword: result.hasPassword === true }); }
    }).catch((err) => { if (active) { setError(err.message || "Impossible de charger les comptes associés."); onStatusRef.current?.({ hasPassword: null, error: true }); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  async function link(provider) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(provider);
    setError("");
    setSuccess("");
    try { await startSocialFlow(provider, "link"); }
    catch (err) { setError(err.message || "L’association n’a pas pu démarrer."); setBusy(""); inFlight.current = false; }
  }

  function cancelUnlink() {
    if (inFlight.current) return;
    restoreTriggerFocus.current = true;
    setUnlinkProvider("");
    setPassword("");
  }

  async function unlink(event) {
    event.preventDefault();
    if (inFlight.current || !password || !status?.hasPassword) return;
    inFlight.current = true;
    setBusy(unlinkProvider);
    setError("");
    setSuccess("");
    try {
      await apiFetch("auth-social-unlink", { method: "POST", body: JSON.stringify({ provider: unlinkProvider, currentPassword: password }) });
      setStatus((current) => ({ ...current, linked: current.linked.filter((entry) => entry.provider !== unlinkProvider) }));
      setSuccess(`Ton compte ${providerLabel(unlinkProvider)} est dissocié. Tu peux te connecter avec ton e-mail et ton mot de passe NXT5.`);
      setUnlinkProvider("");
      setPassword("");
    } catch (err) { setError(err.message || "La dissociation n’a pas abouti."); }
    finally { setBusy(""); inFlight.current = false; }
  }

  return <Surface className="nxt5-social-connections p-5 xl:col-span-2">
    <Badge tone="cyan">Connexions</Badge>
    <h3 className="mt-3 text-2xl font-black text-white">Connexions associées</h3>
    <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">Retrouve le même compte NXT5 avec Google, Discord, Apple ou Riot. Associe chaque service depuis cette page.</p>
    {socialCallbackStatus() && <div className="mt-4"><SocialNotice /></div>}
    {loading && <p className="mt-4 text-sm text-slate-300" role="status">Chargement des comptes associés…</p>}
    {error && <div className="mt-4"><Feedback>{error}</Feedback>{!status && <Button type="button" variant="ghost" className="mt-3" onClick={() => setAttempt((value) => value + 1)}>Réessayer</Button>}</div>}
    {success && <div className="mt-4"><Feedback success>{success}</Feedback></div>}
    {status && <div className="mt-5 divide-y divide-white/10">
      {PROVIDERS.map((provider) => {
        const available = status.providers?.some((entry) => entry.id === provider.id && entry.enabled === true);
        const linked = status.linked?.find((entry) => entry.provider === provider.id);
        return <div key={provider.id} className="py-4 first:pt-0 last:pb-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><p className="flex flex-wrap items-center gap-2 font-black text-white">{provider.label}{linked && <Badge tone="cyan">Associé</Badge>}</p>
              <p className="mt-1 break-words text-sm leading-6 text-slate-300">{linked ? linked.displayName || `Ton compte ${provider.label}` : available ? "Aucun compte associé" : "Connexion bientôt disponible"}</p>
              {linked && !available && <p className="mt-1 text-xs leading-5 text-slate-300">La connexion avec ce service est temporairement indisponible.</p>}
            </div>
            {linked ? <Button type="button" variant="ghost" icon={Unlink} disabled={Boolean(busy) || !status.hasPassword || unlinkProvider === provider.id} onClick={(event) => { trigger.current = event.currentTarget; setUnlinkProvider(provider.id); setPassword(""); setSuccess(""); setError(""); }} aria-label={`Dissocier ${provider.label}`}>Dissocier</Button>
              : available && (provider.id === "google" || provider.id === "apple") ? <div className="nxt5-provider-link-action"><ProviderSignInButton provider={provider} linking disabled={Boolean(busy) || Boolean(unlinkProvider)} loading={busy === provider.id} onClick={() => link(provider.id)} /></div> : <Button type="button" variant="ghost" icon={busy === provider.id ? Loader2 : Link2} disabled={!available || Boolean(busy) || Boolean(unlinkProvider)} onClick={() => link(provider.id)} aria-label={`Associer ${provider.label}`}>{busy === provider.id ? "Ouverture…" : available ? "Associer" : "Indisponible"}</Button>}
          </div>
          {unlinkProvider === provider.id && <form onSubmit={unlink} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); cancelUnlink(); } }} className="mt-4 space-y-3 border-l-2 border-cyan-300/25 pl-3">
            <p className="text-sm leading-6 text-slate-300">Après la dissociation de {provider.label}, ton e-mail et ton mot de passe NXT5 te permettront de te connecter.</p>
            <TextInput label="Mot de passe NXT5" value={password} onChange={setPassword} type="password" required autoFocus autoComplete="current-password" icon={Lock} disabled={Boolean(busy)} />
            <div className="flex flex-wrap gap-2"><Button type="submit" variant="danger" disabled={!password || Boolean(busy)} icon={busy ? Loader2 : Unlink}>{busy ? "Dissociation…" : `Dissocier ${provider.label}`}</Button><Button type="button" variant="ghost" onClick={cancelUnlink} disabled={Boolean(busy)}>Annuler</Button></div>
          </form>}
        </div>;
      })}
    </div>}
    {status && !status.hasPassword && <p className="mt-4 border-t border-white/10 pt-4 text-sm leading-6 text-slate-300">Crée d’abord un mot de passe NXT5 depuis la section Sécurité pour pouvoir dissocier un service ou modifier ton e-mail. Un lien sera envoyé à ton adresse.</p>}
  </Surface>;
}
