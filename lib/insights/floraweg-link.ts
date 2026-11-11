import {insightPath} from './model';
const titles:Record<string,string>={
  "en": "Building the future of Floraweg together",
  "es": "Construyendo juntos el futuro de Floraweg",
  "de": "Gemeinsam die Zukunft der Floraweg gestalten",
  "fr": "Construire ensemble l’avenir de Floraweg",
  "it": "Costruire insieme il futuro di Floraweg",
  "da": "Sammen bygger vi Florawegs fremtid",
  "nb": "Sammen bygger vi fremtiden til Floraweg",
  "sv": "Tillsammans bygger vi Florawegs framtid",
  "fi": "Rakennamme yhdessä Florawegin tulevaisuutta",
  "pt-BR": "Construindo juntos o futuro de Floraweg",
  "cs": "Společně budujeme budoucnost Floraweg",
  "sk": "Spoločne budujeme budúcnosť Floraweg",
  "pl": "Wspólnie budujemy przyszłość Floraweg",
  "hu": "Együtt építjük a Floraweg jövőjét",
  "lt": "Kartu kuriame Floraweg ateitį",
  "uk": "Разом будуємо майбутнє Floraweg",
  "ro": "Construim împreună viitorul Floraweg",
  "bg": "Заедно градим бъдещето на Floraweg",
  "el": "Χτίζουμε μαζί το μέλλον της Floraweg",
  "ru": "Вместе строим будущее Floraweg",
  "tr": "Floraweg’in geleceğini birlikte inşa ediyoruz",
  "zh-CN": "携手共建 Floraweg 的未来",
  "ar": "معًا نبني مستقبل Floraweg",
  "nl": "Samen bouwen aan de toekomst van de Floraweg"
};
export function florawegArticleLink(locale:string){return {title:titles[locale]||titles.en,href:insightPath(locale,locale==='nl'?'samen-bouwen-aan-de-toekomst-van-de-floraweg':'building-the-future-of-floraweg-together')};}
