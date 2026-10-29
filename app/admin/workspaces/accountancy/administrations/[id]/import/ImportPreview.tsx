'use client';
import {useMemo,useRef,useState} from 'react';
import {useAdminI18n} from '../../../../../../../lib/admin/i18n';
import {costCategories} from '../../../../../../../lib/accountancy/administration';
import {parseImportCsv,defaultMapping,previewImport,importFields,MAX_IMPORT_BYTES,type CsvTable,type Mapping,type ImportContext,type ImportField} from '../../../../../../../lib/accountancy/import-preview';
import s from '../../administration.module.css';
export default function ImportPreview({context}:{context:ImportContext}){
 const {t,locale}=useAdminI18n();
 const [raw,setRaw]=useState(''),[delimiter,setDelimiter]=useState(';'),[decimal,setDecimal]=useState<'.'|','>('.'),[dateFormat,setDateFormat]=useState<'iso'|'dmy'>('iso');
 const [table,setTable]=useState<CsvTable|null>(null),[mapping,setMapping]=useState<Mapping|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const fileVersion=useRef(0);
 const clear=()=>{setTable(null);setMapping(null);setError('');};
 async function readFile(file:File|undefined){const version=++fileVersion.current;clear();setRaw('');if(!file){setBusy(false);return;}if(file.size>MAX_IMPORT_BYTES){setBusy(false);setError('Invalid file or file exceeds 2 MB.');return;}setBusy(true);try{const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());if(version===fileVersion.current)setRaw(text);}catch{if(version===fileVersion.current)setError('Use a UTF-8 CSV file.');}finally{if(version===fileVersion.current)setBusy(false);}}
 function parse(){clear();try{const parsed=parseImportCsv(raw,delimiter);setTable(parsed);setMapping(defaultMapping(parsed.headers));}catch(e){setError((e as Error).message);}}
 const result=useMemo(()=>{if(!table||!mapping)return null;try{return {value:previewImport(table,mapping,context,decimal,dateFormat),error:''};}catch(e){return {value:null,error:(e as Error).message};}},[table,mapping,context,decimal,dateFormat]);
 const money=(c:number)=>new Intl.NumberFormat(locale,{style:'currency',currency:'EUR'}).format(c/100);
 return <>
 <p className={s.notice}>{t('Preview only. The file stays in this browser and is not saved or imported. No invoices, payments or emails are created.')}</p>
 <p>{t('Use one entity and financial year per file. Maximum 1,000 rows and 2 MB, UTF-8 CSV. Convert Excel files to CSV first.')}</p>
 <div className={s.panel}><div className={s.form}>
 <label className={s.wide}>{t('CSV file')}<input type="file" accept=".csv,text/csv" onChange={e=>void readFile(e.target.files?.[0])}/></label>
 <label className={s.wide}>{t('Or paste CSV text')}<textarea rows={5} maxLength={MAX_IMPORT_BYTES} value={raw} disabled={busy} onChange={e=>{fileVersion.current++;setRaw(e.target.value);clear();}}/></label>
 <label>{t('Column delimiter')}<select value={delimiter} onChange={e=>{setDelimiter(e.target.value);clear();}}><option value=";">{t('Semicolon')}</option><option value=",">{t('Comma')}</option><option value={'\t'}>{t('Tab')}</option></select></label>
 <label>{t('Decimal separator')}<select value={decimal} onChange={e=>setDecimal(e.target.value as '.'|',')}><option value=".">1234.56</option><option value=",">1234,56</option></select></label>
 <label>{t('Date format')}<select value={dateFormat} onChange={e=>setDateFormat(e.target.value as 'iso'|'dmy')}><option value="iso">YYYY-MM-DD</option><option value="dmy">DD/MM/YYYY</option></select></label>
 <div className={s.wide}><button className={s.button} type="button" disabled={busy||!raw} onClick={parse}>{t('Read columns')}</button></div></div>{error&&<p role="alert">{t(error)}</p>}</div>
 <details className={s.panel}><summary>{t('File requirements and category codes')}</summary><p>{t('Entity reference must match the entity name, ID or tax number. Supplier and property references must match a unique existing name or ID. An empty property means company-level costs. Property costs remain blocked pending dated paying-entity verification.')}</p><p>{t('Amounts must be explicit, non-negative and have at most two decimals, without thousands separators. Currency must be EUR. Net plus original VAT must equal gross. Credit notes require a separate workflow.')}</p><p>{t('Suggested column headers')}</p><code style={{overflowWrap:'anywhere'}}>{Object.keys(importFields).join(';')}</code><ul>{Object.entries(costCategories).map(([code,label])=><li key={code}><code>{code}</code> — {t(label)}</li>)}</ul></details>
 {table&&mapping&&<><h2>{t('Match columns')}</h2><div className={s.form}>{Object.entries(importFields).map(([key,label])=><label key={key}>{t(label)}<select value={mapping[key as ImportField]} onChange={e=>setMapping({...mapping,[key]:Number(e.target.value)})}><option value={-1}>{t(key==='property'?'Company-level costs':'Select a column')}</option>{table.headers.map((h,i)=><option key={i} value={i}>{h}</option>)}</select></label>)}</div>
 {result?.error&&<p role="alert">{t(result.error)}</p>}{result?.value&&<><h2>{t('Import check')}</h2><div className={s.metrics} role="status"><p>{t('Rows without detected errors')}<strong>{result.value.eligible}</strong></p><p>{t('Rows requiring attention')}<strong>{result.value.blocked}</strong></p><p>{t('Gross total of rows without detected errors')}<strong>{money(result.value.gross)}</strong></p></div><p className={s.notice}>{t('Duplicate checks cover this file and the supplier-cost register for this entity across all years, as loaded when this page opened. Refresh before a new check. This preview is not an approval or a complete check against historical, sales or document archives. Final import is not enabled yet.')}</p><div className={s.tableWrap}><table className={s.table}><thead><tr>{['Row','Invoice','Supplier','Gross amount','Checks'].map(h=><th key={h}>{t(h)}</th>)}</tr></thead><tbody>{result.value.rows.map(r=><tr key={r.row}><td>{r.row}</td><td style={{overflowWrap:'anywhere'}}>{r.number}</td><td style={{overflowWrap:'anywhere'}}>{r.supplier}</td><td>{r.gross===null?'—':money(r.gross)}</td><td>{r.errors.length?<ul>{r.errors.map(e=><li key={e}>{t(e)}</li>)}</ul>:t('No errors detected in this preview.')}</td></tr>)}</tbody></table></div></>}</>}
 </>;
}
