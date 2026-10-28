'use client';
export default function TimeReportError({reset}:{reset:()=>void}){
 return <section role="alert"><h2>Time report unavailable</h2><p>The source data could not be fully loaded. Retry or choose a shorter period, one property or one staff member. No incomplete totals are shown.</p><button onClick={reset}>Reload</button><p><a href="/admin/workspaces/estates/time-report">Back to the current month</a></p></section>;
}
