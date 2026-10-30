import React, { useEffect, useState } from "react";
import { Download, FileImage, RefreshCw, Search } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { Badge, Button, PageHeader, ReadingDetails, SelectInput, SkeletonRows, Surface, TextInput } from "../../components/ui/Core.jsx";
import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import { pngBackground,pngCreateCanvas,pngDownload,pngFitText,pngFooter,pngHeader,pngLoadImage,pngPanel } from "../../utils/png-report.js";
import "./global-stats.css";

const number=value=>new Intl.NumberFormat(getLocale()).format(Number(value || 0));
const percent=value=>value==null ? "—":new Intl.NumberFormat(getLocale(),{maximumFractionDigits:1}).format(value)+" %";
const modeLabel=mode=>t({played:"Champions joués",picks:"Picks en draft",bans:"Bans en draft",gameBans:"Bans en partie"}[mode]);
const populationFor=(data,mode)=>({played:data.coverage.selections,gameBans:data.coverage.banGames,picks:data.coverage.pickDrafts,bans:data.coverage.banDrafts})[mode];
const periodLabel=data=>`${new Intl.DateTimeFormat(getLocale(),{dateStyle:"medium",timeZone:"UTC"}).format(new Date(data.period.from))} – ${new Intl.DateTimeFormat(getLocale(),{dateStyle:"medium",timeZone:"UTC"}).format(new Date(data.period.to))} UTC`;

export async function exportGlobalStats(data,mode,format="portrait") {
  await document.fonts?.ready;
  const height=format==="story" ? 1920:1350;
  const {canvas,ctx}=pngCreateCanvas(1080,height);
  const logo=await pngLoadImage("/assets/nxt5-wordmark.png");
  pngBackground(ctx,1080,height);
  pngHeader(ctx,{width:1080,title:modeLabel(mode),subtitle:t("Les tendances de l’échantillon NXT5"),logo});
  pngFitText(ctx,periodLabel(data),64,248,952,{font:"500 22px Inter, Arial, sans-serif",color:"#CBD5E1"});
  const population=populationFor(data,mode);
  const source=mode==="played" ? t("{0} sélections · {1} parties uniques",[number(population),number(data.coverage.games)]):mode==="gameBans" ? t("{0} parties avec bans complets",[number(population)]):t("{0} drafts avec données exploitables",[number(population)]);
  pngFitText(ctx,source,64,290,952,{font:"600 24px Inter, Arial, sans-serif",color:"#67E8F9"});
  pngFitText(ctx,`${t("Patch")} ${data.period.patch || t("Tous")} · ${mode==="played" ? data.period.role==="ALL" ? t("Tous les postes"):data.period.role:t("Les deux camps")}`,64,326,952,{font:"500 20px Inter, Arial, sans-serif",color:"#AFBFD3"});
  const rows=data[mode].slice(0,format==="story" ? 10:8);
  const rowHeight=format==="story" ? 128:96;
  const max=Math.max(1,...rows.map(row=>mode==="played" ? row.picks:row.count));
  rows.forEach((row,index)=>{
    const y=366+index*rowHeight;
    pngPanel(ctx,64,y,952,rowHeight-12,{material:"reading",fill:"#1E293B",radius:16});
    pngFitText(ctx,String(index+1).padStart(2,"0"),88,y+38,48,{font:"600 22px Inter, Arial, sans-serif",color:"#C4B5FD"});
    pngFitText(ctx,row.name,156,y+38,570,{font:"650 27px Inter, Arial, sans-serif"});
    const count=mode==="played" ? row.picks:row.count;
    pngFitText(ctx,`${number(count)} · ${percent(row.rate)}`,992,y+38,260,{font:"600 24px Inter, Arial, sans-serif",align:"right",color:"#67E8F9"});
    ctx.fillStyle="#29384D";ctx.fillRect(156,y+54,650,5);
    ctx.fillStyle=mode==="bans" ? "#E879F9":"#67E8F9";ctx.fillRect(156,y+54,650*count/max,5);
  });
  pngFitText(ctx,mode==="played" ? t("Part des sélections, pas taux de présence en partie."):mode==="gameBans" ? t("Présence dans les parties avec bans complets."):t("Présence dans les drafts complètes pour cette mesure."),64,height-132,952,{font:"500 20px Inter, Arial, sans-serif",color:"#CBD5E1"});
  pngFitText(ctx,t("Imports NXT5 sur cette période. Cet échantillon ne représente pas tout LoL."),64,height-96,952,{font:"500 18px Inter, Arial, sans-serif",color:"#AFBFD3"});
  pngFooter(ctx,{width:1080,height,label:"nxt5.org"});
  await pngDownload(canvas,`nxt5-${mode}-${data.period.patch || "tous-patchs"}-${data.period.to.slice(0,10)}.png`);
}

function exportCsv(data,mode) {
  const quote=value=>'"'+String(value ?? '').replaceAll('"','""')+'"';
  const lines=[['NXT5',mode,periodLabel(data),data.period.patch || 'Tous',mode==='played' ? data.period.role:'ALL'],
    ['Champion','Nombre','Part (%)','Victoires','Résultats connus','Taux de victoire (%)'],
    ...data[mode].map(row=>[row.name,mode==='played' ? row.picks:row.count,row.rate?.toFixed(2),row.wins,row.knownResults,row.winRate?.toFixed(2)])];
  const blob=new Blob(['\ufeff'+lines.map(row=>row.map(quote).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`nxt5-${mode}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function GlobalStatsPage() {
  useLanguage();
  const [days,setDays]=useState("30"),[patch,setPatch]=useState(""),[role,setRole]=useState("ALL");
  const [mode,setMode]=useState("played"),[search,setSearch]=useState(""),[sort,setSort]=useState("count"),[format,setFormat]=useState("portrait");
  const [data,setData]=useState(null),[patches,setPatches]=useState([]),[error,setError]=useState("");
  const [busy,setBusy]=useState(false),[revision,setRevision]=useState(0),[status,setStatus]=useState("");
  useEffect(()=>{
    const controller=new AbortController();setData(null);setError("");setStatus("");
    const query=new URLSearchParams({days,patch,role});
    apiFetch(`admin-global-stats?${query}`,{signal:controller.signal,timeoutMs:30000})
      .then(result=>{
        if (![result.played,result.picks,result.bans,result.gameBans].every(Array.isArray)
          || !result.coverage || !Number.isFinite(Date.parse(result.period?.from)) || !Number.isFinite(Date.parse(result.period?.to)))
          throw new Error(t("Les données statistiques sont incomplètes. Réessaie."));
        if (!controller.signal.aborted) {setData(result);setPatches(result.patches || []);}
      })
      .catch(err=>{if(!controller.signal.aborted)setError(err.message);});
    return()=>controller.abort();
  },[days,patch,role,revision]);
  async function png() {
    if (!data || busy) return;
    setBusy(true);setError("");setStatus("");
    try {await exportGlobalStats(data,mode,format);setStatus(t("Visuel téléchargé."));}
    catch(err){setError(err.message);}
    finally{setBusy(false);}
  }
  const all=data?.[mode] || [];
  const rows=all.filter(row=>row.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).toSorted((a,b)=>sort==="name" ? a.name.localeCompare(b.name):sort==="winRate" ? (b.winRate ?? -1)-(a.winRate ?? -1) || b.picks-a.picks:((mode==="played" ? b.picks:b.count)-(mode==="played" ? a.picks:a.count)) || a.name.localeCompare(b.name));
  const coverage=data?.coverage;
  const denominator=data ? populationFor(data,mode):0;
  return <div className="admin-directory-stack global-stats" data-mode={mode}>
    <PageHeader title={t("Stats globales")} subtitle={t("Les champions joués, sélectionnés et bannis dans les données NXT5. Prépare tes contenus pour les réseaux.")}><Button variant="ghost" icon={RefreshCw} disabled={!data && !error} onClick={()=>setRevision(value=>value+1)}>{t("Actualiser")}</Button></PageHeader>
    <Surface variant="reading" className="global-stats-filters"><SelectInput label={t("Période des imports")} value={days} onChange={setDays}>{[["7","7 jours"],["30","30 jours"],["90","90 jours"],["365","1 an"],["0","Tout l’historique"]].map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</SelectInput><SelectInput label={t("Patch")} value={patch} onChange={setPatch}><option value="">{t("Tous les patchs")}</option>{[...new Set([...patches,...(patch ? [patch]:[])])].map(value=><option key={value}>{value}</option>)}</SelectInput><SelectInput label={t("Poste dans les parties jouées")} value={role} onChange={setRole} disabled={mode!=="played"}>{["ALL","TOP","JGL","MID","ADC","SUP"].map(value=><option key={value} value={value}>{value==="ALL" ? t("Tous les postes"):value}</option>)}</SelectInput></Surface>
    <div className="global-stats-tabs" role="group" aria-label={t("Mesure des champions")}>{["played","gameBans","picks","bans"].map(value=><button key={value} type="button" aria-pressed={mode===value} onClick={()=>{setMode(value);setSort("count");}}>{modeLabel(value)}</button>)}</div>
    {error && <div role="alert" className="admin-directory-error">{t(error)} <Button variant="ghost" onClick={()=>setRevision(value=>value+1)}>{t("Réessayer")}</Button></div>}
    {!data ? !error && <SkeletonRows count={5} /> : <>
      <div className="global-stats-summary"><div><span>{t("Parties uniques")}</span><strong>{number(coverage.games)}</strong><small>{t("Les copies entre équipes sont regroupées.")}</small></div><div><span>{mode==="played" ? t("Sélections au poste choisi"):mode==="gameBans" ? t("Parties avec bans complets"):t("Drafts exploitables pour cette mesure")}</span><strong>{number(denominator)}</strong><small>{mode==="played" ? t("Les deux équipes sont incluses."):mode==="gameBans" ? t("Un champion compte au plus une fois par partie."):t("Un champion compte au plus une fois par draft.")}</small></div><div><span>{t("Champions observés")}</span><strong>{number(all.length)}</strong><small>{periodLabel(data)}</small></div></div>
      <div className="global-stats-layout"><Surface variant="reading" className="admin-directory-panel"><div className="global-stats-table-heading"><h3>{modeLabel(mode)}</h3><Badge tone="cyan">{t("Échantillon NXT5")}</Badge></div><div className="global-stats-tools"><TextInput label={t("Rechercher un champion")} icon={Search} type="search" value={search} onChange={setSearch} /><SelectInput label={t("Classer par")} value={sort} onChange={setSort}><option value="count">{t("Nombre de sélections")}</option><option value="name">{t("Nom")}</option>{mode==="played" && <option value="winRate">{t("Taux de victoire")}</option>}</SelectInput></div>
        {rows.length ? <div className="global-stats-ranking" role="table" aria-label={modeLabel(mode)} aria-colcount={mode==="played" ? 4:3}><div className="global-stats-ranking-head" role="row"><span role="columnheader">{t("Champion")}</span><span role="columnheader">{mode==="played" ? t("Sélections"):mode==="gameBans" ? t("Parties"):t("Drafts")}</span><span role="columnheader">{t("Part")}</span>{mode==="played" && <span role="columnheader">{t("Victoires / résultats connus")}</span>}</div>{rows.map((row,index)=><div key={row.champion} className="global-stats-rank" role="row"><div role="rowheader"><span className="global-stats-rank-number">{index+1}</span><strong>{row.name}</strong></div><span role="cell" data-label={mode==="played" ? t("Sélections"):mode==="gameBans" ? t("Parties"):t("Drafts")}>{number(mode==="played" ? row.picks:row.count)}</span><span role="cell" data-label={t("Part")}>{percent(row.rate)}</span>{mode==="played" && <span role="cell" data-label={t("Taux de victoire")}>{percent(row.winRate)}<small>{number(row.wins)} / {number(row.knownResults)}</small></span>}</div>)}</div>:<p className="admin-empty-copy">{t("Aucune donnée exploitable avec ces filtres.")}</p>}
      </Surface><aside className="global-stats-export"><Surface variant="reading" className="admin-directory-panel"><FileImage size={28} aria-hidden="true" /><h3>{t("Prêt pour tes réseaux")}</h3><p>{t("Exporte le classement complet en CSV ou les premiers champions dans un visuel NXT5.")}</p><SelectInput label={t("Format du visuel")} value={format} onChange={setFormat}><option value="portrait">{t("Post · 1080 × 1350")}</option><option value="story">{t("Story · 1080 × 1920")}</option></SelectInput><p className="global-stats-export-note">{t("L’export utilise les filtres de période et de patch. La recherche et le tri du tableau ne modifient pas le classement exporté.")}</p><Button icon={FileImage} disabled={busy || !all.length} onClick={png}>{busy ? t("Création du visuel…"):t("Télécharger le PNG")}</Button><Button variant="ghost" icon={Download} disabled={!all.length} onClick={()=>exportCsv(data,mode)}>{t("Télécharger le CSV")}</Button>{status && <p role="status">{status}</p>}</Surface></aside></div>
      <ReadingDetails className="global-stats-method" title={t("Lire ces chiffres")}><p>{mode==="played" ? t("Les sélections proviennent des participants des parties importées. La part compare les sélections d’un champion à toutes les sélections du poste choisi. Le taux de victoire utilise seulement les résultats connus."):mode==="gameBans" ? t("Les bans des parties proviennent des données Riot importées. Seules les parties avec dix emplacements de ban connus sont incluses. Un emplacement explicitement passé est accepté ; une donnée manquante est exclue."):t("Les picks et bans proviennent des drafts Drafter importées, regroupées par source et numéro de partie. Les deux camps sont inclus. Un ban inconnu n’est jamais compté comme un ban absent.")}</p><p>{t("La période correspond à la date d’import, pas à la date de la partie. Les bans ne sont pas filtrés par poste. Cet échantillon décrit NXT5 et ne représente pas tout League of Legends.")}</p><p>{t("{0} draft(s) importée(s), {1} avec picks complets, {2} avec bans complets. {3} sélection(s) de champion non reconnu exclue(s).",[coverage.totalDrafts,coverage.pickDrafts,coverage.banDrafts,coverage.unknownSelections])}</p></ReadingDetails>
    </>}
  </div>;
}
