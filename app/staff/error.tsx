'use client';
export default function StaffError({reset}:{reset:()=>void}){return <main style={{padding:'100px 24px'}}><h1>Het werkoverzicht kon niet volledig worden geladen</h1><p>Probeer opnieuw. Je eerder opgeslagen registraties blijven bewaard.</p><button onClick={reset}>Opnieuw laden</button></main>;}
