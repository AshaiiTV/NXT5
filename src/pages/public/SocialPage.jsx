import React from "react";
import { ArrowUpRight, MessageCircle, Radio } from "lucide-react";
import { getSocialLinks } from "../../app/social-links.js";
import { AmbientBackground } from "../../components/layout/AppChrome.jsx";
import { Badge, Surface } from "../../components/ui/Core.jsx";
import { LegalLinks, LinkButton, SiteHeader } from "./PublicPages.jsx";

export default function SocialPage({ navigate, user }) {
  const links = getSocialLinks();
  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#020611] text-white">
      <AmbientBackground />
      <SiteHeader navigate={navigate}>
        <LinkButton href={user ? "/equipes" : "/connexion"} navigate={navigate} variant="ghost">
          {user ? "Retour à l’app" : "Connexion"}
        </LinkButton>
      </SiteHeader>
      <main className="relative z-10 mx-auto max-w-5xl px-5 pb-12 pt-8 sm:pt-14">
        <Badge tone="cyan">La communauté NXT5</Badge>
        <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">Réseaux</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
          La partie continue ensemble. Rejoins la communauté et suis les actualités de NXT5.
        </p>
        <p id="social-new-tab" className="mt-3 text-sm leading-6 text-slate-300">
          Chaque lien ouvre la plateforme concernée dans un nouvel onglet.
        </p>
        <div className="mt-9 grid gap-5 md:grid-cols-2">
          {links.map((network) => (
            <Surface key={network.id} glow className={network.id === "discord" ? "md:col-span-2" : ""}>
              <div className="flex flex-col items-start gap-5 p-2 sm:p-4">
                <div className="flex items-center gap-3 text-cyan-100">
                  {network.id === "discord" ? <MessageCircle aria-hidden="true" className="h-6 w-6" /> : <Radio aria-hidden="true" className="h-6 w-6" />}
                  <h2 className="text-2xl font-black">{network.label}</h2>
                </div>
                <p className="max-w-2xl text-sm leading-7 text-slate-200">{network.description}</p>
                <a href={network.href} target="_blank" rel="noopener noreferrer" aria-describedby="social-new-tab"
                  className="nxt5-control inline-flex min-h-12 max-w-full items-center gap-3 rounded-xl border border-cyan-200/30 bg-cyan-300/10 px-5 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">
                  <span className="min-w-0 break-words">{network.id === "discord" ? "Rejoindre le Discord" : `Suivre NXT5 sur ${network.label}`}</span>
                  <ArrowUpRight aria-hidden="true" className="h-5 w-5 shrink-0" />
                </a>
              </div>
            </Surface>
          ))}
        </div>
        {!links.length && <Surface className="mt-8"><p>Les liens de la communauté seront disponibles prochainement.</p></Surface>}
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}
