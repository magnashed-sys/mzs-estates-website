'use client';
import {usePathname} from 'next/navigation';
import {useState,useId} from 'react';
import Link from 'next/link';
import {useAdminI18n} from '../../lib/admin/i18n';
import {adminDirectory,findAdminModules} from '../../lib/admin/directory';
import s from './directory.module.css';
export default function AdminDirectory({expanded=false}:{expanded?:boolean}){
 const {language,t}=useAdminI18n();const es=language==='es';const id=useId();const [query,setQuery]=useState('');const [group,setGroup]=useState('');
 const pathname=usePathname();
 const items=findAdminModules(query,group);
 if(!expanded&&pathname==='/admin/workspaces/group')return null;
 return <details className={s.directory} open={expanded||undefined}>
 <summary>{es?'Buscar y abrir un módulo':'Find & open a module'} <span>{es?'Todos los módulos y acciones frecuentes':'All modules & frequent actions'}</span></summary>
 <div className={s.body}>
 <div className={s.filters}><label htmlFor={id}>{es?'Buscar módulos':'Search modules'}<input id={id} type="search" value={query} placeholder={es?'Facturas, tareas, PDF, horas…':'Invoices, tasks, PDFs, time…'} onChange={e=>setQuery(e.target.value)}/></label>
 <label htmlFor={id+'-group'}>{es?'Área':'Workspace'}<select id={id+'-group'} value={group} onChange={e=>setGroup(e.target.value)}><option value="">{es?'Todas las áreas':'All workspaces'}</option>{[...new Set(adminDirectory.map(i=>i.group))].map(g=><option key={g} value={g}>{t(g)}</option>)}</select></label>
 {(query||group)&&<button type="button" onClick={()=>{setQuery('');setGroup('')}}>{es?'Restablecer':'Reset'}</button>}</div>
 <p className={s.count} role="status">{items.length} {es?'módulos disponibles':'modules available'}</p>
 <nav className={s.grid} aria-label={es?'Directorio de administración':'Administration directory'}>{items.map(item=><Link key={item.href} href={item.href} prefetch={false}><small>{t(item.group)}</small><span>{es?item.es:item.en} <b aria-hidden="true">↗</b></span></Link>)}</nav>
 {!items.length&&<p>{es?'No hay resultados. Pruebe otra búsqueda o restablezca los filtros.':'No results. Try another search or reset the filters.'}</p>}
 <p className={s.note}>{es?'Trabajo por lotes: carga múltiple de PDF, revisión semanal de horas y paquetes para el contable. Abra el módulo para elegir el ámbito y revisar la selección.':'Bulk workflows: upload multiple PDFs, review weekly time entries and prepare accountant packages. Open the module to choose the scope and review your selection.'}</p>
 </div></details>;
}
