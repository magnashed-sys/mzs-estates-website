import Image from 'next/image';
import {getLocale} from 'next-intl/server';
import styles from './CaseStudies.module.css';

const captions: Record<string, readonly string[]> = {
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
const units: Record<string,string> = {nl:'units',en:'units',es:'unidades',de:'Einheiten',fr:'unités',it:'unità',pt:'unidades',ru:'объектов',ar:'وحدة',tr:'birim',lt:'vienetų'};

const financing: Record<string,string> = {
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

const management: Record<string,string> = {"nl":"Vastgoedbeheer en exploitatie","en":"Property management and operations","es":"Gestión y explotación inmobiliaria","de":"Immobilienverwaltung und Bewirtschaftung","fr":"Gestion et exploitation immobilières","it":"Gestione e valorizzazione immobiliare","pt":"Gestão e exploração imobiliária","ru":"Управление и эксплуатация недвижимости","ar":"إدارة وتشغيل العقارات","tr":"Gayrimenkul yönetimi ve işletmesi","lt":"Nekilnojamojo turto valdymas ir eksploatavimas"};

export default async function CaseStudies() {
 const locale = (await getLocale()).split('-')[0];
 const c = captions[locale] ?? captions.en;
 const unit = units[locale] ?? units.en;
 const projects = [
  {image:'amsterdam-85-units', title:c[0]+' · 85 '+unit, location:'Amsterdam, '+c[6], width:888, height:1080},
  {image:'ijmuiden-transformatie', title:c[1]+' · '+c[3], location:'IJmuiden, '+c[6], width:1400, height:933},
  {image:'ter-apel-jachthaven', title:c[2]+' · '+c[4], location:'Ter Apel, '+c[6], width:1400, height:789},
  {image:'heiloo-bedrijfsverzamelgebouw', title:financing[locale] ?? financing.en, location:'Heiloo, '+c[6], width:1280, height:720},
  {image:'alicante-beheer-exploitatie', title:management[locale] ?? management.en, location:'Alicante, '+c[7], width:1372, height:836},
  {image:'ibiza-20-units', title:c[0]+' · 20 '+unit, location:'Ibiza, '+c[7], width:1400, height:788},
 ];
 return <section className={styles.section} id="case-studies" aria-labelledby="case-studies-title">
  <div className={styles.heading}><span aria-hidden="true">04</span><h2 id="case-studies-title">Case Studies</h2></div>
  <p className={styles.introduction}>{introductions[locale] ?? introductions.en}</p>
  <div className={styles.grid}>{projects.map(project=><figure className={styles.card} key={project.image}>
   <div className={styles.visual}><Image src={'/images/case-studies/'+project.image+'.webp'} alt={project.title+' — '+project.location} width={project.width} height={project.height} sizes="(max-width: 700px) 100vw, (max-width: 1000px) 50vw, 33vw" /></div>
   <figcaption><h3>{project.title}</h3><p>{project.location}</p></figcaption>
  </figure>)}</div>
 </section>;
}
