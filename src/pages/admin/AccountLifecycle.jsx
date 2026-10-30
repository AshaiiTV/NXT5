import React,{useEffect,useRef,useState} from 'react';
import {apiFetch} from '../../api/client.js';
import {Button,Surface,TextInput} from '../../components/ui/Core.jsx';
import {t} from '../../i18n/translate.js';

export default function AccountLifecycle({id,revision,onGuardChange,onDeleted,onUpdated,blocked}) {
  const [data,setData]=useState(null),[error,setError]=useState(''),[action,setAction]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[retry,setRetry]=useState(0);
  const lock=useRef(false),heading=useRef(null),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{onGuardChange({dirty:Boolean(action),disabled:busy});return()=>onGuardChange({dirty:false,disabled:false});},[action,busy,onGuardChange]);
  useEffect(()=>{if(action)heading.current?.focus();},[action]);
  useEffect(()=>{const controller=new AbortController();setData(null);setError('');setAction('');setConfirm('');setUncertain(false);
    apiFetch(`admin-account-lifecycle?userId=${encodeURIComponent(id)}`,{signal:controller.signal}).then(result=>{
      if(result.account?.id!==id || !Array.isArray(result.ownedTeams))throw new Error(t('Le dossier reçu est incomplet. Recharge-le.'));
      if(!controller.signal.aborted)setData(result);
    }).catch(err=>{if(!controller.signal.aborted)setError(err.message);});return()=>controller.abort();
  },[id,revision,retry]);
  async function submit(){
    if(lock.current || uncertain || !data || confirm!==data.account.account_name)return;
    lock.current=true;setBusy(true);setError('');
    try{const result=await apiFetch('admin-account-lifecycle',{method:'POST',body:JSON.stringify({userId:id,action,confirmAccount:confirm,expectedRevision:data.account.revision,expectedOwnedTeams:data.ownedTeams})});
      if(result.ok!==true)throw new Error(t('Résultat incertain. Recharge le dossier avant une nouvelle action.'));
      if(mounted.current){setAction('');if(action==='delete')onDeleted();else onUpdated();}
    }catch(err){if(mounted.current){setError(err.message);setUncertain(true);}}
    finally{lock.current=false;if(mounted.current)setBusy(false);}
  }
  return <Surface variant="reading" className="admin-directory-panel"><h3>{t('État et suppression du compte')}</h3>
    {error && <div className="admin-directory-error" role="alert">{t(error)} <Button variant="ghost" disabled={busy || blocked} onClick={()=>setRetry(value=>value+1)}>{t('Recharger le dossier')}</Button></div>}
    {data && <><p role="status">{t(data.account.suspended_at ? 'Compte suspendu':'Compte actif')}</p><p className="admin-caption">{t('La suspension ferme les sessions et bloque les nouvelles connexions et le bot lié. La réactivation autorise une nouvelle connexion ; les anciennes sessions restent fermées.')}</p>
      {!action ? <div className="admin-team-actions"><Button variant="ghost" disabled={blocked} onClick={()=>{setAction(data.account.suspended_at ? 'resume':'suspend');setConfirm('');}}>{t(data.account.suspended_at ? 'Réactiver le compte':'Suspendre le compte')}</Button><Button variant="danger" disabled={blocked} onClick={()=>{setAction('delete');setConfirm('');}}>{t('Supprimer complètement le compte')}</Button></div>
      :<div className="admin-team-danger"><h4 ref={heading} tabIndex={-1}>{t(action==='delete' ? 'Suppression définitive du compte':action==='suspend' ? 'Confirmer la suspension':'Confirmer la réactivation')}</h4>
        {action==='delete' && <><p>{t('Le compte, ses sessions, ses connexions externes et ses équipes possédées seront supprimés avec leur contenu. Les profils et contributions dans les équipes d’autres personnes sont conservés et déliés. Les traces d’audit restent soumises à leur durée de conservation.')}</p><p>{t('Équipes possédées concernées : {0}',[data.ownedTeams.length])}</p><ul className="admin-related-list">{data.ownedTeams.map(team=><li key={team.id}><div><strong>{team.name}</strong><span>{t('{0} profils · {1} parties',[team.profiles,team.matches])}</span></div></li>)}</ul><p>{t('Cette action est irréversible. Les messages déjà publiés sur Discord restent sur Discord.')}</p></>}
        <p className="admin-caption">{t('Identifiant à saisir : {0}',[data.account.account_name])}</p><TextInput label={t('Saisis l’identifiant exact du compte')} value={confirm} onChange={setConfirm} disabled={busy} autoComplete="off" />
        <div className="admin-team-actions"><Button variant={action==='delete' ? 'danger':'primary'} disabled={busy || blocked || uncertain || confirm!==data.account.account_name} onClick={submit}>{busy ? t('Enregistrement…'):t('Confirmer cette action')}</Button><Button variant="ghost" disabled={busy} onClick={()=>setAction('')}>{t('Annuler')}</Button></div>
      </div>}</>}
  </Surface>;
}
