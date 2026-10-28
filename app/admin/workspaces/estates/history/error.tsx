'use client';
export default function HistoryError({reset}:{reset:()=>void}){return <section role="alert"><h2>Historische opgaven niet beschikbaar</h2><p>De brongegevens konden niet volledig worden geladen. Er worden geen gedeeltelijke totalen getoond.</p><button onClick={reset}>Opnieuw laden</button></section>;}
