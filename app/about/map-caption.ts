import {type Locale, memberLocale} from '../../i18n/public-routing';

const captions: Record<Locale, string> = {
  en: 'MZS Group operates in these regions through equity interests in local companies.',
  nl: 'MZS Group is in deze regio’s actief via deelnemingen in lokale ondernemingen.',
  de: 'MZS Group ist in diesen Regionen über Beteiligungen an lokalen Unternehmen tätig.',
  fr: 'MZS Group est actif dans ces régions par le biais de participations dans des entreprises locales.',
  es: 'MZS Group opera en estas regiones a través de participaciones en empresas locales.',
  it: 'MZS Group opera in queste regioni attraverso partecipazioni in imprese locali.',
  da: 'MZS Group er aktiv i disse regioner gennem ejerandele i lokale virksomheder.',
  nb: 'MZS Group er aktiv i disse regionene gjennom eierandeler i lokale selskaper.',
  sv: 'MZS Group är verksamt i dessa regioner genom ägarandelar i lokala företag.',
  fi: 'MZS Group toimii näillä alueilla paikallisten yritysten omistusosuuksien kautta.',
  cs: 'MZS Group působí v těchto regionech prostřednictvím majetkových účastí v místních společnostech.',
  sk: 'MZS Group pôsobí v týchto regiónoch prostredníctvom majetkových účastí v miestnych spoločnostiach.',
  pl: 'MZS Group działa w tych regionach poprzez udziały w lokalnych przedsiębiorstwach.',
  hu: 'Az MZS Group ezekben a régiókban helyi vállalkozásokban fennálló tulajdonrészei révén tevékenykedik.',
  lt: 'MZS Group šiuose regionuose veikia per turimas vietos įmonių kapitalo dalis.',
  uk: 'MZS Group працює в цих регіонах через участь у капіталі місцевих підприємств.',
  ro: 'MZS Group este activ în aceste regiuni prin participații la capitalul companiilor locale.',
  bg: 'MZS Group развива дейност в тези региони чрез дялови участия в местни компании.',
  el: 'Η MZS Group δραστηριοποιείται σε αυτές τις περιοχές μέσω συμμετοχών στο κεφάλαιο τοπικών επιχειρήσεων.',
  ru: 'MZS Group работает в этих регионах через участие в капитале местных предприятий.',
  tr: 'MZS Group, bu bölgelerde yerel şirketlerdeki sermaye payları aracılığıyla faaliyet göstermektedir.',
  'zh-CN': 'MZS Group 通过持有当地企业的股权，在这些地区开展业务。',
  ar: 'تعمل MZS Group في هذه المناطق من خلال حصص ملكية في شركات محلية.',
  'pt-BR': 'O MZS Group atua nessas regiões por meio de participações societárias em empresas locais.',
};

export function aboutMapCaption(locale: string): string {
  return captions[memberLocale(locale)];
}
