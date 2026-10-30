import React,{useEffect,useRef,useState} from 'react';
import {apiFetch} from '../../api/client.js';
import {Button,TextInput} from '../../components/ui/Core.jsx';
import {t} from '../../i18n/translate.js';
export default function TeamOwnerTransfer({team,busy,uncertain,onSubmit,onCancel}){
  const [q,setQ]=useState(''),[rows,setRows]=useState([]),[selected,setSelected]=useState(null),[confirm,setConfirm]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const title=useRef(null);useEffect(()=>{title.current?.focus();},[]);
  useEffect(()=>{const controller=new AbortController();setRows([]);setSelected(null);setConfirm('');setError('');
    if(q.trim().length<2){setLoading(false);return;}
    setLoading(true);const timer=setTimeout(()=>apiFetch(`admin-team-transfer?${new URLSearchParams({teamId:team.id,q})}`,{signal:controller.signal}).then(data=>{
      if(!Array.isArray(data.rows))throw new Error(t('Le dossier reçu est incomplet. Recharge-le.'));
      if(!controller.signal.aborted)setRows(data.rows);
    }).catch(err=>{if(!controller.signal.aborted)setError(err.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);}),250);
    return()=>{clearTimeout(timer);controller.abort();};
  },[q,team.id]);
  return <div className="admin-team-form"><h4 ref={title} tabIndex={-1}>{t('Transférer la propriété de l’équipe')}</h4>
    <p>{t('Les parties, profils, débriefs et autres données restent dans la même équipe. Le destinataire devient propriétaire et capitaine ; l’ancien propriétaire devient membre joueur. Aucun profil n’est réattribué.')}</p>
    <TextInput label={t('Rechercher le nouveau propriétaire')} placeholder={t('Nom, identifiant ou e-mail…')} value={q} onChange={setQ} maxLength={120} disabled={busy} type="search" />
    <p className="admin-caption">{t('Comptes actifs avec e-mail vérifié uniquement. Saisis au moins deux caractères ; 20 résultats maximum.')}</p>
    {error && <p role="alert" className="admin-directory-error">{t(error)}</p>}
    {loading ? <p role="status">{t('Recherche en cours…')}</p>:q.trim().length>=2 && !error && <><p role="status">{t('{0} résultat(s)',[rows.length])}</p><ul className="admin-related-list">{rows.map(row=><li key={row.id}><div><strong>{row.name}</strong><span>{row.account_name} · {row.email}</span></div><Button variant="ghost" disabled={busy} aria-pressed={selected?.id===row.id} onClick={()=>{setSelected(row);setConfirm('');}}>{t(selected?.id===row.id ? 'Sélectionné':'Choisir')}</Button></li>)}</ul></>}
    {selected && <><p>{t('Nouveau propriétaire : {0} ({1})',[selected.name,selected.email])}</p><TextInput label={t('Saisis le nom exact pour confirmer')} value={confirm} onChange={setConfirm} disabled={busy} autoComplete="off" /><div className="admin-team-actions"><Button disabled={busy || uncertain || confirm!==team.name} onClick={()=>onSubmit({newOwnerId:selected.id,expectedNewOwnerRevision:selected.revision,expectedOwnerId:team.owner_id,confirmName:confirm})}>{busy ? t('Enregistrement…'):t('Confirmer le transfert')}</Button></div></>}
    <Button variant="ghost" disabled={busy} onClick={onCancel}>{t('Annuler')}</Button>
  </div>;
}
