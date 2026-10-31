/** Reviewed public editorial assets; private uploads and arbitrary URLs are never served here. */
export const insightImages = [
 {src:'/images/insights/maatwerk-voor-ondernemers.webp',en:'Entrepreneurs discussing a plan',es:'Empresarios analizando un proyecto'},
 {src:'/images/insights/vastgoedfinanciering.webp',en:'Property financing and project planning',es:'Financiación y planificación inmobiliaria'},
 {src:'/images/insights/vastgoed-spanje.webp',en:'Mediterranean property',es:'Vivienda mediterránea'},
] as const;
export function insightImage(src:unknown){return insightImages.find(image=>image.src===src)??null;}
