'use client';
export default function ErrorBoundary({reset}:{reset:()=>void}){
 return <section role="alert"><h2>Document archive unavailable / Archivo no disponible</h2><p>Please retry. / Vuelve a intentarlo.</p><button onClick={reset}>Try again / Reintentar</button></section>;
}
