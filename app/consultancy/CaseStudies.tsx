import Image from 'next/image';
import {getLocale} from 'next-intl/server';
import styles from './CaseStudies.module.css';

const captions: Record<string, readonly string[]> = {

  "da": [
    "Udvikling",
    "Transformation",
    "Køb",
    "Ejendom med flere lejere",
    "Lystbådehavn",
    "Ejendom med flere enheder",
    "Nederlandene",
    "Spanien"
  ],
  "uk": [
    "Девелопмент",
    "Трансформація",
    "Придбання",
    "Об’єкт із кількома орендарями",
    "Яхтова марина",
    "Багатоквартирний об’єкт",
    "Нідерланди",
    "Іспанія"
  ],
  "fi": [
    "Kehittäminen",
    "Muutoshanke",
    "Hankinta",
    "Monivuokralaiskiinteistö",
    "Venesatama",
    "Usean yksikön kiinteistö",
    "Alankomaat",
    "Espanja"
  ],
  "cs": [
    "Development",
    "Transformace",
    "Akvizice",
    "Nemovitost s více nájemci",
    "Přístav",
    "Nemovitost s více jednotkami",
    "Nizozemsko",
    "Španělsko"
  ]
,

"nb":["Utvikling", "Transformasjon", "Kjøp", "Eiendom med flere leietakere", "Småbåthavn", "Eiendom med flere enheter", "Nederland", "Spania"],
"sv":["Utveckling", "Omvandling", "Förvärv", "Fastighet med flera hyresgäster", "Småbåtshamn", "Fastighet med flera enheter", "Nederländerna", "Spanien"],
"pl":["Realizacja", "Przekształcenie", "Zakup", "Nieruchomość z wieloma najemcami", "Marina", "Nieruchomość wielolokalowa", "Holandia", "Hiszpania"],
"ro":["Dezvoltare", "Transformare", "Achiziție", "Imobil cu mai mulți chiriași", "Port de agrement", "Imobil cu mai multe unități", "Țările de Jos", "Spania"],
"zh":["开发", "改造", "收购", "多租户物业", "游艇码头", "多单元物业", "荷兰", "西班牙"],

 nl: ['Ontwikkeling', 'Transformatie', 'Aankoop', 'Multi-tenant vastgoed', 'Jachthaven', 'Multi-unit vastgoed', 'Nederland', 'Spanje'],
 en: ['Development', 'Transformation', 'Acquisition', 'Multi-tenant property', 'Marina', 'Multi-unit property', 'The Netherlands', 'Spain'],
 es: ['Desarrollo', 'Transformación', 'Adquisición', 'Inmueble multiinquilino', 'Puerto deportivo', 'Inmueble de varias unidades', 'Países Bajos', 'España'],
 de: ['Entwicklung', 'Umnutzung', 'Erwerb', 'Mehrmieterimmobilie', 'Yachthafen', 'Immobilie mit mehreren Einheiten', 'Niederlande', 'Spanien'],
 fr: ['Développement', 'Transformation', 'Acquisition', 'Immeuble multilocataire', 'Port de plaisance', 'Immeuble à plusieurs unités', 'Pays-Bas', 'Espagne'],
 it: ['Sviluppo', 'Trasformazione', 'Acquisizione', 'Immobile multi-locatario', 'Porto turistico', 'Immobile con più unità', 'Paesi Bassi', 'Spagna'],
 pt: ['Desenvolvimento', 'Transformação', 'Aquisição', 'Imóvel com múltiplos locatários', 'Marina', 'Imóvel com múltiplas unidades', 'Países Baixos', 'Espanha'],
 ru: ['Девелопмент', 'Преобразование', 'Приобретение', 'Объект с несколькими арендаторами', 'Яхтенная марина', 'Многоквартирный объект', 'Нидерланды', 'Испания'],
 ar: ['تطوير', 'تحويل', 'استحواذ', 'عقار متعدد المستأجرين', 'مرسى يخوت', 'عقار متعدد الوحدات', 'هولندا', 'إسبانيا'],
 tr: ['Geliştirme', 'Dönüşüm', 'Satın alma', 'Çok kiracılı gayrimenkul', 'Marina', 'Çok birimli gayrimenkul', 'Hollanda', 'İspanya'],
 lt: ['Plėtra', 'Pertvarkymas', 'Įsigijimas', 'Kelių nuomininkų turtas', 'Jachtų prieplauka', 'Kelių vienetų turtas', 'Nyderlandai', 'Ispanija'],
};
const units: Record<string,string> = {

  "da": "enheder",
  "uk": "одиниць",
  "fi": "yksikköä",
  "cs": "jednotek"
,

"nb":"enheter",
"sv":"enheter",
"pl":"lokali",
"ro":"unități",
"zh":"个单元",
nl:'units',en:'units',es:'unidades',de:'Einheiten',fr:'unités',it:'unità',pt:'unidades',ru:'объектов',ar:'وحدة',tr:'birim',lt:'vienetų'};

const financing: Record<string,string> = {

  "da": "Finansiering · Opførelse af erhvervscenter",
  "uk": "Фінансування · Будівництво бізнес-центру",
  "fi": "Rahoitus · Liikekeskuksen rakentaminen",
  "cs": "Financování · Výstavba podnikatelského centra"
,

"nb":"Finansiering · Oppføring av næringsbygg",
"sv":"Finansiering · Uppförande av företagscenter",
"pl":"Finansowanie · Budowa centrum biznesowego",
"ro":"Finanțare · Construcția unui centru de afaceri",
"zh":"融资 · 商业综合楼建设",

 nl:'Financiering · Realisatie bedrijfsverzamelgebouw',
 en:'Financing · Business centre construction',
 es:'Financiación · Construcción de centro empresarial',
 de:'Finanzierung · Errichtung eines Gewerbezentrums',
 fr:'Financement · Construction d’un centre d’activités',
 it:'Finanziamento · Realizzazione di un centro aziendale',
 pt:'Financiamento · Construção de um centro empresarial',
 ru:'Финансирование · Строительство бизнес-центра',
 ar:'تمويل · إنشاء مجمع أعمال',
 tr:'Finansman · İş merkezi inşaatı',
 lt:'Finansavimas · Verslo centro statyba',
};
const introductions: Record<string,string> = {

  "da": "Dette er et udvalg af vores projekter. I en personlig samtale fortæller vi gerne om flere projekter, der passer til dine interesser og planer.",
  "uk": "Це добірка наших проєктів. В особистій розмові ми радо розповімо про інші проєкти, що відповідають вашим інтересам і планам.",
  "fi": "Tässä on valikoima hankkeitamme. Keskustelemme mielellämme henkilökohtaisesti myös muista kiinnostuksiisi ja suunnitelmiisi sopivista hankkeista.",
  "cs": "Toto je výběr našich projektů. Při osobním rozhovoru rádi představíme další projekty odpovídající vašim zájmům a plánům."
,

"nb":"Dette er et utvalg av prosjektene våre. I en personlig samtale presenterer vi gjerne flere prosjekter som passer dine interesser og planer.",
"sv":"Detta är ett urval av våra projekt. Vid ett personligt samtal berättar vi gärna om fler projekt som passar dina intressen och planer.",
"pl":"To wybrane przykłady naszych projektów. Podczas osobistej rozmowy chętnie przedstawimy kolejne projekty odpowiadające Państwa zainteresowaniom i planom.",
"ro":"Aceasta este o selecție a proiectelor noastre. În cadrul unei discuții personale, vă prezentăm cu plăcere alte proiecte relevante pentru interesele și planurile dumneavoastră.",
"zh":"这里展示了我们的部分项目。我们很乐意在私人会谈中介绍更多符合您兴趣和计划的项目。",

  "nl": "Dit is een selectie van onze projecten. Tijdens een persoonlijk gesprek lichten we graag meer projecten toe die aansluiten bij uw interesses en plannen.",
  "en": "These are a selection of our projects. We would be pleased to discuss further projects relevant to your interests and plans in a personal conversation.",
  "es": "Esta es una selección de nuestros proyectos. En una conversación personal, estaremos encantados de presentar otros proyectos relacionados con sus intereses y planes.",
  "de": "Dies ist eine Auswahl unserer Projekte. In einem persönlichen Gespräch stellen wir Ihnen gerne weitere Projekte vor, die zu Ihren Interessen und Plänen passen.",
  "fr": "Voici une sélection de nos projets. Lors d’un échange personnel, nous serons heureux de vous présenter d’autres projets en lien avec vos intérêts et vos objectifs.",
  "it": "Questa è una selezione dei nostri progetti. Durante un colloquio personale, saremo lieti di presentarvi altri progetti in linea con i vostri interessi e programmi.",
  "pt": "Esta é uma seleção dos nossos projetos. Em uma conversa pessoal, teremos prazer em apresentar outros projetos alinhados aos seus interesses e planos.",
  "ru": "Здесь представлена лишь часть наших проектов. В личной беседе мы будем рады рассказать о других проектах, соответствующих вашим интересам и планам.",
  "ar": "هذه مجموعة مختارة من مشاريعنا. يسعدنا خلال لقاء شخصي مناقشة مشاريع أخرى تتناسب مع اهتماماتكم وخططكم.",
  "tr": "Bunlar projelerimizden seçilmiş örneklerdir. Kişisel bir görüşmede ilgi alanlarınıza ve planlarınıza uygun diğer projeleri paylaşmaktan memnuniyet duyarız.",
  "lt": "Tai tik dalis mūsų projektų. Asmeninio pokalbio metu mielai pristatysime daugiau projektų, atitinkančių jūsų interesus ir planus."
};

const management: Record<string,string> = {

  "da": "Ejendomsforvaltning og drift",
  "uk": "Управління та експлуатація нерухомості",
  "fi": "Kiinteistöjen hallinnointi ja ylläpito",
  "cs": "Správa a provoz nemovitostí"
,

"nb":"Eiendomsforvaltning og drift",
"sv":"Fastighetsförvaltning och drift",
"pl":"Zarządzanie i eksploatacja nieruchomości",
"ro":"Administrare și exploatare imobiliară",
"zh":"物业管理与运营",
"nl":"Vastgoedbeheer en exploitatie","en":"Property management and operations","es":"Gestión y explotación inmobiliaria","de":"Immobilienverwaltung und Bewirtschaftung","fr":"Gestion et exploitation immobilières","it":"Gestione e valorizzazione immobiliare","pt":"Gestão e exploração imobiliária","ru":"Управление и эксплуатация недвижимости","ar":"إدارة وتشغيل العقارات","tr":"Gayrimenkul yönetimi ve işletmesi","lt":"Nekilnojamojo turto valdymas ir eksploatavimas"};

export default async function CaseStudies({sectionNumber = '04'}: {sectionNumber?: string}) {
 const locale = (await getLocale()).split('-')[0];
 const c = captions[locale] ?? captions.en;
 const unit = units[locale] ?? units.en;
 const projects = [
  {image:'amsterdam-85-units', title:c[0]+' · 85 '+unit, location:'Amsterdam, '+c[6], width:1400, height:876},
  {image:'ijmuiden-transformatie', title:c[1]+' · '+c[3], location:'IJmuiden, '+c[6], width:1400, height:876},
  {image:'ibiza-20-units', title:c[0]+' · 20 '+unit, location:'Ibiza, '+c[7], width:1400, height:876},
  {image:'ter-apel-jachthaven', title:c[2]+' · '+c[4], location:'Ter Apel, '+c[6], width:1400, height:789},
  {image:'alicante-beheer-exploitatie', title:management[locale] ?? management.en, location:'Alicante, '+c[7], width:1372, height:836},
  {image:'heiloo-bedrijfsverzamelgebouw', title:financing[locale] ?? financing.en, location:'Heiloo, '+c[6], width:1280, height:720},
 ];
 return <section className={styles.section} id="case-studies" aria-labelledby="case-studies-title">
  <div className={styles.heading}><span aria-hidden="true">{sectionNumber}</span><h2 id="case-studies-title">{({da:'Projekteksempler',uk:'Приклади проєктів',fi:'Hanke-esimerkit',cs:'Případové studie'} as Record<string,string>)[locale] ?? 'Case Studies'}</h2></div>
  <p className={styles.introduction}>{introductions[locale] ?? introductions.en}</p>
  <div className={styles.grid}>{projects.map(project=><figure className={styles.card} key={project.image}>
   <div className={['amsterdam-85-units', 'ijmuiden-transformatie', 'ibiza-20-units'].includes(project.image) ? `${styles.visual} ${styles.unfiltered}` : styles.visual}><Image src={'/images/case-studies/'+project.image+'.webp'} alt={project.title+' — '+project.location} width={project.width} height={project.height} sizes="(max-width: 700px) 100vw, (max-width: 1000px) 50vw, 33vw" /></div>
   <figcaption><h3>{project.title}</h3><p>{project.location}</p></figcaption>
  </figure>)}</div>
 </section>;
}

