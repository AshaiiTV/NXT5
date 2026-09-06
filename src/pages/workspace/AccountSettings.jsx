import { useEffect, useState } from "react";
import { AlertTriangle, Check, Gauge, Loader2, Lock, Mail, Settings, Shield, ShieldCheck, UserPlus } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { configurePerformanceMode, currentPerformanceMode, setStoredPerformanceMode } from "../../app/performance.js";
import { Badge, Button, PageHeader, PremiumToggle, Surface, TextInput } from "../../components/ui/Core.jsx";
import { cx, preciseErrorText } from "../../app/helpers.js";
import { lazyNamed, loadNextPhase } from "./workspace-shared.jsx";

const TeamDataHealthPanel = lazyNamed(loadNextPhase, "TeamDataHealthPanel");

function AccountSettings({ user, onUserUpdate, pushToast, currentTeam, data = {} }) {
  const [profileForm, setProfileForm] = useState({ name: user?.name || user?.account_name || "", email: user?.email || "" });
  const [emailPassword, setEmailPassword] = useState("");
  const emailChanging = profileForm.email.trim().toLowerCase() !== String(user?.email || "").trim().toLowerCase();
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", nextPassword: "", confirmPassword: "" });
  const [notificationForm, setNotificationForm] = useState({ notif_match: user?.notif_match !== false, notif_report: user?.notif_report !== false, notif_inactivity: user?.notif_inactivity !== false });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [resendingVerify, setResendingVerify] = useState(false);
  const [visualMode, setVisualMode] = useState(currentPerformanceMode);

  useEffect(() => {
    setProfileForm({ name: user?.name || user?.account_name || "", email: user?.email || "" });
  }, [user?.id, user?.name, user?.email, user?.account_name]);

  useEffect(() => {
    setNotificationForm({ notif_match: user?.notif_match !== false, notif_report: user?.notif_report !== false, notif_inactivity: user?.notif_inactivity !== false });
  }, [user?.id, user?.notif_match, user?.notif_report, user?.notif_inactivity]);

  async function saveProfile(event) {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const result = await apiFetch("auth-update-profile", { method: "POST", body: JSON.stringify({ ...profileForm, ...(emailChanging ? { currentPassword: emailPassword } : {}) }) });
      setEmailPassword("");
      onUserUpdate?.(result.user);
      pushToast?.({ type: "green", title: "Compte mis à jour", text: "Ton pseudo et ton e-mail sont enregistrés." });
    } catch (err) {
      pushToast?.({ type: "red", title: "Mise à jour impossible", text: err.message });
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    if (passwordForm.nextPassword !== passwordForm.confirmPassword) {
      pushToast?.({ type: "red", title: "Confirmation incorrecte", text: "Les deux nouveaux mots de passe ne correspondent pas." });
      return;
    }
    setSavingPassword(true);
    try {
      await apiFetch("auth-change-password", { method: "POST", body: JSON.stringify({ currentPassword: passwordForm.currentPassword, nextPassword: passwordForm.nextPassword }) });
      setPasswordForm({ currentPassword: "", nextPassword: "", confirmPassword: "" });
      pushToast?.({ type: "green", title: "Mot de passe changé", text: "Ton compte NXT5 est à jour." });
    } catch (err) {
      pushToast?.({ type: "red", title: "Changement impossible", text: err.message });
    } finally {
      setSavingPassword(false);
    }
  }

  async function resendVerificationEmail() {
    setResendingVerify(true);
    try {
      const result = await apiFetch("resend-verify-email", { method: "POST" });
      onUserUpdate?.(result.user);
      pushToast?.({ type: "green", title: "E-mail envoyé", text: "Un nouveau lien de vérification vient d’être envoyé." });
    } catch (err) {
      pushToast?.({ type: "red", title: "Envoi impossible", text: preciseErrorText(err, "email-verification") });
    } finally {
      setResendingVerify(false);
    }
  }

  async function updateNotifications(next) {
    const previous = notificationForm;
    setNotificationForm(next);
    setSavingNotifications(true);
    try {
      const result = await apiFetch("/api/user/notifications", { method: "PATCH", body: JSON.stringify(next) });
      onUserUpdate?.(result.user);
      pushToast?.({ type: "green", title: "Préférences enregistrées", text: "Tes notifications e-mail sont à jour." });
    } catch (err) {
      setNotificationForm(previous);
      pushToast?.({ type: "red", title: "Préférences non enregistrées", text: err.message });
    } finally {
      setSavingNotifications(false);
    }
  }

  function updateVisualMode(mode) {
    setStoredPerformanceMode(mode);
    setVisualMode(mode);
    configurePerformanceMode();
    pushToast?.({
      type: "green",
      title: mode === "low" ? "Mode Low cost active" : "Visuels OK actifs",
      text: mode === "low" ? "Les effets lourds sont reduits sur cet appareil." : "Le rendu complet est force sur cet appareil.",
    });
  }

  return <div className="nxt5-data-dense min-w-0">
    <PageHeader eyebrow="Compte" title="Paramètres" subtitle="Modifie ton pseudo, ton e-mail de récupération et ton mot de passe NXT5." />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,.95fr)_minmax(0,1.05fr)]">
      <Surface glow className="p-5">
        <div className="flex items-start justify-between gap-3"><div><Badge tone="cyan">Identité</Badge><h3 className="mt-3 text-2xl font-black text-white">Pseudo et e-mail</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-300">Ces informations servent à te reconnaître dans NXT5 et à récupérer ton compte.</p></div><Settings className="h-5 w-5 shrink-0 text-cyan-100" /></div>
        {user?.email && (user?.email_verified ? <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-100"><Check className="h-4 w-4" />Email vérifié</div> : <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="flex items-center gap-2 text-sm font-black text-amber-100"><AlertTriangle className="h-4 w-4 shrink-0" />Ton email n'est pas vérifié.</p><p className="mt-1 text-xs font-semibold leading-5 text-amber-50/80">Les notifications sont désactivées jusqu'à validation de ton adresse.</p></div><Button type="button" variant="ghost" icon={resendingVerify ? Loader2 : Mail} onClick={resendVerificationEmail} disabled={resendingVerify}>{resendingVerify ? "Envoi..." : "Renvoyer l'email de vérification"}</Button></div></div>)}
        <form onSubmit={saveProfile} className="mt-5 space-y-4">
          <TextInput label="Pseudo" value={profileForm.name} onChange={(name) => setProfileForm((current) => ({ ...current, name }))} placeholder="Ton pseudo NXT5" required icon={UserPlus} />
          <TextInput label="E-mail" value={profileForm.email} onChange={(email) => setProfileForm((current) => ({ ...current, email }))} placeholder="joueur@exemple.com" type="email" required icon={Mail} />
          {emailChanging && <TextInput label="Mot de passe actuel pour modifier l’e-mail" value={emailPassword} onChange={setEmailPassword} type="password" required icon={Lock} />}
          <Button type="submit" icon={savingProfile ? Loader2 : Check} disabled={savingProfile || !profileForm.name.trim() || !profileForm.email.trim() || (emailChanging && !emailPassword)}>{savingProfile ? "Enregistrement..." : "Enregistrer le compte"}</Button>
        </form>
      </Surface>

      <Surface className="p-5">
        <div className="flex items-start justify-between gap-3"><div><Badge tone="yellow">Sécurité</Badge><h3 className="mt-3 text-2xl font-black text-white">Mot de passe</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-300">Choisis un mot de passe différent de l’actuel, avec au moins 8 caractères.</p></div><Shield className="h-5 w-5 shrink-0 text-amber-100" /></div>
        <form onSubmit={savePassword} className="mt-5 space-y-4">
          <TextInput label="Mot de passe actuel" value={passwordForm.currentPassword} onChange={(currentPassword) => setPasswordForm((current) => ({ ...current, currentPassword }))} placeholder="••••••••" type="password" required icon={Lock} />
          <TextInput label="Nouveau mot de passe" value={passwordForm.nextPassword} onChange={(nextPassword) => setPasswordForm((current) => ({ ...current, nextPassword }))} placeholder="8 caractères minimum" type="password" required icon={Shield} />
          <TextInput label="Confirmer" value={passwordForm.confirmPassword} onChange={(confirmPassword) => setPasswordForm((current) => ({ ...current, confirmPassword }))} placeholder="Répète le nouveau mot de passe" type="password" required icon={Check} />
          <Button type="submit" icon={savingPassword ? Loader2 : ShieldCheck} disabled={savingPassword || !passwordForm.currentPassword || !passwordForm.nextPassword || !passwordForm.confirmPassword}>{savingPassword ? "Mise à jour..." : "Changer le mot de passe"}</Button>
        </form>
      </Surface>

      <Surface className="p-5 xl:col-span-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Badge tone="cyan">Options</Badge>
            <h3 className="mt-3 text-2xl font-black text-white">Mode visuel</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">Choisis le rendu de cet appareil selon la fluidite du navigateur.</p>
          </div>
          <Gauge className="h-5 w-5 shrink-0 text-cyan-100" />
        </div>
        <div className="mt-5 grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-1 sm:grid-cols-2">
          {[
            ["full", "Visuels OK", "Effets complets"],
            ["low", "Mode Low cost", "Plus fluide sans GPU"],
          ].map(([id, label, detail]) => {
            const active = visualMode === id;
            return <button key={id} type="button" onClick={() => updateVisualMode(id)} className={cx("rounded-xl border px-4 py-3 text-left transition", active ? "border-cyan-200/45 bg-cyan-300 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,.22)]" : "border-transparent text-slate-300 hover:bg-white/[0.055] hover:text-white")}><span className="block text-sm font-black">{label}</span><span className={cx("mt-1 block text-xs font-bold", active ? "text-slate-800" : "text-slate-400")}>{detail}</span></button>;
          })}
        </div>
      </Surface>

      {currentTeam && <div className="xl:col-span-2">
        <TeamDataHealthPanel team={currentTeam} players={data.players || []} matches={data.matches || []} />
      </div>}

      <Surface className="p-5 xl:col-span-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Badge tone="purple">Notifications</Badge>
            <h3 className="mt-3 text-2xl font-black text-white">E-mails NXT5</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">Choisis les alertes envoyées sur ton adresse vérifiée.</p>
          </div>
          {savingNotifications && <Badge tone="cyan">Enregistrement...</Badge>}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <PremiumToggle checked={notificationForm.notif_match} onChange={(checked) => updateNotifications({ ...notificationForm, notif_match: checked })} title="Recevoir un email à chaque import de match" text="Pratique pour suivre les nouvelles games ajoutées à ta team." />
          <PremiumToggle checked={notificationForm.notif_report} onChange={(checked) => updateNotifications({ ...notificationForm, notif_report: checked })} title="Recevoir un email a chaque review generee" text="Tu es prevenu des qu'une nouvelle review d'equipe est disponible." />
          <PremiumToggle checked={notificationForm.notif_inactivity} onChange={(checked) => updateNotifications({ ...notificationForm, notif_inactivity: checked })} title="Recevoir le rappel après 3 mois" text="Un seul e-mail par période d'inactivité, sans donnée d'équipe ou de jeu." />
        </div>
      </Surface>
    </div>
  </div>;
}

export { AccountSettings, TeamDataHealthPanel };
