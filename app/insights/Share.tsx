'use client';
import {useEffect,useState} from 'react';
import type {ShareLabels} from '../../lib/insights/share';
import s from './share.module.css';

export default function Share({url,title,labels}:{url:string;title:string;labels:ShareLabels}) {
 const [native,setNative]=useState(false),[status,setStatus]=useState(''),[manual,setManual]=useState(false);
 useEffect(()=>{setNative(typeof navigator.share==='function');},[]);
 const encoded=encodeURIComponent(url),text=encodeURIComponent(title);
 const links=[
  ['LinkedIn',`https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`],
  ['Facebook',`https://www.facebook.com/sharer/sharer.php?u=${encoded}`],
  ['WhatsApp',`https://wa.me/?text=${encodeURIComponent(title+' '+url)}`],
  ['X',`https://twitter.com/intent/tweet?text=${text}&url=${encoded}`],
 ];
 async function copy(){
  try{await navigator.clipboard.writeText(url);setStatus(labels.copied);setManual(false);}
  catch{setManual(true);setStatus(labels.manual);}
 }
 async function share(){
  try{await navigator.share({title,url});}
  catch(error){if(error instanceof Error&&error.name==='AbortError')return;await copy();}
 }
 return <section className={s.share} aria-label={labels.heading}>
  <p className={s.label}>{labels.heading}</p>
  <div className={s.buttons}>
   {links.map(([name,href])=><a key={name} href={href} target="_blank" rel="noopener noreferrer" aria-label={`${labels.heading}: ${name}`}>{name}</a>)}
   <button type="button" onClick={copy}>{labels.copy}</button>
   {native&&<button type="button" onClick={share}>{labels.more}</button>}
  </div>
  <p className={s.status} role="status" aria-live="polite">{status}</p>
  {manual&&<input className={s.url} aria-label={labels.copy} readOnly value={url} onFocus={e=>e.currentTarget.select()}/>}
 </section>;
}
