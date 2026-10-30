import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, RefreshCw, Search, ShieldCheck, UserRound, Users } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { Badge, Button, PageHeader, SkeletonRows, Surface, TextInput } from "../../components/ui/Core.jsx";
import { useAdminNavigationGuard } from "../../components/admin/AdminNavigationContext.jsx";
import { useLanguage } from "../../i18n/useLanguage.js";
import { getLocale } from "../../i18n/locale.js";
import { t } from "../../i18n/translate.js";
import "./admin-directory.css";
import AccountLifecycle from "./AccountLifecycle.jsx";
import { AdminProfileDetail } from "./AdminTeamTools.jsx";

const date = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat(getLocale(), { dateStyle:"medium",timeStyle:"short" }).format(new Date(value)) : "—";
const count = value => new Intl.NumberFormat(getLocale()).format(Number(value || 0));
const accountPath = id => `/admin/comptes?userId=${encodeURIComponent(id)}`;
const TEAM_ROLES = { owner:"Responsable", captain:"Capitaine", coach:"Coach", assistant:"Assistant coach", analyst:"Analyste", manager:"Manager", board:"Direction", member:"Joueur", player:"Joueur" };
const ACTIONS = {
  "auth.register":"Compte créé", "auth.profile_update":"Compte mis à jour", "auth.password_change":"Mot de passe modifié",
  "auth.password_reset_complete":"Mot de passe réinitialisé", "auth.password_reset_request":"Réinitialisation demandée",
  "auth.notification_preferences":"Notifications modifiées", "auth.social_link":"Connexion externe liée",
  "match.import":"Partie importée", "match.import_file":"Partie importée depuis un fichier", "matches.delete":"Partie supprimée",
  "matches.update":"Partie modifiée", "matches.roles":"Postes de la partie corrigés", "matches.side":"Camp de la partie corrigé",
  "team.create":"Équipe créée", "team.update":"Équipe modifiée", "team.delete":"Équipe supprimée",
  "player.create":"Profil créé", "player.update":"Profil modifié", "player.delete":"Profil supprimé",
  "player.link_account":"Compte lié au profil", "player.unlink_account":"Compte délié du profil",
  "reports.create":"Débrief créé", "reports.update":"Débrief modifié", "reports.delete":"Débrief supprimé",
  "player_availability.upsert":"Disponibilités enregistrées", "discord.connected":"Discord connecté", "discord.disconnect":"Discord déconnecté",

  "admin.account.rename":"Nom du compte modifié",
  "admin.sessions.revoke":"Sessions révoquées",
  "admin.account.suspend":"Compte suspendu", "admin.account.resume":"Compte réactivé", "admin.account.delete":"Compte supprimé",
  "admin.team.transfer":"Propriété de l’équipe transférée",
  "admin.team.update":"Équipe modifiée", "admin.team.delete":"Équipe supprimée",
  "admin.member.role":"Droits du membre modifiés", "admin.member.remove":"Accès membre retiré",
  "admin.profile.update":"Profil modifié", "admin.profile.unlink":"Compte délié du profil", "admin.profile.delete":"Profil supprimé",
};
export const actionLabel = action => ACTIONS[action] ? t(ACTIONS[action]) : action;

function AccountDetail({ id, user, navigate }) {
  const [detail,setDetail] = useState(null);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");
  const [name,setName] = useState("");
  const [saving,setBusy] = useState(false);
  const [lifecycle,setLifecycle] = useState({dirty:false,disabled:false});
  const [deleted,setDeleted] = useState(false);
  const busy=saving || lifecycle.disabled;
  const [confirm,setConfirm] = useState(false);
  const [revision,setRevision] = useState(0);
  const heading = useRef(null);
  const confirmButton = useRef(null);
  const ticket = useRef(0);
  const dirty = Boolean(detail && name !== detail.account.name);
  useAdminNavigationGuard({ dirty:!deleted && (dirty || lifecycle.dirty),disabled:busy });
  useEffect(() => { heading.current?.focus(); },[id]);
  useEffect(() => { if (confirm) confirmButton.current?.focus(); },[confirm]);
  useEffect(() => {
    const controller = new AbortController();
    const sequence = ++ticket.current;
    setDetail(null); setError(""); setConfirm(false);
    apiFetch(`admin-directory?userId=${encodeURIComponent(id)}`,{ signal:controller.signal })
      .then(result => {
        if (result.account?.id!==id || ![result.teams,result.profiles,result.activity].every(Array.isArray)) throw new Error(t("La fiche du compte est incomplète. Réessaie."));
        if (!controller.signal.aborted && sequence===ticket.current) { setDetail(result);setName(result.account.name); }
      })
      .catch(err => { if (!controller.signal.aborted && sequence===ticket.current) setError(err.message); });
    return () => { controller.abort();ticket.current++; };
  },[id,revision]);
  async function mutate(action) {
    if (busy || !detail) return;
    setBusy(true);setError("");setMessage("");
    const sequence = ticket.current;
    try {
      const result = await apiFetch("admin-directory",{ method:"POST",body:JSON.stringify({ action,userId:id,name,expectedRevision:detail.account.revision }) });
      if (result.ok!==true) throw new Error(t("Le résultat de l’action est inconnu. Recharge la fiche avant de réessayer."));
      if (sequence!==ticket.current) return;
      setMessage(action==="rename" ? t("Nom du compte enregistré.") : t("{0} session(s) révoquée(s).",[result.revoked]));
      setRevision(value=>value+1);
    } catch(err) {
      if (sequence===ticket.current) {
        setError(err.message);
        // Never repeat an uncertain write automatically. Reload current state.
        setConfirm(false);
      }
    } finally { if (sequence===ticket.current) setBusy(false); }
  }
  if(deleted)return <div className="admin-directory-stack"><p role="status">{t("Compte supprimé.")}</p><Button variant="ghost" onClick={()=>navigate("/admin/comptes")}>{t("Retour à l’annuaire")}</Button></div>;
  return <div className="admin-directory-stack">
    <Button variant="ghost" icon={ArrowLeft} disabled={busy} onClick={()=>navigate("/admin/comptes")}>{t("Retour à l’annuaire")}</Button>
    <PageHeader title={<span ref={heading} tabIndex={-1}>{detail?.account.name || t("Fiche du compte")}</span>} subtitle={detail?.account.email || t("Identité, équipes et sécurité du compte.")} />
    {error && <div role="alert" className="admin-directory-error">{t(error)} <Button variant="ghost" disabled={busy} onClick={()=>setRevision(value=>value+1)}>{t("Recharger la fiche")}</Button></div>}
    {message && <p role="status" className="admin-directory-success"><Check size={18} aria-hidden="true" />{message}</p>}
    {!detail ? !error && <SkeletonRows count={3} /> : <>
      <div className="admin-account-banner"><div className="admin-person-avatar"><UserRound aria-hidden="true" /></div><div><strong>{detail.account.account_name}</strong><p>{t("Compte créé le {0}",[date(detail.account.created_at)])}</p></div><Badge tone={detail.account.email_verified ? "green":"yellow"}>{detail.account.email_verified ? t("E-mail vérifié"):t("E-mail à vérifier")}</Badge></div>
      <div className="admin-account-columns">
        <Surface variant="reading" className="admin-directory-panel"><h3>{t("Identité et sécurité")}</h3>
          <form onSubmit={event=>{ event.preventDefault();void mutate("rename"); }}><TextInput label={t("Nom affiché")} value={name} onChange={setName} minLength={2} maxLength={80} disabled={busy} required /><Button type="submit" disabled={busy || !dirty || name.trim().length<2}>{busy ? t("Enregistrement…"):t("Enregistrer le nom")}</Button></form>
          <dl className="admin-account-facts"><div><dt>{t("Dernière activité")}</dt><dd>{date(detail.account.last_active_at)}</dd></div><div><dt>{t("Sessions actives")}</dt><dd>{count(detail.account.active_sessions)}</dd></div><div><dt>{t("Identifiant du compte")}</dt><dd className="admin-record-id">{detail.account.id}</dd></div></dl>
          {detail.account.id!==user?.id && <div className="admin-account-security"><h4><ShieldCheck size={18} aria-hidden="true" />{t("Déconnecter ce compte")}</h4><p>{t("Ferme ses sessions actives sur tous ses appareils. Le compte pourra se reconnecter.")}</p>{confirm ? <div className="admin-inline-confirm" role="group" aria-label={t("Confirmer la déconnexion")}><p>{t("Confirmer la fermeture des sessions de {0} ?",[detail.account.name])}</p><Button ref={confirmButton} variant="danger" disabled={busy} onClick={()=>mutate("revoke-sessions")}>{t("Révoquer les sessions")}</Button><Button variant="ghost" disabled={busy} onClick={()=>setConfirm(false)}>{t("Annuler")}</Button></div> : <Button variant="ghost" disabled={busy || Number(detail.account.active_sessions)===0} onClick={()=>setConfirm(true)}>{t("Déconnecter les appareils")}</Button>}</div>}
        </Surface>
        <div className="admin-directory-stack"><Surface variant="reading" className="admin-directory-panel"><h3>{t("Équipes et rôles")}</h3>{detail.teams.length ? <ul className="admin-related-list">{detail.teams.map(team=><li key={team.id}><div><strong>{team.name}</strong><span>{team.tag} · {t(TEAM_ROLES[team.role] || team.role)}</span></div><Button icon={ArrowRight} variant="ghost" onClick={()=>navigate(`/admin/equipes?teamId=${encodeURIComponent(team.id)}`)} aria-label={t("Voir l’équipe {0}",[team.name])} /></li>)}</ul>:<p className="admin-empty-copy">{t("Ce compte n’a pas encore rejoint d’équipe.")}</p>}</Surface>
          <Surface variant="reading" className="admin-directory-panel"><h3>{t("Profils liés")}</h3>{detail.profiles.length ? <ul className="admin-related-list">{detail.profiles.map(profile=><li key={profile.id}><div><strong>{profile.name}</strong><span>{profile.role} · {profile.team_name}</span><span>{profile.riot_id || "—"}</span></div><Button variant="ghost" onClick={()=>navigate(`/admin/comptes?profileId=${encodeURIComponent(profile.id)}`)}>{t("Ouvrir le profil")}</Button></li>)}</ul>:<p className="admin-empty-copy">{t("Aucun profil joueur ou staff lié à ce compte.")}</p>}</Surface>
        </div>
      </div>
      {id!==user?.id && <AccountLifecycle navigate={navigate} id={id} revision={revision} onGuardChange={setLifecycle} onDeleted={()=>setDeleted(true)} onUpdated={()=>setRevision(value=>value+1)} blocked={saving || dirty} />}
      <Surface variant="reading" className="admin-directory-panel"><h3>{t("Dernières actions du compte")}</h3><ActivityList rows={detail.activity} /></Surface>
    </>}
  </div>;
}

function ActivityList({ rows=[],navigate }) {
  if (!rows.length) return <p className="admin-empty-copy">{t("Aucune action enregistrée.")}</p>;
  return <ol className="admin-activity-list">{rows.map(row=><li key={row.id}><time dateTime={row.created_at}>{date(row.created_at)}</time><div><strong title={row.action}>{actionLabel(row.action)}</strong><span>{row.actor_name || t("Compte supprimé")}{row.entity_type ? ` · ${row.entity_type}`:""}</span></div>{navigate && row.user_id && <Button variant="ghost" icon={ArrowRight} onClick={()=>navigate(accountPath(row.user_id))} aria-label={t("Ouvrir le compte de {0}",[row.actor_name || row.user_id])} />}</li>)}</ol>;
}

export default function AdminDirectory({ route,navigate,user,journal=false }) {
  useLanguage();
  const params = new URLSearchParams(route.search);
  const selected = params.get("userId");
  const selectedProfile = params.get("profileId");
  const [view,setView] = useState(journal ? "journal":params.get("view")==="profiles" ? "profiles":"accounts");
  const [search,setSearch] = useState(params.get("q") || "");
  const [filter,setFilter] = useState("all");
  const [page,setPage] = useState(1);
  const [data,setData] = useState(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [revision,setRevision] = useState(0);
  useEffect(()=>{ setSearch(new URLSearchParams(route.search).get("q") || ""); },[route.search]);
  useEffect(()=>{ setFilter("all");setPage(1); },[view]);
  useEffect(()=>{ setPage(1); },[search,filter]);
  useEffect(()=>{
    if ((selected || selectedProfile) && !journal) return;
    const controller = new AbortController();
    setLoading(true);setError("");setData(null);
    const timer = setTimeout(()=>{
      const query = new URLSearchParams({ view,q:search,filter,page:String(page) });
      apiFetch(`admin-directory?${query}`,{signal:controller.signal})
        .then(result=>{
          if (!Array.isArray(result.rows) || !Number.isSafeInteger(result.pagination?.total) || result.pagination.total<0) throw new Error(t("Les données de l’annuaire sont incomplètes. Réessaie."));
          if (!controller.signal.aborted) setData(result);
        })
        .catch(err=>{ if (!controller.signal.aborted) setError(err.message); })
        .finally(()=>{ if (!controller.signal.aborted) setLoading(false); });
    },search ? 250:0);
    return ()=>{ clearTimeout(timer);controller.abort(); };
  },[selected,selectedProfile,journal,view,search,filter,page,revision]);
  if (selectedProfile && !journal) return <AdminProfileDetail key={selectedProfile} id={selectedProfile} navigate={navigate} />;
  if (selected && !journal) return <AccountDetail key={selected} id={selected} user={user} navigate={navigate} />;
  const filters = view==="profiles" ? [["all","Tous les profils"],["unlinked","Sans compte lié"],["staff","Encadrement"]] : [["all","Tous les comptes"],["verified","E-mail vérifié"],["unverified","E-mail à vérifier"],["no-team","Sans équipe"]];
  const rows = data?.rows || [];
  const total = data?.pagination.total || 0;
  return <div className="admin-directory-stack">
    <PageHeader title={journal ? t("Journal des actions"):t("Comptes et profils")} subtitle={journal ? t("Retrouve les interventions et les actions enregistrées sur NXT5."):t("Recherche un compte, un joueur ou un membre de l’encadrement.")}><Button variant="ghost" icon={RefreshCw} disabled={loading} onClick={()=>setRevision(value=>value+1)}>{t("Actualiser")}</Button></PageHeader>
    {!journal && <div className="admin-directory-tabs" role="group" aria-label={t("Type d’annuaire")}><button type="button" aria-pressed={view==="accounts"} onClick={()=>setView("accounts")}><Users size={18} aria-hidden="true" />{t("Comptes")}</button><button type="button" aria-pressed={view==="profiles"} onClick={()=>setView("profiles")}><UserRound size={18} aria-hidden="true" />{t("Joueurs et encadrement")}</button></div>}
    <Surface variant="reading" className="admin-directory-panel"><div className="admin-directory-search"><TextInput label={journal ? t("Rechercher une action"):t("Rechercher dans l’annuaire")} type="search" icon={Search} value={search} onChange={setSearch} maxLength={120} placeholder={journal ? t("Compte, action ou identifiant…"):view==="profiles" ? t("Nom, Riot ID, équipe ou e-mail…"):t("Nom, e-mail, pseudo ou identifiant…")} /></div>
      {!journal && <div className="admin-directory-filters" role="group" aria-label={t("Filtres de l’annuaire")}>{filters.map(([id,label])=><button type="button" key={id} aria-pressed={id===filter} onClick={()=>setFilter(id)}>{t(label)}</button>)}</div>}
      <div className="admin-directory-count" role="status" aria-live="polite">{loading ? t("Recherche en cours…"):error ? t("Données indisponibles"):t("{0} résultat(s)",[count(total)])}</div>
      {error ? <p className="admin-directory-error" role="alert">{t(error)} <Button variant="ghost" onClick={()=>setRevision(value=>value+1)}>{t("Réessayer")}</Button></p> : loading ? <SkeletonRows count={5} /> : !rows.length ? <div className="admin-directory-empty"><Search aria-hidden="true" /><h3>{t("Aucun résultat")}</h3><p>{t("Essaie un autre nom ou retire les filtres.")}</p><Button variant="ghost" onClick={()=>{setSearch("");setFilter("all");}}>{t("Réinitialiser la recherche")}</Button></div> : journal ? <ActivityList rows={rows} navigate={navigate} /> : <>
        <div className="admin-directory-table-wrap"><table className="admin-directory-table"><thead><tr><th scope="col">{view==="profiles" ? t("Profil"):t("Compte")}</th><th scope="col">{view==="profiles" ? t("Équipe et poste"):t("Vérification")}</th><th scope="col">{view==="profiles" ? t("Compte lié"):t("Équipes / profils")}</th><th scope="col">{view==="profiles" ? t("Riot ID"):t("Dernière activité")}</th><th scope="col"><span className="sr-only">{t("Actions")}</span></th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><th scope="row"><strong>{row.name}</strong><span>{view==="profiles" ? row.role : row.email || row.account_name}</span></th><td data-label={view==="profiles" ? t("Équipe"):t("Vérification")}>{view==="profiles" ? <><strong>{row.team_name}</strong><span>{row.role}</span></>:<Badge tone={row.email_verified ? "green":"yellow"}>{row.email_verified ? t("Vérifié"):t("À vérifier")}</Badge>}</td><td data-label={view==="profiles" ? t("Compte lié"):t("Équipes / profils")}>{view==="profiles" ? row.email || row.account_name || t("Sans compte lié"):`${count(row.team_count)} / ${count(row.profile_count)}`}</td><td data-label={view==="profiles" ? t("Riot ID"):t("Dernière activité")}>{view==="profiles" ? row.riot_id || "—":date(row.last_active_at)}</td><td><Button variant="ghost" icon={ArrowRight} onClick={()=>navigate(view==="profiles" ? `/admin/comptes?profileId=${encodeURIComponent(row.id)}`:accountPath(row.id))} aria-label={view==="profiles" ? t("Ouvrir le profil de {0}",[row.name]):t("Ouvrir le compte de {0}",[row.name])}>{t("Ouvrir")}</Button></td></tr>)}</tbody></table></div>
      </>}
      {!loading && !error && total>0 && <div className="admin-directory-pagination"><span>{t("Page {0} sur {1}",[page,Math.max(1,Math.ceil(total/20))])}</span><div><Button variant="ghost" icon={ChevronLeft} disabled={page<=1} onClick={()=>setPage(value=>value-1)}>{t("Précédente")}</Button><Button variant="ghost" icon={ChevronRight} disabled={page*20>=total} onClick={()=>setPage(value=>value+1)}>{t("Suivante")}</Button></div></div>}
    </Surface>
  </div>;
}
