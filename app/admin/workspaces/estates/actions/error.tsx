'use client';
export default function ActionsError({reset}:{reset:()=>void}){
 return <section role="alert"><h2>Action list unavailable</h2><p>The complete data could not be loaded. Please retry; an empty or partial overview will not be presented as a complete result.</p><button onClick={reset}>Reload</button></section>;
}
