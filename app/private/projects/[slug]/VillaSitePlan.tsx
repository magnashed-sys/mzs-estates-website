"use client";
import {useLocale, useTranslations} from "next-intl";
import {nuciaExtraCopy} from "./nuciaExtraCopy";
import {sitePlanCopy} from "./sitePlanCopy";
import styles from "./villaSitePlan.module.css";

export default function VillaSitePlan() {
  const locale = useLocale();
  const t = useTranslations("ProjectUI");
  const copy = sitePlanCopy[locale] || sitePlanCopy.en;
  const laundry = nuciaExtraCopy(locale)["Laundry room"];
  const zones = [
    {id:"guest-white", number:"1", label:copy[2], x:110,y:350,w:150,h:150},
    {id:"laundry", number:"2", label:laundry, x:110,y:250,w:150,h:100},
    {id:"guest-green", number:"3", label:copy[3], x:110,y:130,w:150,h:120},
    {id:"living", number:"4", label:copy[4], x:260,y:350,w:440,h:150},
    {id:"pool", number:"5", label:t("p455"), x:350,y:130,w:250,h:115},
    {id:"outdoor", number:"6", label:t("p524"), x:285,y:270,w:415,h:65},
  ];
  function select(id:string) {
    window.dispatchEvent(new CustomEvent("mzs-photo-chapter", {detail:id}));
  }
  return <section id="site-plan" className={styles.section} aria-labelledby="site-plan-title">
    <div className={styles.header}><div><p className={styles.kicker}>VILLA LA NUCIA</p><h2 id="site-plan-title">{copy[0]}</h2></div><p>{copy[6]}</p></div>
    <div className={styles.layout}>
      <div className={styles.map}>
        <svg viewBox="0 0 800 610" role="group" aria-label={copy[0]}>
          <rect x="10" y="20" width="780" height="575" rx="28" fill="#e9e7db"/>
          <path d="M280 70H720V520H750" fill="none" stroke="#d4d5c3" strokeWidth="22" strokeLinecap="round"/>
          {[{x:55,y:165},{x:55,y:275},{x:465,y:550}].map((p,i)=><g key={i} aria-hidden="true"><rect x={p.x-24} y={p.y-25} width="48" height="50" rx="10" fill="#d1d5c5"/><text x={p.x} y={p.y+8} textAnchor="middle" fill="#485440" fontSize="24">P</text></g>)}
          {zones.map(z=><a key={z.id} href={`#tour-${z.id}`} onClick={()=>select(z.id)} aria-label={z.label} className={styles.zone}>
            <title>{z.label}</title>
            <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="5" fill={z.id==="pool"?"#91c3c7":z.id==="outdoor"?"#d4bc96":"#faf7ed"} stroke={z.id==="pool"?"#628e93":"#8f927e"} strokeWidth="2"/>
            {z.id==="pool" && <path d="M380 170q15-10 30 0t30 0t30 0t30 0t30 0" fill="none" stroke="#d9eff0" strokeWidth="3" aria-hidden="true"/>}
            <circle cx={z.x+z.w/2} cy={z.y+z.h/2+(z.id==="pool"?15:0)} r="21" fill="#283c32"/>
            <text x={z.x+z.w/2} y={z.y+z.h/2+7+(z.id==="pool"?15:0)} textAnchor="middle" fill="#fff" fontSize="20">{z.number}</text>
          </a>)}
        </svg>
        <div className={styles.caption}><span>{copy[1]}</span><span>P · {copy[5]}</span></div>
      </div>
      <nav className={styles.legend} aria-label={copy[0]}>
        {zones.map(z=><a key={z.id} href={`#tour-${z.id}`} onClick={()=>select(z.id)}><span>{z.number}</span><strong>{z.label}</strong><span aria-hidden="true">↗</span></a>)}
        <div className={styles.more}>
          <a href="#tour-bedrooms" onClick={()=>select("bedrooms")}>{t("p485")} ↗</a>
          <a href="#tour-bathroom" onClick={()=>select("bathroom")}>{t("p495")} ↗</a>
        </div>
      </nav>
    </div>
  </section>;
}
