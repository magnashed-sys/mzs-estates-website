'use client';
export default function TimeReportError({reset}:{reset:()=>void}){
 return <section role="alert"><h2>Urenrapport niet beschikbaar</h2><p>De brongegevens konden niet volledig worden geladen. Probeer opnieuw of kies een kleinere periode, één object of één medewerker. Er worden geen onvolledige totalen getoond.</p><button onClick={reset}>Opnieuw laden</button><p><a href="/admin/workspaces/estates/time-report">Terug naar de huidige maand</a></p></section>;
}
