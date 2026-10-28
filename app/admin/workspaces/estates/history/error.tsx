'use client';
export default function HistoryError({reset}:{reset:()=>void}){return <section role="alert"><h2>Historical statements unavailable</h2><p>The source data could not be fully loaded. No partial totals are shown.</p><button onClick={reset}>Reload</button></section>;}
