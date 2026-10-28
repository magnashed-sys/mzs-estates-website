'use client';
export default function ErrorBoundary({reset}:{reset:()=>void}){return <section role="alert"><h1>Invoice register unavailable</h1><p>The complete invoice data could not be verified. No partial balances or totals are shown.</p><button onClick={reset}>Try again</button></section>;}
