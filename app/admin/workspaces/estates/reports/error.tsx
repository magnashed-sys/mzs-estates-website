'use client';
export default function ReportError({reset}:{reset:()=>void}){return <section><h1>The complete report could not be loaded</h1><p>No incomplete totals are shown. Refresh the selection and retry.</p><button onClick={reset}>Reload</button></section>;}
