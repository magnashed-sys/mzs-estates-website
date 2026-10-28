'use client';
export default function ActionsError({reset}:{reset:()=>void}){
 return <section role="alert"><h2>Actielijst niet beschikbaar</h2><p>De gegevens konden niet volledig worden geladen. Probeer het opnieuw; er wordt geen leeg of gedeeltelijk overzicht als volledig resultaat getoond.</p><button onClick={reset}>Opnieuw laden</button></section>;
}
