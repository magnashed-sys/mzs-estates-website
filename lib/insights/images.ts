/** Reviewed public editorial assets; private uploads and arbitrary URLs are never served here. */
export const insightImages = [
 {src:'/images/insights/maatwerk-voor-ondernemers.webp',width:1672,height:941,en:'Entrepreneurs discussing a plan',es:'Empresarios analizando un proyecto'},
 {src:'/images/insights/vastgoedfinanciering.webp',width:1672,height:941,en:'Property financing and project planning',es:'Financiación y planificación inmobiliaria'},
 {src:'/images/insights/vastgoed-spanje.webp',width:1672,height:941,en:'Mediterranean property',es:'Vivienda mediterránea'},
 {src:'/images/insights/floraweg-ondertekening.webp',width:1320,height:557,en:'Signing of the Floraweg development agreements',es:'Firma de los acuerdos del proyecto Floraweg'},
] as const;
export function insightImage(src:unknown){return insightImages.find(image=>image.src===src)??null;}
