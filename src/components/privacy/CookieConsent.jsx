import React, { useEffect, useRef, useState } from "react";
import { BarChart3, Cookie, LockKeyhole, ShieldCheck, X } from "lucide-react";
import { Button } from "../ui/Core.jsx";
import { AUDIENCE_SETTINGS_EVENT, getAudienceClient } from "../../app/audience-client.js";
import "./cookies.css";

export default function CookieConsent({ route, ready, excluded = false }) {
  const [client] = useState(getAudienceClient);
  const [state, setState] = useState(client.getState);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [notice, setNotice] = useState("");
  const dialogRef = useRef(null), openerRef = useRef(null);

  useEffect(() => client.subscribe(setState), [client]);
  useEffect(() => client.connect(), [client]);
  useEffect(() => {
    client.setContext({ path: route?.path, excluded: !ready || excluded });
    if (ready && !excluded) client.initialize();
  }, [client, route?.path, ready, excluded]);
  useEffect(() => {
    const open = () => {
      openerRef.current = document.activeElement;
      setAnalytics(client.getState().choice === "accepted");
      setSettingsOpen(true);
      client.initialize(true);
    };
    window.addEventListener(AUDIENCE_SETTINGS_EVENT, open);
    return () => window.removeEventListener(AUDIENCE_SETTINGS_EVENT, open);
  }, [client]);
  useEffect(() => {
    if (!settingsOpen) return;
    const dialog = dialogRef.current;
    dialog?.focus();
    const onKey = event => {
      if (event.key === "Escape") { event.preventDefault(); closeSettings(); }
      if (event.key !== "Tab" || !dialog) return;
      const controls = Array.from(dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]'));
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first?.focus(); }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = previousOverflow; openerRef.current?.focus?.(); };
  }, [settingsOpen]);

  function openSettings() {
    openerRef.current = document.activeElement;
    setAnalytics(state.choice === "accepted");
    setSettingsOpen(true);
    client.initialize(true);
  }
  function closeSettings() { setSettingsOpen(false); }
  async function choose(value) {
    setNotice("");
    const saved = await client.choose(value);
    if (saved) {
      setSettingsOpen(false);
      setNotice(value ? "Ton accord est enregistré. La mesure d’audience est activée." : "Ton choix est enregistré. La mesure d’audience est désactivée.");
    }
  }
  const showBanner = ready && !excluded && state.loaded && !state.choice && !settingsOpen;
  return <>
    <button type="button" className="nxt5-cookie-settings" onClick={openSettings} aria-haspopup="dialog" aria-expanded={settingsOpen}>
      <Cookie size={17} aria-hidden="true" /><span>Mes cookies</span>
    </button>
    <p className="sr-only" role="status">{notice}</p>
    {showBanner && <section className="nxt5-cookie-banner" aria-labelledby="cookie-banner-title" aria-describedby="cookie-banner-description">
      <div className="nxt5-cookie-heading"><span className="nxt5-cookie-icon"><ShieldCheck size={23} aria-hidden="true" /></span><div><p className="nxt5-cookie-eyebrow">Ta confidentialité</p><h2 id="cookie-banner-title">Les cookies, c’est toi qui choisis.</h2></div></div>
      <p id="cookie-banner-description">Avec ton accord, NXT5 utilise des cookies pour comprendre les visites, les pages utiles et les actions réalisées. Aucun suivi publicitaire. Tu peux refuser et utiliser le site normalement.</p>
      <p className="nxt5-cookie-detail">Les cookies de connexion restent nécessaires. Ton choix est conservé 180 jours et modifiable à tout moment. <a href="/cookies">En savoir plus</a></p>
      {state.error && <p className="nxt5-cookie-error" role="alert">{state.error}</p>}
      <div className="nxt5-cookie-actions">
        <Button type="button" variant="ghost" disabled={state.saving} onClick={() => choose(false)}>Tout refuser</Button>
        <Button type="button" variant="ghost" disabled={state.saving} onClick={openSettings}>Personnaliser</Button>
        <Button type="button" variant="ghost" disabled={state.saving} onClick={() => choose(true)}>Tout accepter</Button>
      </div>
      {state.saving && <p role="status" className="nxt5-cookie-detail">Enregistrement de ton choix…</p>}
    </section>}
    {!showBanner && !settingsOpen && state.error && <div className="nxt5-cookie-feedback" role="alert"><p>{state.error}</p><button type="button" onClick={openSettings}>Gérer mon choix</button></div>}
    {settingsOpen && <div className="nxt5-cookie-backdrop">
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="cookie-settings-title" aria-describedby="cookie-settings-description" className="nxt5-cookie-dialog">
        <div className="nxt5-cookie-heading"><span className="nxt5-cookie-icon"><Cookie size={23} aria-hidden="true" /></span><div><p className="nxt5-cookie-eyebrow">Préférences de confidentialité</p><h2 id="cookie-settings-title">Garde la main sur tes cookies.</h2></div><button type="button" className="nxt5-cookie-close" aria-label="Fermer les préférences cookies" onClick={closeSettings}><X size={20} aria-hidden="true" /></button></div>
        <p id="cookie-settings-description">Choisis ce que tu autorises sur ce navigateur. Refuser les statistiques ne limite aucune fonctionnalité de NXT5.</p>
        <div className="nxt5-cookie-category"><LockKeyhole size={20} aria-hidden="true" /><div><h3>Fonctionnement du site</h3><p>Connexion, sécurité et mémorisation de tes préférences. Ces cookies sont nécessaires au service demandé.</p><span>Toujours actifs</span></div><input type="checkbox" checked disabled aria-label="Cookies nécessaires, toujours actifs" /></div>
        <label className="nxt5-cookie-category nxt5-cookie-category-choice"><BarChart3 size={20} aria-hidden="true" /><div><h3>Statistiques de fréquentation</h3><p>Pages consultées, provenance, type d’appareil et actions comme la création d’un compte. Des identifiants aléatoires distinguent les navigateurs et les sessions, sans les rattacher à ton compte.</p><span>Facultatifs · désactivés sans ton accord</span></div><input type="checkbox" checked={analytics} disabled={state.saving} onChange={event => setAnalytics(event.target.checked)} aria-label="Autoriser les statistiques de fréquentation" /></label>
        <p className="nxt5-cookie-detail">Mesure interne à NXT5, hébergée par Netlify et Neon. Données conservées 180 jours, sans cookie publicitaire, sans enregistrement des formulaires ni de l’adresse IP dans les statistiques. <a href="/cookies">Politique cookies</a> · <a href="/confidentialite">Confidentialité</a></p>
        {state.error && <p className="nxt5-cookie-error" role="alert">{state.error}</p>}
        <div className="nxt5-cookie-actions">
          <Button type="button" variant="ghost" disabled={state.saving} onClick={() => choose(false)}>Tout refuser</Button>
          <Button type="button" variant="ghost" disabled={state.saving} onClick={() => choose(true)}>Tout accepter</Button>
        </div>
        <Button type="button" variant="ghost" className="nxt5-cookie-save" disabled={state.saving} onClick={() => choose(analytics)}>{state.saving ? "Enregistrement…" : "Enregistrer mes préférences"}</Button>
      </section>
    </div>}
  </>;
}
