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
  // Keep the previous impression in other languages until the Dutch review is complete.
  const dutchReview = locale === "nl";
  const zones = [
    {id:"guest-white", number:"1", label:copy[2], x:110,y:350,w:150,h:150},
    {id:"laundry", number:"2", label:laundry, x:110,y:dutchReview?290:250,w:dutchReview?120:150,h:dutchReview?60:100},
    {id:"guest-green", number:"3", label:copy[3], x:110,y:130,w:dutchReview?130:150,h:dutchReview?160:120},
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
          {dutchReview && <defs>
            <linearGradient id="nucia-water" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#79bcc7"/><stop offset="1" stopColor="#3f8e9c"/>
            </linearGradient>
            <pattern id="nucia-paving" width="42" height="28" patternUnits="userSpaceOnUse">
              <rect width="42" height="28" fill="#e2d8c6"/>
              <path d="M0 0H42V28" fill="none" stroke="#d5cab6" strokeWidth="1"/>
            </pattern>
            <pattern id="nucia-roof" width="12" height="12" patternUnits="userSpaceOnUse">
              <rect width="12" height="12" fill="#eee6d6"/>
              <path d="M0 12H12" stroke="#e3d8c4" strokeWidth="1"/>
            </pattern>
          </defs>}
          <rect x="10" y="20" width="780" height="575" rx="28" fill="#e9e7db"/>
          <path d="M280 70H720V520H750" fill="none" stroke="#d4d5c3" strokeWidth="22" strokeLinecap="round"/>
          {dutchReview && <g aria-hidden="true" pointerEvents="none">
            <rect x="270" y="63" width="435" height="282" rx="8" fill="url(#nucia-paving)"/>
            <path d="M280 530H700" stroke="#d5cdbd" strokeWidth="28"/>
            <path d="M104 510H708V350H268V344H238V284H248V130H110" fill="none" stroke="#5b6454" strokeOpacity=".13" strokeWidth="12" strokeLinejoin="round"/>
            <rect x="342" y="122" width="266" height="131" rx="7" fill="#faf5e9" stroke="#c6bfaf" strokeWidth="2"/>
            {/* Sun loungers on the terrace above the pool; an indicative impression. */}
            {[375,425,475,525].map(x=><g key={x} transform={`translate(${x} 71)`}>
              <rect x="2" y="3" width="24" height="43" rx="3" fill="#776c57" opacity=".15"/>
              <rect width="24" height="43" rx="3" fill="#faf7ed" stroke="#a59881" strokeWidth="1.5"/>
              <rect x="3" y="3" width="18" height="12" rx="2" fill="#d4bc96"/>
              <path d="M3 18H21M3 23H21M3 28H21M3 33H21" stroke="#dfd7c6"/>
            </g>)}
            {[{x:310,y:540},{x:655,y:550},{x:750,y:185},{x:750,y:290}].map((p,i)=><g key={i}>
              <circle cx={p.x+3} cy={p.y+4} r="19" fill="#4c6546" opacity=".1"/>
              <circle cx={p.x} cy={p.y} r="17" fill="#b3bea0"/>
              <circle cx={p.x-5} cy={p.y-4} r="10" fill="#c2cbae"/>
            </g>)}
          </g>}
          {[{x:55,y:165},{x:55,y:275},{x:465,y:550}].map((p,i)=><g key={i} aria-hidden="true"><rect x={p.x-24} y={p.y-25} width="48" height="50" rx="10" fill="#d1d5c5"/><text x={p.x} y={p.y+8} textAnchor="middle" fill="#485440" fontSize="24">P</text></g>)}
          {zones.map(z=><a key={z.id} href={`#tour-${z.id}`} onClick={()=>select(z.id)} aria-label={z.label} className={styles.zone}>
            <title>{z.label}</title>
            <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={dutchReview?2:5} fill={z.id==="pool"?(dutchReview?"url(#nucia-water)":"#91c3c7"):z.id==="outdoor"?(dutchReview?"url(#nucia-paving)":"#d4bc96"):(dutchReview?"url(#nucia-roof)":"#faf7ed")} stroke={z.id==="pool"?"#628e93":"#8f927e"} strokeWidth={dutchReview?3:2}/>
            {dutchReview && <g aria-hidden="true" pointerEvents="none">
              {!["pool","outdoor"].includes(z.id) && <rect x={z.x+7} y={z.y+7} width={z.w-14} height={z.h-14} fill="none" stroke="#fffaf0" strokeWidth="3"/>}
              {z.id==="pool" && <>
                <path d="M356 136H594M356 141H594M356 146H594" stroke="#d9eff0" strokeOpacity=".55" fill="none"/>
                <path d="M372 218q18-7 36 0t36 0t36 0t36 0t36 0" fill="none" stroke="#d9eff0" strokeOpacity=".35"/>
              </>}
              {z.id==="outdoor" && <>
                <path d="M328 281h54M328 323h54" stroke="#a3977c" strokeWidth="7" strokeDasharray="16 3"/>
                <rect x="320" y="289" width="70" height="26" rx="4" fill="#b6a07b" stroke="#9b896a"/>
                <rect x="588" y="283" width="76" height="17" rx="3" fill="#f3ecdf" stroke="#ac9d84"/>
                <path d="M612 284V299M638 284V299" stroke="#c8bda7"/>
                <rect x="606" y="308" width="40" height="15" rx="3" fill="#b6a07b" stroke="#9b896a"/>
              </>}
            </g>}
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
