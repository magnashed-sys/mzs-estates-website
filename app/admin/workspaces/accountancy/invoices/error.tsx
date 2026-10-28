'use client';
export default function ErrorBoundary({reset}:{reset:()=>void}){return <section role="alert"><h1>Factuurarchief niet beschikbaar</h1><p>De volledige gegevens konden niet worden geladen.</p><button onClick={reset}>Opnieuw proberen</button></section>;}
