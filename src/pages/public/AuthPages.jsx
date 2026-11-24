// Sign-in, registration, password recovery and 404 pages: rendered directly by
// the router (no lazy boundary) because they answer private-route redirects.
import AuthGlassScene from "./AuthGlassScene.jsx";
import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Loader2, Lock, Mail, Shield, UserPlus } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { trackAudienceEvent } from "../../app/audience-client.js";
import { readRememberPreference, writeRememberPreference } from "../../app/helpers.js";
import { isSafeInternalPath } from "../../app/routing.js";
import { RoleIcon } from "../../components/brand/BrandAssets.jsx";
import { AmbientBackground } from "../../components/layout/AppChrome.jsx";
import { Badge, Button, PremiumToggle, Surface, TextInput } from "../../components/ui/Core.jsx";
import { LegalConsent, SocialLogin, SocialNotice, SocialSignup, socialCallbackStatus, socialReturnContext } from "../../components/account/SocialAccounts.jsx";
import "./public-information.css";
import "./public-entry.css";
import "./auth-scene.css";
import { LEGAL_VERSION } from "../../../shared/legal.js";
import { LegalLinks, LinkButton, PublicTextLink, SiteHeader } from "./PublicChrome.jsx";
import { preloadPrivateApp } from "../../app/private-app.js";

function TeamRoleSignature() {
  return <div className="nxt5-entry-role-signature" aria-hidden="true">{["TOP", "JGL", "MID", "ADC", "SUP"].map((role) => <span key={role}><RoleIcon role={role} className="h-7 w-7" /><span>{role}</span></span>)}</div>;
}
export function NotFoundPage({ navigate }) {
  useLanguage();
  return (
    <div className="nxt5-entry-page nxt5-auth-page">
      <AmbientBackground />
      <SiteHeader navigate={navigate}>
        <LinkButton href="/connexion" navigate={navigate} variant="ghost" className="hidden md:inline-flex">{t("Se connecter")}</LinkButton>
        <LinkButton href="/creer-un-compte" navigate={navigate}>{t("Créer un compte")}</LinkButton>
      </SiteHeader>
      <main className="nxt5-entry-main nxt5-recovery-main">
        <Surface variant="reading" glow className="nxt5-auth-card">
          <Badge tone="red">404</Badge>
          <h1>{t("Page introuvable")}</h1>
          <p className="nxt5-auth-intro">{t("Cette page n’existe pas. Retourne à l’accueil ou connecte-toi.")}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <LinkButton href="/" navigate={navigate} variant="ghost">{t("Retour accueil")}</LinkButton>
            <LinkButton href="/connexion" navigate={navigate} icon={Lock}>{t("Se connecter")}</LinkButton>
          </div>
        </Surface>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}

export function ForgotPasswordPage({ navigate }) {
  useLanguage();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submittingRef = useRef(false);
  const context = new URLSearchParams(socialReturnContext());
  const loginHref = `/connexion${context.size ? `?${context.toString()}` : ""}`;

  async function submit(event) {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setMessage("");
    setError("");
    try {
      await apiFetch("auth-request-password-reset", { method: "POST", body: JSON.stringify({ email }) });
      setMessage("Si cet e-mail correspond à un compte NXT5, un lien de réinitialisation vient d’être envoyé. Il expire dans 30 minutes.");
      setEmail("");
    } catch (err) {
      if (err?.code === "EMAIL_NOT_CONFIGURED") {
        setError("L’envoi d’e-mail est momentanément indisponible. Réessaie plus tard ou contacte l’équipe NXT5.");
      } else {
        setError(err.message || "Demande impossible.");
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="nxt5-entry-page nxt5-auth-page">
      <AmbientBackground />
      <SiteHeader navigate={navigate} simple>
        <PublicTextLink href={loginHref} navigate={navigate} className="nxt5-entry-header-link">{t("Retour à la connexion")}</PublicTextLink>
      </SiteHeader>
      <main className="nxt5-entry-main nxt5-recovery-main">
        <Surface variant="reading" glow className="nxt5-auth-card">
          <p className="nxt5-entry-eyebrow">{t("Récupération du compte")}</p>
          <h1>{t("Mot de passe oublié ?")}</h1>
          <p className="nxt5-auth-intro">{t("Entre ton e-mail pour recevoir un lien de réinitialisation.")}</p>
          <form onSubmit={submit} className="nxt5-auth-form" aria-busy={loading}>
            <TextInput label={t("E-mail du compte")} name="email" value={email} onChange={setEmail} placeholder="joueur@exemple.com" type="email" autoComplete="email" required icon={Mail} />
            {message && <div role="status" className="nxt5-auth-notice is-success">{t(message)}</div>}
            {error && <div role="alert" className="nxt5-auth-notice is-error">{t(error)}</div>}
            <Button type="submit" disabled={loading || !email.trim()} icon={loading ? Loader2 : Mail} className="nxt5-auth-submit">{loading ? t("Envoi…") : t("Envoyer le lien")}</Button>
          </form>
          <p className="nxt5-auth-alternative"><PublicTextLink href={loginHref} navigate={navigate}>{t("Retour à la connexion")}</PublicTextLink></p>
        </Surface>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}

export function ResetPasswordPage({ navigate, onAuth }) {
  useLanguage();
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [form, setForm] = useState({ nextPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  async function submit(event) {
    event.preventDefault();
    if (submittingRef.current) return;
    setError("");
    if (form.nextPassword !== form.confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    try {
      await apiFetch("auth-reset-password", { method: "POST", body: JSON.stringify({ token, nextPassword: form.nextPassword }) });
      onAuth?.(null);
      setDone(true);
      setForm({ nextPassword: "", confirmPassword: "" });
    } catch (err) {
      setError(err.message || "Réinitialisation impossible.");
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="nxt5-entry-page nxt5-auth-page">
      <AmbientBackground />
      <SiteHeader navigate={navigate}>
        <LinkButton href="/connexion" navigate={navigate} variant="ghost" className="hidden md:inline-flex">{t("Se connecter")}</LinkButton>
      </SiteHeader>
      <main className="nxt5-entry-main nxt5-recovery-main">
        <Surface variant="reading" glow className="nxt5-auth-card">
          <Badge tone="purple">{t("Nouveau mot de passe")}</Badge>
          <h1>{t("Réinitialiser le mot de passe")}</h1>
          {!token ? (<div className="mt-6 space-y-4"><p role="alert" className="nxt5-auth-notice is-error">{t("Ce lien de réinitialisation est incomplet. Demande un nouveau lien pour retrouver l’accès à ton compte.")}</p><LinkButton href="/mot-de-passe-oublie" navigate={navigate}>{t("Demander un nouveau lien")}</LinkButton></div>) : done ? (<div className="mt-6 space-y-4">
              <div role="status" className="nxt5-auth-notice is-success">{t("Mot de passe mis à jour. Connecte-toi avec ton e-mail et ce mot de passe, puis associe à nouveau tes comptes externes dans Paramètres.")}</div>
              <LinkButton href="/connexion" navigate={navigate} icon={Lock}>{t("Se connecter")}</LinkButton>
            </div>) : (<form onSubmit={submit} className="nxt5-auth-form" aria-busy={loading}>
              <p className="text-sm leading-6 text-slate-300">{t("La réinitialisation ferme tes sessions et dissocie tous tes comptes externes. Tu pourras les associer à nouveau après t’être connecté avec ton nouveau mot de passe.")}</p>
              <TextInput label={t("Nouveau mot de passe")} name="new-password" autoComplete="new-password" minLength={8} maxLength={128} value={form.nextPassword} onChange={(nextPassword) => setForm((current) => ({ ...current, nextPassword }))} placeholder={t("8 caractères minimum")} type="password" required icon={Shield} />
              <TextInput label={t("Confirmer")} name="confirm-password" autoComplete="new-password" minLength={8} maxLength={128} value={form.confirmPassword} onChange={(confirmPassword) => setForm((current) => ({ ...current, confirmPassword }))} placeholder={t("Répète le nouveau mot de passe")} type="password" required icon={Check} />
              {error && <div role="alert" className="nxt5-auth-notice is-error">{t(error)}</div>}
              <Button type="submit" disabled={loading || !form.nextPassword || !form.confirmPassword} icon={loading ?Loader2 : Shield} className="nxt5-auth-submit">{loading ? t("Mise à jour...") : t("Changer le mot de passe")}</Button>
            </form>)}
        </Surface>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}

export function AuthPage({ mode, onAuth, pushToast, navigate }) {
  useLanguage();
  const isRegister = mode === "register";
  const [form, setForm] = useState({ email: "", displayName: "", password: "" });
  const [rememberMe, setRememberMe] = useState(readRememberPreference);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registrationRequested, setRegistrationRequested] = useState(false);
  const registrationStatusRef = useRef(null);
  const submittingRef = useRef(false);
  useEffect(() => { if (registrationRequested) registrationStatusRef.current?.focus(); }, [registrationRequested]);
  useEffect(() => { setRegistrationRequested(false); }, [mode]);
  const socialStatus = socialCallbackStatus();
  const queryParams = new URLSearchParams(window.location.search);
  const isSocialComplete = isRegister && queryParams.get("social") === "complete";
  const returnContext = socialReturnContext();
  if (socialStatus === "existing_account") returnContext.next = "/parametres";
  const navigationParams = new URLSearchParams(returnContext);
  const querySuffix = navigationParams.size ? `?${navigationParams.toString()}` : "";

  function completeAuth(nextUser, serverDestination) {
    if (nextUser?.id && !nextUser.is_platform_admin) void trackAudienceEvent(isRegister ? "signup" : "login");
    writeRememberPreference(rememberMe);
    pushToast({ type: "green", title: isRegister ? "Compte créé" : "Connexion réussie", text: "Bienvenue sur NXT5." });
    const destination = isSafeInternalPath(serverDestination) && !/[\\\u0000-\u001f\u007f]/.test(serverDestination)
      ? serverDestination
      : returnContext.invite
        ? `/mon-equipe?invite=${encodeURIComponent(returnContext.invite)}`
        : returnContext.next || "/accueil";
    navigate(destination, { replace: true });
    onAuth(nextUser);
  }

  function patch(key, value) { setForm((current) => ({ ...current, [key]: value })); }

  async function submit(event) {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError("");
    // A successful sign-in renders the private shell: download it meanwhile.
    if (!isRegister) preloadPrivateApp().catch(() => {});
    try {
      const endpoint = isRegister ?"auth-register" : "auth-login";
      const body = { accountName: form.email, email: form.email, displayName: form.displayName, password: form.password, rememberMe, acceptLegal: isRegister ? legalAccepted : undefined, legalVersion: isRegister ? LEGAL_VERSION : undefined };
      const result = await apiFetch(endpoint, { method: "POST", body: JSON.stringify(body) });
      if (isRegister) {
        if (result?.ok !== true) throw new Error("La demande n’a pas pu être confirmée. Réessaie dans quelques instants.");
        writeRememberPreference(rememberMe);
        setForm((current) => ({ ...current, password: "" }));
        setRegistrationRequested(true);
      } else completeAuth(result.user);
    } catch (err) {
      if (err?.code === "DB_NOT_CONFIGURED") {
        setError("L’inscription est momentanément indisponible. Réessaie plus tard ou contacte l’équipe NXT5.");
      } else {
        setError(err.message || (isRegister ?"Inscription impossible." : "Connexion impossible."));
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="nxt5-entry-page nxt5-auth-page nxt5-social-auth nxt5-auth-immersive">
      <AmbientBackground />
      <SiteHeader navigate={navigate} simple>
        <PublicTextLink href={isRegister ? `/connexion${querySuffix}` : `/creer-un-compte${querySuffix}`} navigate={navigate} className="nxt5-entry-header-link">
          {isRegister ? t("J’ai déjà un compte") : t("Créer un compte")}
        </PublicTextLink>
      </SiteHeader>
      <main className="nxt5-entry-main nxt5-auth-layout">
        <section className="nxt5-auth-story" aria-labelledby="auth-story-title">
          <div className="nxt5-auth-art"><AuthGlassScene /><div className="nxt5-auth-horizon" aria-hidden="true" /></div>
          <div className="nxt5-auth-story-copy">
            <p className="nxt5-entry-eyebrow">{t("Ton espace équipe")}</p>
            <h2 id="auth-story-title">{t("Cinq rôles.")}<br /><span>{t("Une même direction.")}</span></h2>
            <p>{t("Joueurs, parties et points à travailler.")}</p>
          </div>
          <TeamRoleSignature />
        </section>
        <Surface variant="reading" glow className="nxt5-auth-card">
          <p className="nxt5-entry-eyebrow">{isRegister ? t("Bienvenue") : t("Bon retour")}</p>
          <h1>{isRegister && registrationRequested ? t("Demande reçue") : isSocialComplete ? t("Termine ton inscription") : isRegister ? t("Créer un compte") : t("Connexion")}</h1>
          {(isRegister || isSocialComplete) && <p className="nxt5-auth-intro">{isRegister && registrationRequested ? t("Consulte ta messagerie pour la suite de l’inscription.") : isSocialComplete ? t("Confirme tes informations pour créer ton compte NXT5.") : t("Crée ou rejoins une équipe. Accès gratuit.")}</p>}
          {isRegister && !registrationRequested && <p className="nxt5-auth-intro">{t("L’import nécessite NXT5 Importer sur Windows ou Mac, avec League of Legends ouvert. ")}<PublicTextLink href="/demo" navigate={navigate}>{t("Essaie la démo sans compte.")}</PublicTextLink></p>}
          {socialStatus && <div className="mt-4"><SocialNotice status={socialStatus} /></div>}
          {isRegister && registrationRequested ? <div className="nxt5-registration-confirmation"><p ref={registrationStatusRef} tabIndex={-1} role="status" className="nxt5-auth-notice is-success">{t("Si cette adresse peut être utilisée, tu recevras un e-mail de vérification. Si tu as déjà un compte, connecte-toi ou réinitialise ton mot de passe.")}</p><p>{t("Pour confirmer une nouvelle inscription, connecte-toi avec le mot de passe choisi, puis ouvre le lien de vérification reçu par e-mail dans ce même navigateur.")}</p><p>{t("Vérifie aussi tes courriers indésirables. Aucun abonnement n’a été activé.")}</p><LinkButton href={`/connexion${querySuffix}`} navigate={navigate} icon={ArrowRight}>{t("Se connecter")}</LinkButton><PublicTextLink href={`/mot-de-passe-oublie${querySuffix}`} navigate={navigate} className="nxt5-entry-text-link">{t("Réinitialiser mon mot de passe")}</PublicTextLink></div> : isSocialComplete ? <SocialSignup onComplete={completeAuth} loginHref={`/connexion${querySuffix}`} existingAccountHref="/connexion?next=%2Fparametres" /> : <>
          <SocialLogin flow={isRegister ? "register" : "login"} rememberMe={rememberMe} disabled={loading} />
          <form onSubmit={submit} className="nxt5-auth-form">
            <TextInput label={isRegister ? t("E-mail") : t("E-mail ou ancien pseudo")} value={form.email} onChange={(v) => patch("email", v)} placeholder="joueur@exemple.com" type={isRegister ? "email" : "text"} autoComplete={isRegister ? "email" : "username"} required icon={Mail} />
            {isRegister && <TextInput label={t("Pseudo")} value={form.displayName} onChange={(v) => patch("displayName", v)} placeholder={t("Ex : Joueur NXT5")} autoComplete="nickname" required icon={UserPlus} />}
            <TextInput label={t("Mot de passe")} value={form.password} onChange={(v) => patch("password", v)} placeholder="••••••••" type="password" autoComplete={isRegister ? "new-password" : "current-password"} required icon={Lock} />
            <div className="nxt5-auth-preferences"><PremiumToggle checked={rememberMe} onChange={setRememberMe} title={t("Rester connecté")} text={t("30 jours sur cet appareil.")} /></div>
            {isRegister && <LegalConsent checked={legalAccepted} onChange={setLegalAccepted} />}
            {error && <div role="alert" className="nxt5-auth-notice is-error">{t(error)}</div>}
            <Button type="submit" disabled={loading || (isRegister && !legalAccepted)} icon={loading ? Loader2 : isRegister ? UserPlus : ArrowRight} className="nxt5-auth-submit">{loading ? t("Chargement…") : isRegister ? t("Créer le compte") : t("Entrer dans NXT5")}</Button>
          </form>
          {!isRegister && <div className="nxt5-auth-recovery"><PublicTextLink href={`/mot-de-passe-oublie${querySuffix}`} navigate={navigate}>{t("Mot de passe oublié ?")}</PublicTextLink></div>}
          </>}
        </Surface>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}
