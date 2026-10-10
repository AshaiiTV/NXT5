import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Loader2, Lock, Mail, Settings, Shield, ShieldCheck, UserPlus } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { configurePerformanceMode, currentPerformanceMode, setStoredPerformanceMode } from "../../app/performance.js";
import { Badge, Button, PageHeader, PremiumToggle, Surface, TextInput } from "../../components/ui/Core.jsx";
import { cx, preciseErrorText } from "../../app/helpers.js";
import "./account-settings.css";
import AccountSubscription from "../../components/account/AccountSubscription.jsx";
import { SocialAccounts } from "../../components/account/SocialAccounts.jsx";

function AccountSettings({ user, onUserUpdate, pushToast }) {
  useLanguage();
  const [profileForm, setProfileForm] = useState({ name: user?.name || user?.account_name || "", email: user?.email || "" });
  const [emailPassword, setEmailPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(null);
  const [securityUnavailable, setSecurityUnavailable] = useState(false);
  const [passwordLinkSent, setPasswordLinkSent] = useState(false);
  const emailChanging = profileForm.email.trim().toLowerCase() !== String(user?.email || "").trim().toLowerCase();
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", nextPassword: "", confirmPassword: "" });
  const [notificationForm, setNotificationForm] = useState({ notif_match: user?.notif_match !== false, notif_report: user?.notif_report !== false, notif_inactivity: user?.notif_inactivity !== false });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const notificationRequest = useRef({ generation: 0, pending: false });
  useEffect(() => {
    const request = notificationRequest.current;
    request.pending = false;
    request.generation += 1;
    setSavingNotifications(false);
    return () => { request.generation += 1; request.pending = false; };
  }, [user?.id]);
  const [resendingVerify, setResendingVerify] = useState(false);
  const [visualMode, setVisualMode] = useState(currentPerformanceMode);

  useEffect(() => {
    setHasPassword(null);
    setSecurityUnavailable(false);
    setPasswordLinkSent(false);
  }, [user?.id]);

  useEffect(() => {
    setProfileForm({ name: user?.name || user?.account_name || "", email: user?.email || "" });
  }, [user?.id, user?.name, user?.email, user?.account_name]);

  useEffect(() => {
    setNotificationForm({ notif_match: user?.notif_match !== false, notif_report: user?.notif_report !== false, notif_inactivity: user?.notif_inactivity !== false });
  }, [user?.id, user?.notif_match, user?.notif_report, user?.notif_inactivity]);

  async function saveProfile(event) {
    event.preventDefault();
    if (emailChanging && hasPassword !== true) return;
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

  async function requestFirstPassword() {
    if (savingPassword) return;
    setSavingPassword(true);
    try {
      await apiFetch("auth-request-password-reset", { method: "POST", body: JSON.stringify({ email: user.email }) });
      setPasswordLinkSent(true);
      pushToast?.({ type: "green", title: "Lien demandé", text: "Consulte ta boîte e-mail pour définir ton mot de passe NXT5." });
    } catch (err) {
      pushToast?.({ type: "red", title: "Envoi impossible", text: err.message });
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

  async function updateNotifications(field, checked) {
    const request = notificationRequest.current;
    if (request.pending) return;
    request.pending = true;
    const generation = ++request.generation;
    const previous = notificationForm[field];
    const next = { ...notificationForm, [field]: checked };
    setNotificationForm(next);
    setSavingNotifications(true);
    try {
      const result = await apiFetch("/api/user/notifications", { method: "PATCH", body: JSON.stringify(next) });
      if (generation !== request.generation) return;
      onUserUpdate?.(result.user);
      pushToast?.({ type: "green", title: "Préférences enregistrées", text: "Tes notifications e-mail sont à jour." });
    } catch (err) {
      if (generation !== request.generation) return;
      setNotificationForm((current) => ({ ...current, [field]: previous }));
      pushToast?.({ type: "red", title: "Préférences non enregistrées", text: err.message });
    } finally {
      if (generation === request.generation) { request.pending = false; setSavingNotifications(false); }
    }
  }

  function updateVisualMode(mode) {
    setStoredPerformanceMode(mode);
    setVisualMode(mode);
    configurePerformanceMode();
    pushToast?.({
      type: "green",
      title: mode === "low" ? "Mode performance activé" : "Rendu complet activé",
      text: mode === "low" ? "Les effets lourds sont réduits sur cet appareil." : "Le rendu complet est activé sur cet appareil.",
    });
  }

  return <div className="nxt5-account-settings nxt5-data-dense min-w-0">
    <PageHeader eyebrow={t("Ton compte")} title={t("Paramètres")} subtitle={t("Gère tes informations, tes moyens de connexion et les e-mails que tu reçois.")} />
    <div className="nxt5-account-sections">
      <Surface className="p-5">
        <div className="flex items-start justify-between gap-3"><div><h3 className="text-xl font-semibold text-white">{t("Pseudo et e-mail")}</h3><p className="mt-2 text-sm font-normal leading-6 text-slate-300">{t("Ces informations servent à te reconnaître dans NXT5 et à récupérer ton compte.")}</p></div><Settings className="h-5 w-5 shrink-0 text-cyan-100" /></div>
        {user?.email && (user?.email_verified ? <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100"><Check className="h-4 w-4" />{t("E-mail vérifié")}</div> : <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="flex items-center gap-2 text-sm font-black text-amber-100"><AlertTriangle className="h-4 w-4 shrink-0" />{t("Ton e-mail n’est pas vérifié.")}</p><p className="mt-1 text-xs font-semibold leading-5 text-amber-50/80">{t("Les notifications sont désactivées jusqu'à validation de ton adresse.")}</p></div><Button type="button" variant="ghost" icon={resendingVerify ? Loader2 : Mail} onClick={resendVerificationEmail} disabled={resendingVerify}>{resendingVerify ? "Envoi..." : t("Renvoyer l'email de vérification")}</Button></div></div>)}
        <form onSubmit={saveProfile} className="mt-5 space-y-4">
          <TextInput label={t("Pseudo")} value={profileForm.name} onChange={(name) => setProfileForm((current) => ({ ...current, name }))} placeholder={t("Ton pseudo NXT5")} required icon={UserPlus} />
          <TextInput label="E-mail" value={profileForm.email} onChange={(email) => setProfileForm((current) => ({ ...current, email }))} placeholder="joueur@exemple.com" type="email" required icon={Mail} disabled={hasPassword !== true} />
          {hasPassword === false && <p className="text-xs leading-5 text-slate-300">{t("Crée un mot de passe NXT5 dans la section Sécurité avant de modifier ton e-mail.")}</p>}
          {emailChanging && <TextInput label={t("Mot de passe actuel pour modifier l’e-mail")} value={emailPassword} onChange={setEmailPassword} type="password" required icon={Lock} />}
          <Button type="submit" icon={savingProfile ? Loader2 : Check} disabled={savingProfile || !profileForm.name.trim() || !profileForm.email.trim() || (emailChanging && (!emailPassword || hasPassword !== true))}>{savingProfile ? "Enregistrement..." : t("Enregistrer le compte")}</Button>
        </form>
      </Surface>

      <Surface className="p-5">
        {hasPassword !== true && <div className="flex items-start justify-between gap-3"><div><h3 className="text-xl font-semibold text-white">{t("Sécurité du compte")}</h3><p className="mt-2 text-sm font-normal leading-6 text-slate-300">{hasPassword === false ? t("Ajoute un mot de passe pour te connecter aussi avec ton e-mail et gérer les informations sensibles de ton compte.") : t("Le mot de passe utilisé pour te connecter avec ton e-mail NXT5.")}</p></div><Shield className="h-5 w-5 shrink-0 text-violet-200" /></div>}
        {hasPassword === null ? <p className="mt-5 text-sm text-slate-300" role="status">{securityUnavailable ? t("Options de sécurité indisponibles. Réessaie depuis la section Connexions associées ci-dessous.") : t("Chargement des options de sécurité…")}</p> : hasPassword === false ? <div className="mt-5 space-y-4">
          <p className="text-sm leading-6 text-slate-300">{t("Le lien reçu par e-mail permet de définir ton mot de passe. Tu devras ensuite te reconnecter et associer à nouveau tes comptes externes.")}</p>
          {passwordLinkSent && <p className="text-sm leading-6 text-cyan-100" role="status">{t("La demande a été envoyée. Consulte ta boîte e-mail, y compris les indésirables.")}</p>}
          <Button type="button" onClick={requestFirstPassword} disabled={savingPassword || !user?.email} icon={savingPassword ? Loader2 : Mail}>{savingPassword ? t("Envoi…") : passwordLinkSent ? t("Renvoyer le lien") : t("Recevoir un lien pour créer mon mot de passe")}</Button>
        </div> : <details className="nxt5-account-disclosure">
          <summary><span>{t("Changer mon mot de passe")}</span><ChevronDown aria-hidden="true" size={18} /></summary>
          <form onSubmit={savePassword} className="mt-4 space-y-4">
          <p className="text-sm leading-6 text-slate-300">{t("Choisis un mot de passe différent de l’actuel, avec au moins 8 caractères.")}</p>
          <TextInput label={t("Mot de passe actuel")} value={passwordForm.currentPassword} onChange={(currentPassword) => setPasswordForm((current) => ({ ...current, currentPassword }))} placeholder="••••••••" type="password" required icon={Lock} />
          <TextInput label={t("Nouveau mot de passe")} value={passwordForm.nextPassword} onChange={(nextPassword) => setPasswordForm((current) => ({ ...current, nextPassword }))} placeholder={t("8 caractères minimum")} type="password" required icon={Shield} />
          <TextInput label={t("Confirmer le nouveau mot de passe")} value={passwordForm.confirmPassword} onChange={(confirmPassword) => setPasswordForm((current) => ({ ...current, confirmPassword }))} placeholder={t("Répète le nouveau mot de passe")} type="password" required icon={Check} />
          <Button type="submit" icon={savingPassword ? Loader2 : ShieldCheck} disabled={savingPassword || !passwordForm.currentPassword || !passwordForm.nextPassword || !passwordForm.confirmPassword}>{savingPassword ? t("Mise à jour...") : t("Changer le mot de passe")}</Button>
          </form>
        </details>}
      </Surface>

      <SocialAccounts key={user?.id} onStatus={(status) => { setHasPassword(status.hasPassword); setSecurityUnavailable(Boolean(status.error)); }} />

      <Surface className="p-5">
        <details className="nxt5-account-disclosure">
          <summary><span><span className="nxt5-account-disclosure-title">{t("Affichage sur cet appareil")}</span><span className="nxt5-account-disclosure-hint">{visualMode === "low" ? t("Mode performance activé") : t("Rendu complet activé")}</span></span><ChevronDown aria-hidden="true" size={18} /></summary>
          <p className="mt-3 text-sm leading-6 text-slate-300">{t("Si le site manque de fluidité, réduis les effets visuels. Ce choix s’applique uniquement à cet appareil.")}</p>
        <div className="nxt5-account-visual-options">
          {[
            ["full", "Rendu complet", "Tous les effets visuels"],
            ["low", "Mode performance", "Effets réduits pour plus de fluidité"],
          ].map(([id, label, detail]) => {
            const active = visualMode === id;
            return <button key={id} type="button" onClick={() => updateVisualMode(id)} aria-pressed={active} className={cx("nxt5-account-visual-option border px-4 py-3 text-left transition", active ? "border-cyan-200/40 bg-cyan-400/10 text-white" : "border-transparent text-slate-300 hover:bg-white/[0.055] hover:text-white")}><span className="block text-sm font-black">{t(label)}</span><span className={cx("mt-1 block text-xs font-normal", active ? "text-cyan-100" : "text-slate-400")}>{t(detail)}</span></button>;
          })}
        </div>
        </details>
      </Surface>

      <Surface className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-xl font-semibold text-white">{t("E-mails NXT5")}</h3>
            <p className="mt-2 text-sm font-normal leading-6 text-slate-300">{t("Choisis les alertes envoyées sur ton adresse vérifiée.")}</p>
          </div>
          {savingNotifications && <Badge tone="cyan">{t("Enregistrement...")}</Badge>}
        </div>
        <div className="nxt5-account-notifications">
          <PremiumToggle disabled={savingNotifications} checked={notificationForm.notif_match} onChange={(checked) => updateNotifications("notif_match", checked)} title={t("Nouvelle partie importée")} text={t("Un e-mail lorsqu’une partie est ajoutée à ton équipe.")} />
          <PremiumToggle disabled={savingNotifications} checked={notificationForm.notif_report} onChange={(checked) => updateNotifications("notif_report", checked)} title={t("Nouveau débrief disponible")} text={t("Un e-mail lorsqu’un débrief d’équipe est généré.")} />
          <PremiumToggle disabled={savingNotifications} checked={notificationForm.notif_inactivity} onChange={(checked) => updateNotifications("notif_inactivity", checked)} title={t("Recevoir le rappel après 3 mois")} text={t("Un seul e-mail par période d'inactivité, sans donnée d'équipe ou de jeu.")} />
        </div>
      </Surface>
    </div>
    <AccountSubscription key={user?.id} />
  </div>;
}

export { AccountSettings };
