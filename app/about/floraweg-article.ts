import {memberLocale, type Locale} from '../../i18n/public-routing';
import {insightPath} from '../../lib/insights/model';

// Public article titles and summaries, reviewed against the published translations.
const copy: Record<Locale, {title: string; summary: string; readArticle: string}> = {
  "ar": {
    "title": "معًا نبني مستقبل Floraweg",
    "summary": "يحضر Magdy Nashed ممثلًا عن MZS توقيع العقود مع بلدية أمستردام وجمعية الإسكان Ymere.",
    "readArticle": "اقرأ المقال"
  },
  "bg": {
    "title": "Заедно градим бъдещето на Floraweg",
    "summary": "Magdy Nashed представлява MZS при подписването на договорите с община Амстердам и жилищната асоциация Ymere.",
    "readArticle": "Прочетете статията"
  },
  "cs": {
    "title": "Společně budujeme budoucnost Floraweg",
    "summary": "Magdy Nashed zastupuje MZS při podpisu smluv s městem Amsterdam a bytovým sdružením Ymere.",
    "readArticle": "Přečíst článek"
  },
  "da": {
    "title": "Sammen bygger vi Florawegs fremtid",
    "summary": "Magdy Nashed repræsenterer MZS ved underskrivelsen af kontrakterne med Amsterdam Kommune og boligorganisationen Ymere.",
    "readArticle": "Læs artiklen"
  },
  "de": {
    "title": "Gemeinsam die Zukunft der Floraweg gestalten",
    "summary": "Magdy Nashed als Vertreter von MZS bei der Vertragsunterzeichnung mit der Stadt Amsterdam und der Wohnungsbaugesellschaft Ymere.",
    "readArticle": "Artikel lesen"
  },
  "el": {
    "title": "Χτίζουμε μαζί το μέλλον της Floraweg",
    "summary": "Ο Magdy Nashed εκπροσωπεί την MZS στην υπογραφή των συμβάσεων με τον Δήμο Άμστερνταμ και τον στεγαστικό οργανισμό Ymere.",
    "readArticle": "Διαβάστε το άρθρο"
  },
  "en": {
    "title": "Building the future of Floraweg together",
    "summary": "Magdy Nashed representing MZS at the signing of the contracts with the Municipality of Amsterdam and housing association Ymere.",
    "readArticle": "Read the article"
  },
  "es": {
    "title": "Construyendo juntos el futuro de Floraweg",
    "summary": "Magdy Nashed, en representación de MZS, en la firma de los contratos con el Ayuntamiento de Ámsterdam y la asociación de vivienda Ymere.",
    "readArticle": "Leer el artículo"
  },
  "fi": {
    "title": "Rakennamme yhdessä Florawegin tulevaisuutta",
    "summary": "Magdy Nashed edustaa MZS:ää Amsterdamin kaupungin ja Ymere-asunto-organisaation kanssa tehtävien sopimusten allekirjoituksessa.",
    "readArticle": "Lue artikkeli"
  },
  "fr": {
    "title": "Construire ensemble l’avenir de Floraweg",
    "summary": "Magdy Nashed, représentant MZS, lors de la signature des contrats avec la municipalité d’Amsterdam et l’organisme de logement social Ymere.",
    "readArticle": "Lire l’article"
  },
  "hu": {
    "title": "Együtt építjük a Floraweg jövőjét",
    "summary": "Magdy Nashed az MZS képviseletében részt vesz az Amszterdam önkormányzatával és az Ymere lakásgazdálkodási szervezettel kötött szerződések aláírásán.",
    "readArticle": "A cikk elolvasása"
  },
  "it": {
    "title": "Costruire insieme il futuro di Floraweg",
    "summary": "Magdy Nashed, in rappresentanza di MZS, alla firma dei contratti con il Comune di Amsterdam e l’associazione per l’edilizia sociale Ymere.",
    "readArticle": "Leggi l’articolo"
  },
  "lt": {
    "title": "Kartu kuriame Floraweg ateitį",
    "summary": "Magdy Nashed atstovauja MZS pasirašant sutartis su Amsterdamo savivaldybe ir būsto organizacija Ymere.",
    "readArticle": "Skaityti straipsnį"
  },
  "nb": {
    "title": "Sammen bygger vi fremtiden til Floraweg",
    "summary": "Magdy Nashed representerer MZS ved undertegningen av kontraktene med Amsterdam kommune og boligorganisasjonen Ymere.",
    "readArticle": "Les artikkelen"
  },
  "nl": {
    "title": "Samen bouwen aan de toekomst van de Floraweg",
    "summary": "Magdy Nashed namens MZS bij de ondertekening van de contracten met de Gemeente Amsterdam & Woningbouwvereniging Ymere.",
    "readArticle": "Lees het artikel"
  },
  "pl": {
    "title": "Wspólnie budujemy przyszłość Floraweg",
    "summary": "Magdy Nashed reprezentuje MZS podczas podpisania umów z miastem Amsterdam i organizacją mieszkaniową Ymere.",
    "readArticle": "Przeczytaj artykuł"
  },
  "pt-BR": {
    "title": "Construindo juntos o futuro de Floraweg",
    "summary": "Magdy Nashed, representando a MZS, na assinatura dos contratos com a Prefeitura de Amsterdã e a associação habitacional Ymere.",
    "readArticle": "Leia o artigo"
  },
  "ro": {
    "title": "Construim împreună viitorul Floraweg",
    "summary": "Magdy Nashed reprezintă MZS la semnarea contractelor cu municipalitatea Amsterdam și asociația de locuințe Ymere.",
    "readArticle": "Citește articolul"
  },
  "ru": {
    "title": "Вместе строим будущее Floraweg",
    "summary": "Magdy Nashed представляет MZS при подписании договоров с муниципалитетом Амстердама и жилищной ассоциацией Ymere.",
    "readArticle": "Читать статью"
  },
  "sk": {
    "title": "Spoločne budujeme budúcnosť Floraweg",
    "summary": "Magdy Nashed zastupuje MZS pri podpise zmlúv s mestom Amsterdam a bytovým združením Ymere.",
    "readArticle": "Prečítať článok"
  },
  "sv": {
    "title": "Tillsammans bygger vi Florawegs framtid",
    "summary": "Magdy Nashed representerar MZS vid undertecknandet av avtalen med Amsterdams kommun och bostadsorganisationen Ymere.",
    "readArticle": "Läs artikeln"
  },
  "tr": {
    "title": "Floraweg’in geleceğini birlikte inşa ediyoruz",
    "summary": "Magdy Nashed, Amsterdam Belediyesi ve konut kuruluşu Ymere ile sözleşmelerin imzalanmasında MZS’yi temsil ediyor.",
    "readArticle": "Makaleyi okuyun"
  },
  "uk": {
    "title": "Разом будуємо майбутнє Floraweg",
    "summary": "Magdy Nashed представляє MZS під час підписання договорів із муніципалітетом Амстердама та житловою асоціацією Ymere.",
    "readArticle": "Читати статтю"
  },
  "zh-CN": {
    "title": "携手共建 Floraweg 的未来",
    "summary": "Magdy Nashed 代表 MZS 出席与阿姆斯特丹市政府及住房协会 Ymere 的合同签署活动。",
    "readArticle": "阅读文章"
  }
};

export function aboutFlorawegArticle(locale: string) {
  const language = memberLocale(locale);
  const slug = language === 'nl' ? 'samen-bouwen-aan-de-toekomst-van-de-floraweg' : 'building-the-future-of-floraweg-together';
  return {...copy[language], href: insightPath(language, slug)};
}

