'use client';
import {useState} from 'react';
type Year={id:string;fiscal_year:number};
type Row={uid:number;uidValidity:string;code:string;intakes:{id:string;duplicate:boolean}[]};
const labels:Record<string,string>={retained:'PDFs klaar voor beoordeling',partial:'Deels verwerkt — probeer deze batch opnieuw',needs_attention:'Controle nodig; de e-mail blijft in de inbox',no_pdf:'Geen PDF-bijlage',message_too_large:'E-mail is te groot',invalid_uid:'Bericht kon niet worden geselecteerd',error:'Verwerking niet voltooid'};
export default function MailboxImportForm({years,ready}:{years:Year[];ready:boolean}){
 const [year,setYear]=useState(''),[after,setAfter]=useState(0),[busy,setBusy]=useState(false),[rows,setRows]=useState<Row[]>([]),[message,setMessage]=useState('');
 async function run(cursor:number){
  setBusy(true);setMessage('');
  try{
   const response=await fetch('/admin/workspaces/accountancy/purchases/mailbox-import?year='+encodeURIComponent(year)+'&after='+cursor,{method:'POST'});
   const result=await response.json();
   if(!response.ok||!Array.isArray(result.messages))throw Error();
   setRows(result.messages);setAfter(cursor);
   setMessage(result.messages.length?'De e-mails blijven in de inbox. Controleer de originele PDFs en het boekjaar voordat je een concept bevestigt.':'Geen volgende berichten gevonden.');
  }catch{setMessage('Import niet voltooid. Je kunt dezelfde batch opnieuw proberen; e-mails blijven in de inbox.');}
  finally{setBusy(false);}
 }
 const next=rows.length?Math.max(...rows.map(row=>row.uid)):after;
 return <section>
  <h2>PDF-bijlagen inlezen</h2>
  <p>Lees maximaal vijf e-mails per keer in voor Mase Estates SL. Kies het boekjaar dat op de facturen staat. De gegevens worden eerst ter beoordeling klaargezet.</p>
  {!ready&&<p>De import is nog niet ingeschakeld. De scanner en de administratie moeten eerst worden ingesteld.</p>}
  <label>Boekjaar <select value={year} disabled={busy||!ready} onChange={e=>{setYear(e.target.value);setAfter(0);setRows([]);setMessage('');}}>
   <option value="">Kies een boekjaar</option>{years.map(y=><option key={y.id} value={y.id}>{y.fiscal_year}</option>)}
  </select></label>
  <p><button disabled={!ready||!year||busy} onClick={()=>run(after)}>{busy?'Bezig met inlezen…':'Deze batch inlezen / opnieuw proberen'}</button>{rows.length>0&&<button disabled={busy||next<=after} onClick={()=>run(next)}>Volgende batch</button>}</p>
  <p role="status">{message}</p>
  <ul>{rows.map(row=><li key={row.uidValidity+':'+row.uid}>Bericht {row.uid}: {labels[row.code]??labels.error}<ul>{row.intakes.map((i,n)=><li key={i.id+':'+n}><a href={'/admin/workspaces/accountancy/purchases/'+i.id}>{i.duplicate?'Bestaande PDF bekijken':'PDF beoordelen'}</a></li>)}</ul></li>)}</ul>
 </section>;
}
