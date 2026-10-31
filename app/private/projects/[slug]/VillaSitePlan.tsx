"use client";
import {useLocale, useTranslations} from "next-intl";
import {nuciaExtraCopy} from "./nuciaExtraCopy";
import {sitePlanCopy} from "./sitePlanCopy";
import VillaInteriorPlan, {interiorBadges, interiorDescriptions, roomKey} from "./VillaInteriorPlan";
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
    {id:"pool", number:"5", label:t("p455"), x:dutchReview?285:350,y:130,w:dutchReview?315:250,h:115},
    {id:"outdoor", number:"6", label:t("p524"), x:285,y:270,w:415,h:65},
  ];
  const parking = dutchReview
    ? [{x:55,y:425},{x:55,y:320},{x:465,y:550}]
    : [{x:55,y:165},{x:55,y:275},{x:465,y:550}];
  function select(id:string) {
    window.dispatchEvent(new CustomEvent("mzs-photo-chapter", {detail:id}));
  }
  return <section id="site-plan" className={styles.section} aria-labelledby="site-plan-title">
    <div className={styles.header}><div><p className={styles.kicker}>VILLA LA NUCIA</p><h2 id="site-plan-title">{copy[0]}</h2></div><p>{copy[6]}</p></div>
    <div className={styles.layout}>
      <div className={styles.map}>
        <svg viewBox={dutchReview ? "0 0 800 670" : "0 0 800 610"} role="group" aria-label={copy[0]}>
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
          <rect x="10" y="20" width="780" height={dutchReview ? 640 : 575} rx="28" fill="#e9e7db"/>
          <path d="M280 70H720V520H750" fill="none" stroke="#d4d5c3" strokeWidth="22" strokeLinecap="round"/>
          {dutchReview && <g aria-hidden="true" pointerEvents="none">
            <rect x="270" y="63" width="435" height="282" rx="8" fill="url(#nucia-paving)"/>
            <path d="M280 530H700" stroke="#d5cdbd" strokeWidth="28"/>
            <path d="M104 510H708V350H268V344H238V284H248V130H110" fill="none" stroke="#5b6454" strokeOpacity=".13" strokeWidth="12" strokeLinejoin="round"/>
            <rect x="277" y="122" width="331" height="131" rx="7" fill="#faf5e9" stroke="#c6bfaf" strokeWidth="2"/>
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
          {parking.map((p,i)=><g key={i} aria-hidden="true"><rect x={p.x-24} y={p.y-25} width="48" height="50" rx="10" fill="#d1d5c5"/><text x={p.x} y={p.y+8} textAnchor="middle" fill="#485440" fontSize="24">P</text></g>)}
          {zones.map(z=>{
            const interiorBadge = dutchReview ? interiorBadges[z.id] : undefined;
            const badge = interiorBadge || {x:z.x+z.w/2,y:z.y+z.h/2+(z.id==="pool"?15:0)};
            return <a key={z.id} href={`#tour-${z.id}`} onClick={()=>select(z.id)} aria-label={dutchReview && interiorDescriptions[z.id] ? `${z.label}. ${interiorDescriptions[z.id]}` : z.label} className={styles.zone}>
            <title>{z.label}</title>
            <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={dutchReview?2:5} fill={z.id==="pool"?(dutchReview?"url(#nucia-water)":"#91c3c7"):z.id==="outdoor"?(dutchReview?"url(#nucia-paving)":"#d4bc96"):(dutchReview?"url(#nucia-roof)":"#faf7ed")} stroke={z.id==="pool"?"#628e93":"#8f927e"} strokeWidth={dutchReview?3:2}/>
            {dutchReview && <g aria-hidden="true" pointerEvents="none">
              <VillaInteriorPlan zone={z.id}/>
              {z.id==="pool" && <>
                <path d="M291 136H594M291 141H594M291 146H594" stroke="#d9eff0" strokeOpacity=".55" fill="none"/>
                <path d="M352 218q18-7 36 0t36 0t36 0t36 0t36 0" fill="none" stroke="#d9eff0" strokeOpacity=".35"/>
              </>}
              {z.id==="outdoor" && <>
                <path d="M328 281h54M328 323h54" stroke="#a3977c" strokeWidth="7" strokeDasharray="16 3"/>
                <rect x="320" y="289" width="70" height="26" rx="4" fill="#b6a07b" stroke="#9b896a"/>
                <rect x="588" y="283" width="76" height="17" rx="3" fill="#f3ecdf" stroke="#ac9d84"/>
                <path d="M612 284V299M638 284V299" stroke="#c8bda7"/>
                <rect x="606" y="308" width="40" height="15" rx="3" fill="#b6a07b" stroke="#9b896a"/>
              </>}
            </g>}
            {z.id==="pool" && <path d={dutchReview?"M367 170q15-10 30 0t30 0t30 0t30 0t30 0":"M380 170q15-10 30 0t30 0t30 0t30 0t30 0"} fill="none" stroke="#d9eff0" strokeWidth="3" aria-hidden="true"/>}
            <circle cx={badge.x} cy={badge.y} r={interiorBadge?13:21} fill="#283c32" className={interiorBadge?styles.interiorNumber:undefined}/>
            <text x={badge.x} y={badge.y+(interiorBadge?5:7)} textAnchor="middle" fill="#fff" fontSize={interiorBadge?14:20} className={interiorBadge?styles.interiorNumber:undefined}>{z.number}</text>
          </a>;})}
          {dutchReview && <a href="#tour-rooftop" onClick={()=>select("rooftop")} className={styles.rooftop} aria-label="Privédakterras boven gastenverblijf 3, bereikbaar via de buitentrap · bekijk de foto's">
            <title>Privédakterras boven gastenverblijf 3</title>
            <rect x="110" y="66" width="130" height="44" rx="5" fill="#f3eddf" stroke="#aaa68f"/>
            <text x="175" y="84" textAnchor="middle" fill="#485440" fontSize="12">Privédakterras</text>
            <text x="175" y="100" textAnchor="middle" fill="#667065" fontSize="10">boven gastenverblijf 3</text>
            <path d="M175 110V126" stroke="#8f927e" strokeWidth="1.5" strokeDasharray="3 2"/>
            <g aria-hidden="true" pointerEvents="none">
              <path d="M245 120A24 24 0 0 1 245 168L245 152A8 8 0 0 0 245 136Z" fill="#e2d8c6" stroke="#969681" strokeWidth="1.2"/>
              {[-70,-50,-30,-10,10,30,50,70].map(angle => {
                const radians = angle * Math.PI / 180;
                return <path key={angle} d={`M${245+8*Math.cos(radians)} ${144+8*Math.sin(radians)}L${245+24*Math.cos(radians)} ${144+24*Math.sin(radians)}`} stroke="#aaa58f" strokeWidth=".8"/>;
              })}
              <path d="M260 159A21 21 0 0 0 260 129M260 129L258 134M260 129L265 131" fill="none" stroke="#667065" strokeWidth="1.2"/>
            </g>
          </a>}
          {dutchReview && <a href="#tour-outdoor" onClick={()=>select("outdoor")} className={styles.amenities} aria-label="Barbecue en buitendouche rechtsboven, met de douche-ingang naar het zwembad · bekijk de foto's">
            <title>Barbecue en buitendouche</title>
            <rect x="610" y="70" width="94" height="177" rx="5" fill="transparent"/>
            <g aria-hidden="true" pointerEvents="none">
              <rect x="627" y="80" width="65" height="38" rx="2" fill="#f7f0df" stroke="#9f937a" strokeWidth="1.5"/>
              <rect x="627" y="108" width="65" height="10" rx="1" fill="#c6a57a" stroke="#ac8b64"/>
              <rect x="634" y="86" width="26" height="21" rx="2" fill="#62675d"/>
              <path d="M637 90H657M637 94H657M637 98H657M637 102H657" stroke="#d4cbb8" strokeWidth="1.2"/>
              <rect x="666" y="85" width="20" height="18" rx="1" fill="#e5d7b9"/>
              <circle cx="617" cy="100" r="8" fill="#596055" stroke="#a5a58e" strokeWidth="1.5"/>
              <path d="M612 97H622M611 100H623M612 103H622" stroke="#bfc2ac"/>
              <text x="658" y="137" textAnchor="middle" fill="#485440" fontSize="13">BBQ</text>
              <rect x="649" y="170" width="43" height="48" fill="#c8e2ec"/>
              <path d="M649 170H692V218H649" fill="none" stroke="#839eac" strokeWidth="3"/>
              <path d="M654 175H687V213H654" fill="none" stroke="#e2f1f3" strokeWidth="1.2"/>
              <path d="M692 194H681" stroke="#617f8b" strokeWidth="2"/>
              <ellipse cx="680" cy="194" rx="2.5" ry="5" fill="#617f8b"/>
              <path d="M673 189L666 187M672 194H664M673 199L666 201" stroke="#80b1c1" strokeWidth="1.1"/>
              <rect x="655" y="191" width="6" height="6" rx="1" fill="#93b3bd"/>
              <text x="670" y="238" textAnchor="middle" fill="#485440" fontSize="12">Buitendouche</text>
            </g>
          </a>}
          {dutchReview && <>
            <path d="M14 580H145M227 580H492M528 580H786" stroke="#faf7ed" strokeWidth="8" aria-hidden="true"/>
            <a href="#tour-arrival" onClick={()=>select("arrival")} aria-label="Elektrisch hek links van de entree · bekijk de foto's" className={styles.entrance}>
              <title>Elektrisch hek</title>
              <rect x="118" y="563" width="152" height="64" rx="4" fill="transparent"/>
              <path d="M145 587H266" stroke="#8f927e" strokeWidth="2" aria-hidden="true"/>
              <rect x="147" y="574" width="76" height="12" rx="2" fill="#faf7ed" stroke="#667065" strokeWidth="2"/>
              <path d="M153 580H217M233 574H262L257 570M262 574L257 578" fill="none" stroke="#667065" strokeWidth="1.5" aria-hidden="true"/>
              <text x="185" y="613" textAnchor="middle" fill="#485440" fontSize="20">Elektrisch hek</text>
            </a>
            <a href="#tour-arrival" onClick={()=>select("arrival")} aria-label="Loopdeur rechts van de entree · bekijk de foto's" className={styles.entrance}>
              <title>Loopdeur</title>
              <rect x="460" y="563" width="100" height="64" rx="4" fill="transparent"/>
              <rect x="494" y="574" width="32" height="12" rx="2" fill="#faf7ed" stroke="#667065" strokeWidth="2"/>
              <path d="M500 580H520" stroke="#667065" strokeWidth="1.5" aria-hidden="true"/>
              <text x="510" y="613" textAnchor="middle" fill="#485440" fontSize="20">Loopdeur</text>
            </a>
          </>}
        </svg>
        <div className={styles.caption}>{!dutchReview && <span>{copy[1]}</span>}<span>P · {copy[5]}</span></div>
        {dutchReview && <ul className={styles.roomKey} aria-label="Legenda binnenruimtes">
          {roomKey.map(item=><li key={item.label}><span className={styles.swatch} style={{backgroundColor:item.color}} aria-hidden="true"/>{item.label}</li>)}
          <li><svg width="18" height="18" viewBox="0 0 22 22" aria-hidden="true"><path d="M3 19V3M3 3A16 16 0 0 1 19 19" fill="none" stroke="#737c67" strokeWidth="1.5"/></svg>Deuren</li>
          <li><svg width="22" height="18" viewBox="0 0 28 22" aria-hidden="true"><path d="M2 11H12M2 15H12M4 13H13M25 5H14L18 2M14 5L18 8" fill="none" stroke="#737c67" strokeWidth="1.5"/></svg>Schuifdeur</li>
        </ul>}
      </div>
      <nav className={styles.legend} aria-label={copy[0]}>
        {zones.map(z=><a key={z.id} href={`#tour-${z.id}`} onClick={()=>select(z.id)}><span>{z.number}</span><strong>{z.label}</strong><span aria-hidden="true">↗</span></a>)}
        <div className={styles.more}>
          <a href="#tour-bedrooms" onClick={()=>select("bedrooms")}>{t("p485")} ↗</a>
          <a href="#tour-bathroom" onClick={()=>select("bathroom")}>{t("p495")} ↗</a>
          {dutchReview && <a href="#tour-rooftop" onClick={()=>select("rooftop")}>Privédakterras ↗</a>}
        </div>
      </nav>
    </div>
  </section>;
}
