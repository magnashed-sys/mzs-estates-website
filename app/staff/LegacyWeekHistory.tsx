import s from './staff.module.css';
import type {StaffLanguage} from '../../lib/property-operations/staff-copy';

export type LegacyWeekRow={
 id:string; reporting_year:number; iso_week:number; period_from:string; period_until:string;
 original_location:string; category:string; description:string; source_reference:string|null;
 close_status:'historical_closed';
};
const copy={
 nl:{heading:'Historische weekoverzichten · afgesloten',note:'Overgenomen uit de oorspronkelijke weekberichten van februari t/m oktober 2026. Deze historische registraties zijn administratief afgesloten. De bron bevat niet overal exact gewerkte minuten: dit overzicht is dus geen urenstaat, loonberekening of nieuwe factuur.',week:'Week',records:'registraties',closed:'Historisch afgesloten',period:'Periode',source:'Bron',notExact:'Uren niet exact vastgelegd in oorspronkelijke bron'},
 en:{heading:'Historical weekly reports · closed',note:'Copied from the original weekly messages from February through October 2026. These historical records are administratively closed. The source does not consistently contain actual worked minutes, so this is not a precise timesheet, payroll record, or new invoice.',week:'Week',records:'records',closed:'Historically closed',period:'Period',source:'Source',notExact:'Exact worked minutes not recorded in original source'},
 es:{heading:'Informes semanales históricos · cerrados',note:'Copiados de los mensajes semanales originales entre febrero y octubre de 2026. Estos registros históricos están cerrados administrativamente. La fuente no siempre incluye minutos reales, por lo que no constituyen una hoja de horas exacta, una nómina ni una nueva factura.',week:'Semana',records:'registros',closed:'Cerrado históricamente',period:'Período',source:'Fuente',notExact:'No constan minutos reales exactos en la fuente original'}
};
export default function LegacyWeekHistory({rows,language}:{rows:LegacyWeekRow[];language:StaffLanguage}){
 if(rows.length===0)return null;
 const t=copy[language];
 const weeks=new Map<string,LegacyWeekRow[]>();
 for(const row of rows){
  const key=row.reporting_year+'-'+row.iso_week;
  const entries=weeks.get(key)??[];
  entries.push(row);weeks.set(key,entries);
 }
 return <section className={s.panel} aria-labelledby="legacy-history-title">
  <h2 id="legacy-history-title">{t.heading}</h2>
  <p className={s.description}>{t.note}</p>
  {[...weeks].map(([key,entries])=><details className={s.history} key={key}>
   <summary><strong>{t.week} {entries[0].iso_week} · {entries[0].reporting_year}</strong> · {entries.length} {t.records} · {t.closed}</summary>
   <p className={s.description}>{t.period}: {entries[0].period_from} – {entries[0].period_until}</p>
   <ul>{entries.map(item=><li key={item.id} style={{marginBottom:12}}>
    <strong>{item.original_location}</strong> · {item.category}
    <div>{item.description}</div>
    <small>{t.closed} · {t.notExact}{item.source_reference?' · '+t.source+': '+item.source_reference:''}</small>
   </li>)}</ul>
  </details>)}
 </section>;
}
