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

export default async function CaseStudies() {
 const locale = (await getLocale()).split('-')[0];
 const c = captions[locale] ?? captions.en;
 const unit = units[locale] ?? units.en;
 const projects = [
  {image:'amsterdam-85-units', title:c[0]+' · 85 '+unit, location:'Amsterdam, '+c[6], width:888, height:1080},
  {image:'ijmuiden-transformatie', title:c[1]+' · '+c[3], location:'IJmuiden, '+c[6], width:1400, height:933},
  {image:'ter-apel-jachthaven', title:c[2]+' · '+c[4], location:'Ter Apel, '+c[6], width:1400, height:789},
  {image:'ibiza-transformatie', title:c[1]+' · '+c[5], location:'Ibiza, '+c[7], width:1400, height:792},
  {image:'ibiza-20-units', title:c[0]+' · 20 '+unit, location:'Ibiza, '+c[7], width:1400, height:788},
 ];
 return <section className={styles.section} id="case-studies" aria-labelledby="case-studies-title">
  <div className={styles.heading}><span aria-hidden="true">04</span><h2 id="case-studies-title">Case Studies</h2></div>
  <div className={styles.grid}>{projects.map(project=><figure className={styles.card} key={project.image}>
   <div className={styles.visual}><Image src={'/images/case-studies/'+project.image+'.webp'} alt={project.title+' — '+project.location} width={project.width} height={project.height} sizes="(max-width: 700px) 100vw, (max-width: 1000px) 50vw, 33vw" /></div>
   <figcaption><h3>{project.title}</h3><p>{project.location}</p></figcaption>
  </figure>)}</div>
 </section>;
}
