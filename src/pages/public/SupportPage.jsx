import React from "react";
import { ArrowLeft, ArrowUpRight, Heart, MessageCircle, Sparkles, Wrench } from "lucide-react";
import { normalizeSupportUrl, SUPPORT_URL } from "../../app/support.js";
import { AmbientBackground } from "../../components/layout/AppChrome.jsx";
import { Surface } from "../../components/ui/Core.jsx";
import { LegalLinks, LinkButton, PublicTextLink, SiteHeader } from "./PublicPages.jsx";
import "./support.css";

export function SupportPage({ navigate, user, supportUrl = SUPPORT_URL }) {
  const destination = normalizeSupportUrl(supportUrl);

  return (
    <div className="nxt5-entry-page nxt5-support-page">
      <AmbientBackground />
      <SiteHeader navigate={navigate} simple>
        <LinkButton href={user ? "/equipes" : "/connexion"} navigate={navigate} variant="ghost">
          {user ? "Mon espace" : "Se connecter"}
        </LinkButton>
      </SiteHeader>
      <main className="nxt5-entry-main nxt5-support-main">
        <PublicTextLink href="/" navigate={navigate} className="nxt5-entry-text-link nxt5-support-back">
          <ArrowLeft aria-hidden="true" size={16} />Retour à l’accueil
        </PublicTextLink>
        <div className="nxt5-support-layout">
          <section className="nxt5-support-story" aria-labelledby="support-title">
            <p className="nxt5-entry-eyebrow">Un projet indépendant</p>
            <h1 id="support-title" className="nxt5-page-title">Soutenir NXT5</h1>
            <p className="nxt5-support-intro">Aide à améliorer l’outil que tu utilises avec ton équipe.</p>
            <p>Je développe NXT5 pour aider les équipes à préparer leurs parties et à en tirer des pistes de progrès. Ton soutien contribue aux prochaines améliorations.</p>
            <ul className="nxt5-support-impact">
              <li><Sparkles aria-hidden="true" size={20} /><div><h2>Faire évoluer l’outil</h2><p>Améliorer les fonctionnalités qui accompagnent le travail de ton équipe.</p></div></li>
              <li><Wrench aria-hidden="true" size={20} /><div><h2>Prendre soin du projet</h2><p>Continuer à corriger, simplifier et améliorer NXT5 au quotidien.</p></div></li>
            </ul>
          </section>
          <section aria-labelledby="contribute-title" className="nxt5-support-contribute">
            <Surface className="nxt5-support-card">
              <Heart aria-hidden="true" className="nxt5-support-heart" size={28} />
              <h2 id="contribute-title">Contribuer au développement</h2>
              <p>Tu choisis le montant et la fréquence de ton soutien.</p>
              {destination ? (
                <>
                  <p className="nxt5-support-choice">Choisis ton montant sur la page de soutien, pour une contribution ponctuelle ou mensuelle.</p>
                  <LinkButton href={destination} target="_blank" icon={ArrowUpRight} className="nxt5-support-cta">
                    Soutenir le projet<span className="sr-only"> (nouvel onglet)</span>
                  </LinkButton>
                  <p className="nxt5-support-external">Le paiement s’effectue sur la plateforme de soutien, dans un nouvel onglet.</p>
                </>
              ) : (
                <div className="nxt5-support-pending">
                  <p>Les contributions ne sont pas encore ouvertes.</p>
                  <p>Tu peux déjà faire connaître NXT5 ou partager tes idées pour la suite.</p>
                </div>
              )}
              <p className="nxt5-support-optional">Le soutien est entièrement facultatif. Il ne change pas tes accès à NXT5 et ne débloque pas de fonctionnalité exclusive.</p>
            </Surface>
            <div className="nxt5-support-community">
              <MessageCircle aria-hidden="true" size={20} />
              <div><h2>Tes retours comptent aussi.</h2><p>Signale un problème, propose une idée ou fais connaître NXT5 à une autre équipe.</p><PublicTextLink href="/reseaux" navigate={navigate} className="nxt5-entry-text-link">Rejoindre la communauté<ArrowUpRight aria-hidden="true" size={16} /></PublicTextLink></div>
            </div>
          </section>
        </div>
        <p className="nxt5-support-thanks">Merci à celles et ceux qui font vivre NXT5.</p>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}
