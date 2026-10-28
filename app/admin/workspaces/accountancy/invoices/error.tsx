'use client';
export default function ErrorBoundary({reset}:{reset:()=>void}){return <section role="alert"><h1>Invoice archive unavailable</h1><p>The complete data could not be loaded.</p><button onClick={reset}>Try again</button></section>;}
