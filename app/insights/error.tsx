'use client';
import {useLocale} from 'next-intl';
export default function InsightsError({reset}:{reset:()=>void}){
 const locale=useLocale();
 return <main style={{maxWidth:700,margin:'60px auto',padding:24}}><h1>MZS Insights</h1><p role="alert">{locale==='nl'?'De artikelen konden niet worden geladen. Probeer het opnieuw.':locale==='es'?'No se pudieron cargar los artículos. Inténtelo de nuevo.':'The articles could not be loaded. Please try again.'}</p><button onClick={reset}>{locale==='nl'?'Opnieuw proberen':locale==='es'?'Reintentar':'Try again'}</button></main>;
}
