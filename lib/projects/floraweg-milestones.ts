import {florawegCopy} from '../insights/floraweg';
const headings:Record<string,string>={
  "nl": "Behaalde mijlpaal",
  "en": "Milestone achieved",
  "de": "Erreichter Meilenstein",
  "fr": "Étape franchie",
  "es": "Hito alcanzado",
  "it": "Traguardo raggiunto",
  "da": "Opnået milepæl",
  "nb": "Oppnådd milepæl",
  "sv": "Uppnådd milstolpe",
  "fi": "Saavutettu virstanpylväs",
  "cs": "Dosažený milník",
  "sk": "Dosiahnutý míľnik",
  "pl": "Osiągnięty kamień milowy",
  "hu": "Elért mérföldkő",
  "lt": "Pasiektas etapas",
  "uk": "Досягнутий етап",
  "ro": "Etapă atinsă",
  "bg": "Постигнат етап",
  "el": "Ορόσημο που επιτεύχθηκε",
  "ru": "Достигнутый этап",
  "tr": "Ulaşılan kilometre taşı",
  "zh-CN": "已达成的里程碑",
  "ar": "إنجاز تحقق",
  "pt-BR": "Marco alcançado"
};
export function florawegMilestones(locale:string){
 return {heading:headings[locale]||headings.en,items:[{
  id:'contract-signing-2025',date:'2025-07-07',image:'/images/insights/floraweg-ondertekening.webp',width:1320,height:557,caption:florawegCopy(locale).caption
 }]};
}
