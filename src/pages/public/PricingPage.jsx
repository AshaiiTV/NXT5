import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CheckCircle2, Loader2, Mail, Users } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { PROPOSED_PLANS, PROPOSED_PLAN_OPTIONS } from "../../app/pricing.js";
import { AmbientBackground } from "../../components/layout/AppChrome.jsx";
import { Badge, Button, SelectInput, Surface, TextAreaInput, TextInput } from "../../components/ui/Core.jsx";
import { LegalLinks, SiteHeader } from "./PublicPages.jsx";
import AdminTabNav from "../../components/admin/AdminTabNav.jsx";
import "./pricing.css";

const FAQ = [
  ["Une offre existe-t-elle pour plusieurs équipes ?", "Le Pass Structure est envisagé sur devis, à partir de 79 € TTC par mois. Il prévoit plusieurs équipes, une facturation centralisée, un administrateur de structure, une vue multi-équipe et un accompagnement à l’installation. Le nombre d’équipes, les accès et le tarif final seront définis ensemble. Ces fonctions sont à préparer ; cette demande recueille ton besoin sans les activer."],
  ["Est-ce que je dois payer aujourd’hui ?", "Non. Ces offres sont en cours de validation avec les équipes. La demande d’accès nous permet de comprendre ton besoin et de te recontacter. Elle ne crée ni commande ni abonnement, et aucune carte bancaire n’est demandée."],
  ["Est-ce que chaque joueur devra payer ?", "L’offre envisagée couvre une équipe entière : jusqu’à 10 membres en Découverte et 15 par équipe avec un Pass Équipe ou Saison. Pour une structure, le périmètre sera défini sur devis. Le capitaine, le manager ou la structure pourra payer pour l’équipe ; ses membres n’auront pas chacun un abonnement à acheter."],
  ["Quelle différence entre le mensuel et le Pass Saison ?", "Le Pass Équipe est envisagé à 29 € TTC par mois, avec renouvellement mensuel et résiliation à tout moment pour la période suivante. Le Pass Saison est envisagé à 169 € TTC pour six mois, en un paiement, sans renouvellement automatique. Il reprend les mêmes outils et l’assistance standard."],
  ["Les limites s’appliquent-elles déjà à mon équipe ?", "Non. Les prix, fonctions incluses et quotas présentés ici décrivent les offres envisagées. Tes accès actuels et tes données restent inchangés. Toute évolution sera précisée avant le lancement des offres."],
  ["Que deviennent mes données à la fin d’un Pass ?", "Les règles de conservation après expiration sont encore à définir. Elles seront communiquées avant toute vente, avec les conditions de résiliation. Cette demande d’accès ne modifie pas la conservation actuelle de tes données."],
  ["Où trouver les conditions de vente et les factures ?", "Le paiement n’est pas encore ouvert. Les conditions de vente, les règles de remboursement et les informations de facturation seront disponibles avant toute souscription."],
];

function initialForm(user) {
  return {
    contactName: user?.name || user?.display_name || user?.displayName || "",
    email: user?.email || "",
    teamName: "",
    role: "",
    planCode: "team_monthly",
    payer: "unknown",
    purchaseIntent: "",
    message: "",
    consent: false,
    website: "",
  };
}

function requestError(error) {
  if (error?.status === 429) return "Trop de demandes rapprochées. Tes réponses sont conservées ici ; réessaie un peu plus tard.";
  if (error?.status === 400 && error?.message) return error.message;
  return "Nous n’avons pas pu confirmer l’enregistrement. Tes réponses sont conservées ici ; réessaie dans quelques instants.";
}

export default function PricingPage({ navigate, user }) {
  const [form, setForm] = useState(() => initialForm(user));
  const initialFormRef = useRef(form);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const formSectionRef = useRef(null);
  const statusRef = useRef(null);
  const pendingRef = useRef(false);
  const structureSelected = form.planCode === "structure";

  useEffect(() => {
    if (error || success) statusRef.current?.focus();
  }, [error, success]);

  function patch(key, value) {
    setForm((current) => ({ ...current, [key]: value, ...(key === "planCode" && (current.planCode === "structure") !== (value === "structure") ? { purchaseIntent: "" } : {}) }));
  }

  function selectPlan(planCode) {
    if (pendingRef.current) return;
    if (!success) patch("planCode", planCode);
    formSectionRef.current?.scrollIntoView?.({ behavior: "auto", block: "start" });
    if (success) statusRef.current?.focus({ preventScroll: true });
    else formSectionRef.current?.querySelector("input")?.focus({ preventScroll: true });
  }

  async function submit(event) {
    event.preventDefault();
    if (pendingRef.current || success) return;
    setError("");
    if (form.contactName.trim().length < 2 || form.teamName.trim().length < 2 || !form.email.trim() || !form.role || !form.purchaseIntent) {
      setError("Renseigne ton nom, ton e-mail, ton équipe ou ta structure, ton rôle et ton intérêt pour l’offre.");
      return;
    }
    if (!form.consent) {
      setError("Ton accord est nécessaire pour te recontacter au sujet de cette demande.");
      return;
    }
    pendingRef.current = true;
    setSaving(true);
    try {
      const result = await apiFetch("access-requests", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          contactName: form.contactName.trim(),
          email: form.email.trim().toLowerCase(),
          teamName: form.teamName.trim(),
          message: form.message.trim(),
        }),
      });
      if (result?.ok !== true) throw new Error("Unconfirmed access request");
      setSuccess(true);
    } catch (err) {
      setError(requestError(err));
    } finally {
      pendingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="nxt5-pricing relative min-h-screen overflow-hidden text-white">
      <AmbientBackground />
      <SiteHeader navigate={navigate} />
      <main className="relative z-10 mx-auto w-full max-w-7xl px-3 pb-12 sm:px-5 sm:pb-16">
        <AdminTabNav activeId="pricing" navigate={navigate} disabled={saving} dirty={!success && JSON.stringify(form) !== JSON.stringify(initialFormRef.current)} />
        <aside className="border-l-2 border-violet-300/40 py-2 pl-4 text-sm leading-6 text-slate-300" aria-label="Accès administrateur">
          <p className="font-bold text-violet-100">Aperçu réservé à l’administrateur</p>
          <p>La page et son formulaire sont fermés aux visiteurs et aux autres comptes. Les demandes envoyées depuis cet aperçu sont enregistrées dans le suivi.</p>
        </aside>
        <section className="pricing-intro" aria-labelledby="pricing-title">
          <div>
            <Badge tone="cyan">Tarifs · offres à l’étude</Badge>
            <h1 id="pricing-title" className="mt-5 max-w-3xl text-4xl font-black leading-[1.06] tracking-tight sm:text-5xl lg:text-6xl">
              Tout le suivi de ton équipe.<br /><span className="nxt5-metal-text">Au même endroit.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-slate-300">
              Games, reviews, champion pools et planning : un espace partagé pour ton roster et ton staff. Choisis l’offre qui correspondrait à ton équipe et aide-nous à préparer son lancement.
            </p>
          </div>
          <aside className="pricing-launch-note" aria-label="Avant le lancement">
            <Users aria-hidden="true" className="h-6 w-6 text-cyan-200" />
            <p className="mt-4 text-lg font-black">Une offre pour l’équipe entière</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">Un seul payeur pour le roster et le staff. Les prix et quotas sont en cours de validation.</p>
            <p className="mt-4 border-t border-cyan-100/15 pt-4 text-sm font-bold leading-6 text-cyan-100">Aucun paiement aujourd’hui.<br />Tes accès actuels restent inchangés.</p>
          </aside>
        </section>

        <section aria-label="Comparer les offres envisagées" className="mt-8">
          <div className="pricing-plans">
            {PROPOSED_PLANS.map((plan) => (
              <Surface key={plan.code} className={`pricing-plan pricing-plan--${plan.code}`}>
                <article aria-labelledby={`plan-${plan.code}`} className="pricing-plan-body">
                  <div>
                    <p className="pricing-plan-eyebrow">{plan.code === "free" ? "Premiers pas" : plan.code === "team_monthly" ? "Au rythme de l’équipe" : plan.code === "structure" ? "Plusieurs équipes" : "Une durée définie"}</p>
                    <h2 id={`plan-${plan.code}`} className="mt-2 text-2xl font-black">{plan.name}</h2>
                    <p className="pricing-plan-description mt-3 text-sm leading-6 text-slate-300">{plan.description}</p>
                    <p className="mt-5 text-5xl font-black tracking-tight tabular-nums"><span className="pricing-price-prefix">{plan.pricePrefix || ""}</span>{" "}{plan.price}</p>
                    <p className="mt-2 text-sm font-bold text-slate-300">{plan.period}</p>
                    <p className="pricing-plan-terms mt-4 text-sm font-semibold leading-6 text-cyan-100">{plan.terms}</p>
                  </div>
                  <ul className="pricing-plan-features">
                    {plan.features.map((feature) => <li key={feature}><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" /><span>{feature}</span></li>)}
                  </ul>
                  <Button type="button" variant={plan.code === "team_monthly" ? "primary" : "ghost"} disabled={saving} icon={ArrowRight} className="w-full" aria-label={`Demander un accès — ${plan.name}`} onClick={() => selectPlan(plan.code)}>Demander un accès</Button>
                </article>
              </Surface>
            ))}
          </div>
          <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-300">Offres envisagées, en cours de validation. Les Pass Équipe et Saison prévoient les outils inclus sans quota fonctionnel artificiel, dans le cadre d’un usage normal. Le Pass Structure sera adapté sur devis, avec des fonctions multi-équipes à préparer. Les limites Découverte affichées ici ne sont pas appliquées aujourd’hui.</p>
        </section>

        <div className="pricing-details">
          <section aria-labelledby="pricing-faq-title">
            <Badge tone="purple">Avant de te lancer</Badge>
            <h2 id="pricing-faq-title" className="mt-4 text-3xl font-black tracking-tight">Les réponses utiles</h2>
            <div className="mt-5">
              {FAQ.map(([question, answer]) => <details className="pricing-faq-item" key={question}><summary>{question}</summary><p className="pb-5 text-sm leading-7 text-slate-300">{answer}</p></details>)}
            </div>
          </section>

          <section id="demande-acces" ref={formSectionRef} aria-labelledby="access-request-title" className="pricing-request">
            <Surface>
              <Badge tone="cyan">Préparer ton accès</Badge>
              <h2 id="access-request-title" className="mt-4 text-3xl font-black tracking-tight">{structureSelected ? "Parlons de ta structure" : "Parlons de ton équipe"}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">Dis-nous ce qui t’intéresse. Ta demande nous aide à valider l’offre et à préparer un échange avec toi, sans engagement d’achat.</p>
              {success ? (
                <div ref={statusRef} tabIndex={-1} role="status" className="pricing-success mt-6 rounded-2xl border border-emerald-200/25 bg-emerald-400/10 p-5">
                  <CheckCircle2 aria-hidden="true" className="h-7 w-7 text-emerald-200" />
                  <h3 className="mt-3 text-xl font-black text-emerald-100">Demande reçue ou déjà enregistrée</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-200">Merci pour ton intérêt. Si une demande existe déjà pour cet e-mail et cette équipe, ses informations initiales sont conservées. Pour les modifier, <a href="/contact" className="font-bold text-cyan-200 underline underline-offset-4">contacte-nous</a>.</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">Aucun compte ni abonnement n’a été activé par cette demande. Tes accès actuels restent inchangés.</p>
                </div>
              ) : (
                <form onSubmit={submit} className="mt-6" aria-busy={saving} aria-describedby="access-request-help">
                  <p id="access-request-help" className="mb-5 text-xs leading-5 text-slate-300">Les champs marqués d’un * sont obligatoires.</p>
                  <fieldset disabled={saving} className="min-w-0 space-y-5">
                    <legend className="sr-only">Ta demande d’accès NXT5</legend>
                    <div className="pricing-form-row">
                      <TextInput label="Ton nom ou pseudo *" name="contactName" autoComplete="name" minLength={2} maxLength={80} value={form.contactName} onChange={(value) => patch("contactName", value)} placeholder="Ton nom" required />
                      <TextInput label="E-mail de contact *" name="email" autoComplete="email" maxLength={160} value={form.email} onChange={(value) => patch("email", value)} placeholder="toi@exemple.fr" type="email" required />
                    </div>
                    <div className="pricing-form-row">
                      <TextInput label={structureSelected ? "Nom de la structure *" : "Nom de l’équipe *"} name="teamName" minLength={2} maxLength={100} value={form.teamName} onChange={(value) => patch("teamName", value)} placeholder={structureSelected ? "Ton organisation" : "Ton équipe ou ton projet"} required />
                      <SelectInput label="Ton rôle *" name="role" required value={form.role} onChange={(value) => patch("role", value)}>
                        <option value="" disabled>Choisis ton rôle</option>
                        <option value="captain">Capitaine</option><option value="manager">Manager</option><option value="coach">Coach</option><option value="player">Joueur</option><option value="other">Autre</option>
                      </SelectInput>
                    </div>
                    <SelectInput label="L’offre qui t’intéresse *" name="planCode" required value={form.planCode} onChange={(value) => patch("planCode", value)}>
                      {PROPOSED_PLAN_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </SelectInput>
                    <SelectInput label="Qui prendrait en charge l’offre ?" name="payer" value={form.payer} onChange={(value) => patch("payer", value)}>
                      <option value="unknown">Pas encore décidé</option><option value="self">Moi</option><option value="team">L’équipe, en commun</option><option value="association">Une association ou une structure</option>
                    </SelectInput>
                    <SelectInput label="Ton intérêt pour cette offre *" name="purchaseIntent" required value={form.purchaseIntent} onChange={(value) => patch("purchaseIntent", value)}>
                      <option value="" disabled>Choisis une réponse</option><option value="yes">{structureSelected ? "Oui, selon le devis" : "Oui, au tarif indiqué"}</option><option value="maybe">Peut-être, je souhaite en discuter</option><option value="discover">Je souhaite seulement découvrir</option>
                    </SelectInput>
                    <TextAreaInput label="Un besoin, une question ? (facultatif)" name="message" maxLength={2000} value={form.message} onChange={(value) => patch("message", value)} placeholder={structureSelected ? "Nombre d’équipes, organisation du staff et besoins communs…" : "Votre rythme de jeu, le lancement d’un split, un besoin du staff…"} rows={3} />
                    <div className="pricing-honeypot" aria-hidden="true"><label>Site web<input name="website" type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => patch("website", event.target.value)} /></label></div>
                    <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-300">
                      <input type="checkbox" required checked={form.consent} onChange={(event) => patch("consent", event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-cyan-300" />
                      <span>J’accepte que NXT5 utilise ces informations pour me recontacter au sujet de cette demande. Aucune inscription à une newsletter. J’ai lu la <a href="/confidentialite" className="font-bold text-cyan-200 underline underline-offset-4">politique de confidentialité</a>. *</span>
                    </label>
                    <p className="text-xs leading-5 text-slate-300">Les données de ta demande sont supprimées après 6 mois, lors du cycle de suppression quotidien.</p>
                  </fieldset>
                  {error && <p ref={statusRef} tabIndex={-1} role="alert" className="mt-5 rounded-xl border border-rose-300/25 bg-rose-500/10 p-4 text-sm font-semibold leading-6 text-rose-100">{error}</p>}
                  <Button type="submit" icon={saving ? Loader2 : Mail} disabled={saving} className="mt-6 w-full">{saving ? "Enregistrement…" : "Envoyer ma demande d’accès"}</Button>
                  <p className="mt-3 text-center text-xs leading-5 text-slate-300">Sans paiement et sans engagement d’achat.</p>
                </form>
              )}
            </Surface>
          </section>
        </div>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}
