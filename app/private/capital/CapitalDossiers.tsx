'use client';
import {useEffect,useState} from 'react';
import {createClient} from '../../../lib/supabase/client';
import SummaryCards,{type Summary} from './SummaryCards';
import s from './summary.module.css';
export default function CapitalDossiers(){
 const [items,setItems]=useState<Summary[]>([]);
 const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
 useEffect(()=>{
  let live=true;const db=createClient();
  async function load(){
   try{
    const response=await fetch('/api/capital-client-summary',{cache:'no-store'});
    const payload=await response.json();
    if(!live)return;
    if(!response.ok){setItems([]);setState('error');return;}
    setItems((payload.items||[]) as Summary[]);setState('ready');
   }catch{if(live){setItems([]);setState('error');}}
  }
  void load();
  const {data:{subscription}}=db.auth.onAuthStateChange(event=>{
   if(event==='SIGNED_OUT'&&live){live=false;setItems([]);setState('error');}
  });
  return ()=>{live=false;subscription.unsubscribe();};
 },[]);
 return <section aria-labelledby="capital-dossiers-heading" aria-busy={state==='loading'}>
  <p className={s.eyebrow}>YOUR PRIVATE DOSSIERS</p><h2 id="capital-dossiers-heading">Your Capital dossiers</h2>
  {state==='loading'?<p className={s.note} role="status">Loading your dossiers…</p>:state==='error'?<p className={s.note} role="alert">Your dossiers could not be loaded. Please refresh the page to try again.</p>:items.length?<SummaryCards items={items}/>:<p className={s.note}>No loan dossiers have been shared with you yet.</p>}
 </section>;
}
