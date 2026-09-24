import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, FileText, X } from "lucide-react";
import { Badge, Button, TextInput, SelectInput } from "../ui/Core.jsx";
import { roleLabel } from "../../pages/workspace/shell-shared.jsx";
import { analysisCopy } from "./analysis-copy.js";
import { trendMatchTimestamp } from "../../utils/trends.js";

let openDialogs = 0;
let bodyOverflow = "";

function TrendsDialog({ title, subtitle, children, onClose, id }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const focused = document.activeElement;
    if (openDialogs === 0) bodyOverflow = document.body.style.overflow;
    openDialogs += 1;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      dialog?.close();
      openDialogs -= 1;
      if (openDialogs === 0) document.body.style.overflow = bodyOverflow;
      if (focused?.isConnected) focused.focus();
    };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(<dialog ref={ref} className="nxt5-trend-dialog" aria-labelledby={`${id}-title`} aria-describedby={subtitle ? `${id}-description` : undefined} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
    <header><div><h3 id={`${id}-title`}>{title}</h3>{subtitle && <p id={`${id}-description`}>{subtitle}</p>}</div><button autoFocus type="button" className="trends-close" onClick={onClose} aria-label={`Fermer ${id === "trend-sources" ? "les sources" : "les objectifs par joueur"}`}><X aria-hidden="true" /></button></header>
    <div className="trends-dialog-body">{children}</div>
  </dialog>, document.body);
}

export function TrendSourcesDialog({ source, onClose, onOpenGame, signals, read }) {
  const [search, setSearch] = useState("");
  const [result, setResult] = useState("");
  const games = source.games || [];
  const filtered = useMemo(() => games.filter((game) => (!result || game.result === result) && [game.title, game.topRoleLabel, game.side, game.patch].join(" ").toLocaleLowerCase("fr").includes(search.trim().toLocaleLowerCase("fr"))), [games, search, result]);
  return <TrendsDialog id="trend-sources" title={source.title} subtitle={analysisCopy(source.subtitle)} onClose={onClose}>
    <div className="trends-source-tools"><TextInput label="Rechercher une partie" value={search} onChange={setSearch} placeholder="Nom, champion, rôle…" /><SelectInput label="Résultat" value={result} onChange={setResult}><option value="">Tous les résultats</option><option value="Victoire">Victoires</option><option value="Défaite">Défaites</option></SelectInput></div>
    <div className="trends-section-heading"><p role="status">{filtered.length} partie{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""} sur {games.length}</p><span>Écarts : notre équipe − adversaires</span></div>
    <details className="trends-source-context"><summary>Contexte de l’analyse</summary><dl>{(source.metrics || []).map((metric, index) => <div key={`${metric.label}-${index}`}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl></details>
    <div className="trends-source-list">{filtered.map((game, index) => {
      const timestamp = trendMatchTimestamp(game.match || game);
      return <article key={`${game.id || game.title}-${index}`}>
        <div className="trends-source-heading"><div><h4>{game.title}</h4><p>{timestamp === null ? "Date inconnue" : new Date(timestamp).toLocaleDateString("fr-FR")} · {game.duration} · {game.side} · {game.patch}</p></div><Badge tone={game.result === "Victoire" ? "green" : game.result === "Défaite" ? "red" : "slate"}>{game.result}</Badge></div>
        <dl className="trends-source-signals">{signals(game).map((signal) => <div key={signal.label}><dt>{analysisCopy(signal.label)}</dt><dd className={`trends-value-${signal.toneName}`}>{signal.value}</dd></div>)}</dl>
        <p className="trends-source-read">{analysisCopy(read(game))}</p><p className="trends-source-role"><strong>Contribution repérée : {game.topRoleLabel}</strong><span>{analysisCopy(game.topRoleDetail)}</span></p>
        <Button type="button" variant="ghost" icon={ArrowRight} onClick={() => onOpenGame(game)}>Ouvrir la partie</Button>
      </article>;
    })}</div>
    {!filtered.length && <div className="trends-dialog-empty"><h4>{games.length ? "Aucune partie ne correspond" : "Aucune partie source isolée"}</h4><p>{games.length ? "Modifie la recherche ou le résultat sélectionné." : "Ce signal ne dispose pas encore de sources dans la sélection active."}</p>{games.length > 0 && <Button type="button" variant="ghost" onClick={() => { setSearch(""); setResult(""); }}>Réinitialiser la recherche</Button>}</div>}
  </TrendsDialog>;
}

export function TrendContractsDialog({ objectives, onClose, onOpenSources }) {
  return <TrendsDialog id="trend-contracts" title="Objectifs par joueur" subtitle="Une cible et un exercice pour préparer la prochaine session." onClose={onClose}>
    {!objectives.length && <div className="trends-dialog-empty"><h4>Aucun joueur dans l’équipe</h4><p>Ajoute les joueurs de l’équipe pour retrouver leurs objectifs individuels. Les consignes par rôle restent disponibles dans Objectifs.</p></div>}
    <div className="trends-contracts">{objectives.map((item) => <article key={item.player.id}>
      <header><div><h4>{item.player.name}</h4><p>{item.player.riot_id || "Riot ID non lié"}</p></div><span>{roleLabel(item.role)} · {item.games} partie{item.games > 1 ? "s" : ""}</span></header>
      <div className="trends-contract-content"><div><p className="trends-eyebrow">Objectif</p><h5>{analysisCopy(item.title)}</h5><p>{analysisCopy(item.trigger)}</p></div><div><p className="trends-eyebrow">Cible et exercice</p><h5>{analysisCopy(item.target).replaceAll("<=", "≤").replaceAll(">=", "≥")}</h5><p>{analysisCopy(item.drill)}</p></div></div>
      <button type="button" className="trends-text-action" onClick={() => onOpenSources({ title: `Sources ${item.player.name}`, subtitle: item.title, games: item.sourceGames })}><FileText aria-hidden="true" /> Voir les parties sources</button>
    </article>)}</div>
  </TrendsDialog>;
}
