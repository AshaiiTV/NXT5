import React, { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button, SkeletonRows, TextInput } from "../../components/ui/Core.jsx";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";

const localDate = value => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16);
};

export default function NexusScheduleEditor({ fixture, refreshToken = 0, busy, request, action, onDirtyChange, onSaved, onAccessLost }) {
  useLanguage();
  const [rosters, setRosters] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [form, setForm] = useState({ startsAt: localDate(fixture.startsAt), endsAt: localDate(fixture.endsAt), playerIdsA: [], playerIdsB: [], informed: false });
  const [dirty, setDirty] = useState(false);
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setRosters(null);
    request(`nexus-admin?fixtureId=${encodeURIComponent(fixture.id)}`, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      setRosters({ A: result.rosterA || [], B: result.rosterB || [] });
      const selected = side => (result[`roster${side}`] || []).filter(player => (fixture.roster || []).some(id => id.toLocaleLowerCase() === player.riotId?.toLocaleLowerCase())).map(player => player.id);
      setForm(previous => ({ ...previous, playerIdsA: selected("A"), playerIdsB: selected("B") }));
    }).catch(issue => { if (!controller.signal.aborted) {setError(issue.message || t("Chargement impossible. Réessaie."));if(issue.status===401 || issue.status===403)onAccessLost?.();} }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [fixture.id, request, retry, refreshToken]);
  const change = (key, value) => { setDirty(true); setForm(previous => ({ ...previous, [key]: value })); };
  function toggle(side, id) {
    const key = `playerIds${side}`;
    const current = form[key];
    if (current.includes(id)) change(key, current.filter(value => value !== id));
    else if (current.length < 5) change(key, [...current, id]);
  }
  function submit(event) {
    event.preventDefault();
    const start = Date.parse(form.startsAt), end = Date.parse(form.endsAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end-start > 48*3600000) { setError(t("Choisis une fenêtre de collecte de 48 heures maximum, avec une fin après le début.")); return; }
    if (form.playerIdsA.length !== 5 || form.playerIdsB.length !== 5) { setError(t("Sélectionne cinq joueurs dans chaque équipe.")); return; }
    if (!form.informed) { setError(t("Confirme que les joueurs ont été informés de la collecte des statistiques.")); return; }
    setError("");
    action({ action: "scheduleFixture", fixtureId: fixture.id, startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), playerIdsA: form.playerIdsA, playerIdsB: form.playerIdsB }, () => { setDirty(false); onSaved?.(); });
  }
  return <details className="nexus-roster nexus-programming" open={!fixture.rosterReady || undefined}><summary>{t(fixture.rosterReady ? "Modifier la programmation et les joueurs" : "Programmer la rencontre")}</summary>
    {loading && <div role="status" aria-label={t("Chargement des effectifs")}><SkeletonRows count={2} /></div>}
    {error && <p className="nexus-message nexus-error" role="alert">{error}</p>}
    {!loading && !rosters && error && <Button variant="ghost" onClick={()=>setRetry(value=>value+1)} disabled={busy}>{t("Réessayer")}</Button>}
    {rosters && <form className="nexus-form" aria-label={t("Programmer la rencontre")} onSubmit={submit}>
      <div className="nexus-form-grid"><TextInput label={t("Début de la collecte")} type="datetime-local" value={form.startsAt} onChange={value => change("startsAt",value)} disabled={busy} required /><TextInput label={t("Fin de la collecte")} type="datetime-local" value={form.endsAt} onChange={value => change("endsAt",value)} disabled={busy} required /></div>
      <p className="nexus-muted">{t("Horaires dans le fuseau de ton navigateur. La fenêtre doit couvrir la totalité des parties (48 heures maximum). Serveur EUW.")}</p>
      <div className="nexus-form-grid">{["A","B"].map(side => <fieldset className="nexus-lineup" key={side}><legend>{fixture[`team${side}`]} · {form[`playerIds${side}`].length}/5</legend>{!rosters[side].length && <p className="nexus-muted">{t("Aucun joueur disponible dans cet effectif NXT5.")}</p>}{rosters[side].map(player => <label key={player.id} className="nexus-lineup-player"><input type="checkbox" checked={form[`playerIds${side}`].includes(player.id)} disabled={busy || !player.riotId || (!form[`playerIds${side}`].includes(player.id) && form[`playerIds${side}`].length >= 5)} onChange={() => toggle(side,player.id)} /><span><strong>{player.name}</strong><small>{player.riotId || t("Riot ID à compléter dans NXT5")}{player.role ? ` · ${player.role}` : ""}</small></span></label>)}</fieldset>)}</div>
      <p className="nexus-muted">{t("Les joueurs proviennent de l’effectif NXT5. La composition enregistrée sera utilisée pour vérifier les parties de cette rencontre.")}</p>
      <label className="nexus-checkbox"><input type="checkbox" checked={form.informed} onChange={event => change("informed", event.target.checked)} required disabled={busy} /><span>{t("Les joueurs ont été informés de la collecte pour Nexus Rising, des résultats publics et de l’accès aux statistiques par le staff et les équipes concernées.")}</span></label>
      <div><Button type="submit" icon={CalendarDays} disabled={busy || form.playerIdsA.length !== 5 || form.playerIdsB.length !== 5 || !form.informed}>{t("Enregistrer la programmation")}</Button></div>
    </form>}
  </details>;
}
