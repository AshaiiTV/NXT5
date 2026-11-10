import React, { useEffect, useRef, useState } from "react";
import { Check, Users } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { Badge, Button, SelectInput, SkeletonRows, Surface } from "../../components/ui/Core.jsx";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";

export default function NexusRegistration({ onClose, onAccessLost, request = apiFetch }) {
  useLanguage();
  const [data, setData] = useState(null);
  const [seasonId,setSeasonId] = useState("");
  const [teamId,setTeamId] = useState("");
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const lock = useRef(false);
  const mounted = useRef(true);
  function fail(issue) {
    if(!mounted.current)return;
    if(issue.status===401 || ["NEXUS_COMING_SOON","PLATFORM_ADMIN_FORBIDDEN"].includes(issue.code)) {
      setData(null);setSeasonId("");setTeamId("");setNotice("");setError("");
      onAccessLost?.();
    } else setError(issue.message || t("Chargement impossible. Réessaie."));
  }
  async function load(signal) {
    const result = await request("nexus-registration",{signal});
    if (signal?.aborted || !mounted.current) return;
    setData(result); setSeasonId(current => current || result.seasons?.[0]?.id || ""); setTeamId(current => current || result.teams?.[0]?.id || "");
  }
  useEffect(()=>{
    mounted.current = true;
    const controller = new AbortController();
    load(controller.signal).catch(issue=>{if(!controller.signal.aborted)fail(issue);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>{mounted.current=false;controller.abort();};
  },[]);
  async function register(event) {
    event.preventDefault();
    if (lock.current || !seasonId || !teamId) return;
    lock.current=true;setBusy(true);setError("");setNotice("");
    try {
      await request("nexus-registration",{method:"POST",body:JSON.stringify({action:"register",seasonId,teamId})});
      if(!mounted.current)return;
      setNotice(t("Candidature envoyée. Le staff Nexus Rising va l’examiner."));
      await load();
    } catch(issue){fail(issue);}
    finally {lock.current=false;if(mounted.current)setBusy(false);}
  }
  const existing = data?.registrations?.find(row=>row.seasonId===seasonId&&row.teamId===teamId);
  return <Surface variant="reading" className="nexus-card nexus-registration"><div className="nexus-section-title"><h2>{t("Inscrire mon équipe NXT5")}</h2><Button variant="ghost" disabled={busy} onClick={onClose}>{t("Fermer")}</Button></div>
    <p className="nexus-muted">{t("Utilise ton équipe et son effectif NXT5. Seuls ses responsables peuvent envoyer sa candidature.")}</p>
    {loading&&<div role="status" aria-label={t("Chargement de mes équipes")}><SkeletonRows count={2}/></div>}
    {error&&<p className="nexus-message nexus-error" role="alert">{error}</p>}{notice&&<p className="nexus-message" role="status">{notice}</p>}
    {data && (!data.teams?.length ? <p className="nexus-empty-copy">{t("Aucune équipe à inscrire. Rejoins son encadrement ou crée-la dans NXT5.")}</p> : !data.seasons?.length ? <p className="nexus-empty-copy">{t("Aucune saison n’accepte d’inscriptions pour le moment.")}</p> : <form className="nexus-form" onSubmit={register} aria-label={t("Inscription Nexus Rising")}><div className="nexus-form-grid"><SelectInput label={t("Saison")} value={seasonId} onChange={setSeasonId} disabled={busy}>{data.seasons.map(season=><option key={season.id} value={season.id}>{season.name}</option>)}</SelectInput><SelectInput label={t("Mon équipe NXT5")} value={teamId} onChange={setTeamId} disabled={busy}>{data.teams.map(team=><option key={team.id} value={team.id}>{team.name}</option>)}</SelectInput></div>{existing&&<Badge tone={existing.status==="approved"?"green":existing.status==="rejected"?"red":"yellow"}>{t(existing.status==="approved"?"Candidature acceptée":existing.status==="rejected"?"Candidature refusée":"Candidature en attente")}</Badge>}<div><Button icon={existing?Check:Users} type="submit" disabled={busy||!seasonId||!teamId||!!existing}>{t(existing?"Candidature enregistrée":"Envoyer la candidature")}</Button></div></form>)}
  </Surface>;
}
