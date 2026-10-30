'use client';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
import type {StaffLanguage} from '../../lib/property-operations/staff-copy';
import s from './staff.module.css';
export default function StaffLanguagePicker({initial}:{initial:StaffLanguage}){
 const router=useRouter(),[language,setLanguage]=useState(initial);
 return <label className={s.staffLanguagePicker}>
  <span className={s.srOnly}>Dashboard language / Taal / Idioma</span>
  <select aria-label="Dashboard language" value={language} onChange={event=>{
   const next=event.target.value as StaffLanguage;
   setLanguage(next);
   document.cookie='mzs_staff_language='+next+'; Max-Age=31536000; Path=/; SameSite=Lax; Secure';
   router.refresh();
  }}>
   <option value="nl">NL</option>
   <option value="en">EN</option>
   <option value="es">ES</option>
  </select>
 </label>;
}
