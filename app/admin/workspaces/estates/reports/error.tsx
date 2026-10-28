'use client';
export default function ReportError({reset}:{reset:()=>void}){return <section><h1>Rapport kon niet volledig worden geladen</h1><p>Er worden geen onvolledige totalen getoond. Vernieuw de selectie en probeer opnieuw.</p><button onClick={reset}>Opnieuw laden</button></section>;}
