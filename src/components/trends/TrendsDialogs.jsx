import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import { registerDialog } from "../ui/dialog-registry.js";
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
  useLanguage();
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const focused = document.activeElement;
    if (openDialogs === 0) bodyOverflow = document.body.style.overflow;
    openDialogs += 1;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    const unregister = registerDialog(dialog);
    return () => {
      unregister();
      dialog?.close();
      openDialogs -= 1;
      if (openDialogs === 0) document.body.style.overflow = bodyOverflow;
      if (focused?.isConnected) focused.focus();
    };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(<dialog ref={ref} className="nxt5-trend-dialog" aria-labelledby={`${id}-title`} aria-describedby={subtitle ? `${id}-description` : undefined} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
    <header><div><h3 id={`${id}-title`}>{t(title)}</h3>{subtitle && <p id={`${id}-description`}>{t(subtitle)}</p>}</div><button autoFocus type="button" className="trends-close" onClick={onClose} aria-label={t("Fermer {0}", [id === "trend-sources" ? t("les sources") : t("les objectifs par joueur")])}><X aria-hidden="true" /></button></header>
    <div className="trends-dialog-body">{children}</div>
  </dialog>, document.body);
}

export function TrendSourcesDialog({ source, onClose, onOpenGame, signals, read }) {
  useLanguage();
  const [search, setSearch] = useState("");
  const [result, setResult] = useState("");
  const games = source.games || [];
  const filtered = useMemo(() => games.filter((game) => (!result || game.result === result) && [game.title, game.topRoleLabel, game.side, game.patch].join(" ").toLocaleLowerCase("fr").includes(search.trim().toLocaleLowerCase("fr"))), [games, search, result]);
  return <TrendsDialog id="trend-sources" title={source.title} subtitle={t(analysisCopy(source.subtitle))} onClose={onClose}>
    <div className="trends-source-tools"><TextInput label={t("Rechercher une partie")} value={search} onChange={setSearch} placeholder={t("Nom, champion, rôle…")} /><SelectInput label={t("Résultat")} value={result} onChange={setResult}><option value="">{t("Tous les résultats")}</option><option value="Victoire">{t("Victoires")}</option><option value="Défaite">{t("Défaites")}</option></SelectInput></div>
    <div className="trends-section-heading"><p role="status">{filtered.length}{t(filtered.length > 1 ? " parties" : " partie")}{t(filtered.length > 1 ? " affichées" : " affichée")}{t(" sur ")}{games.length}</p><span>{t("Écarts : notre équipe − adversaires")}</span></div>
    <details className="trends-source-context"><summary>{t("Contexte de l’analyse")}</summary><dl>{(source.metrics || []).map((metric, index) => <div key={`${metric.label}-${index}`}><dt>{t(metric.label)}</dt><dd>{metric.value}</dd></div>)}</dl></details>
    <div className="trends-source-list">{filtered.map((game, index) => {
      const timestamp = trendMatchTimestamp(game.match || game);
      return <article key={`${game.id || game.title}-${index}`}>
        <div className="trends-source-heading"><div><h4>{game.title}</h4><p>{timestamp === null ? t("Date inconnue") : new Date(timestamp).toLocaleDateString(getLocale())} · {game.duration} · {t(game.side)} · {game.patch}</p></div><Badge tone={game.result === "Victoire" ? "green" : game.result === "Défaite" ? "red" : "slate"}>{t(game.result)}</Badge></div>
        <dl className="trends-source-signals">{signals(game).map((signal) => <div key={signal.label}><dt>{t(analysisCopy(signal.label))}</dt><dd className={`trends-value-${signal.toneName}`}>{signal.value}</dd></div>)}</dl>
        <p className="trends-source-read">{t(analysisCopy(read(game)))}</p><p className="trends-source-role"><strong>{t("Contribution repérée : ")}{t(game.topRoleLabel)}</strong><span>{t(analysisCopy(game.topRoleDetail))}</span></p>
        <Button type="button" variant="ghost" icon={ArrowRight} onClick={() => onOpenGame(game)}>{t("Ouvrir la partie")}</Button>
      </article>;
    })}</div>
    {!filtered.length && <div className="trends-dialog-empty"><h4>{games.length ? t("Aucune partie ne correspond") : t("Aucune partie source isolée")}</h4><p>{games.length ? t("Modifie la recherche ou le résultat sélectionné.") : t("Ce signal ne dispose pas encore de sources dans la sélection active.")}</p>{games.length > 0 && <Button type="button" variant="ghost" onClick={() => { setSearch(""); setResult(""); }}>{t("Réinitialiser la recherche")}</Button>}</div>}
  </TrendsDialog>;
}

export function TrendContractsDialog({ objectives, onClose, onOpenSources }) {
  useLanguage();
  return <TrendsDialog id="trend-contracts" title={t("Objectifs par joueur")} subtitle={t("Une cible et un exercice pour préparer la prochaine session.")} onClose={onClose}>
    {!objectives.length && <div className="trends-dialog-empty"><h4>{t("Aucun joueur dans l’équipe")}</h4><p>{t("Ajoute les joueurs de l’équipe pour retrouver leurs objectifs individuels. Les consignes par rôle restent disponibles dans Objectifs.")}</p></div>}
    <div className="trends-contracts">{objectives.map((item) => <article key={item.player.id}>
      <header><div><h4>{item.player.name}</h4><p>{item.player.riot_id || t("Riot ID non lié")}</p></div><span>{t(roleLabel(item.role))} · {item.games}{t(item.games > 1 ? " parties" : " partie")}</span></header>
      <div className="trends-contract-content"><div><p className="trends-eyebrow">{t("Objectif")}</p><h5>{t(analysisCopy(item.title))}</h5><p>{t(analysisCopy(item.trigger))}</p></div><div><p className="trends-eyebrow">{t("Cible et exercice")}</p><h5>{t(analysisCopy(item.target).replaceAll("<=", "≤").replaceAll(">=", "≥"))}</h5><p>{t(analysisCopy(item.drill))}</p></div></div>
      <button type="button" className="trends-text-action" onClick={() => onOpenSources({ title: `Sources ${item.player.name}`, subtitle: item.title, games: item.sourceGames })}><FileText aria-hidden="true" />{t(" Voir les parties sources")}</button>
    </article>)}</div>
  </TrendsDialog>;
}
