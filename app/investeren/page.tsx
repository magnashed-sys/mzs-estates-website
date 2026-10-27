import type {Metadata} from "next";
import Image from "next/image";
import {notFound} from "next/navigation";
import InvestorForm from "./InvestorForm";
import s from "./investeren.module.css";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Samenwerken met MZS Group — concept",robots:{index:false,follow:false},alternates:{canonical:null}};
const terms=[
 ["€100.000","Deelname vanaf"],
 ["ca. 8%","Vaste rente per jaar"],
 ["1–3 jaar","Overeengekomen looptijd"],
 ["Maandelijks","Uitbetaling van rente"]
];
export default function InvestorConcept(){
 if(process.env.VERCEL_ENV!=="preview")notFound();
 return <main className={s.page} lang="nl">
  <a className={s.skip} href="#inhoud">Naar de inhoud</a>
  <div className={s.preview}>ONTWERPCONCEPT <span>Alleen ter beoordeling · formulier verzendt niet</span></div>
  <header className={s.header}>
   <a className={s.wordmark} href="/nl" aria-label="MZS Group startpagina"><span>MZS</span><small>GROUP</small></a>
   <nav aria-label="Navigatie op deze pagina"><a href="#uitgangspunten">Voorwaarden</a><a href="#zekerheid">Zekerheid</a><a href="#werkwijze">Werkwijze</a></nav>
   <a className={s.headerCta} href="#kennismaken">Kennismaken <span aria-hidden="true">↗</span></a>
  </header>
  <section className={s.hero} id="inhoud">
   <div className={s.heroCopy}>
    <p className={s.eyebrow}>MZS GROUP / KAPITAAL & SAMENWERKING</p>
    <h1>Vastgoed als basis.<br/><em>Samenwerking als uitgangspunt.</em></h1>
    <p className={s.lead}>Verstrek kapitaal met maandelijkse rentebetalingen en een eerste hypotheekrecht op bestaand, inkomsten genererend vastgoed.</p>
    <a className={s.button} href="#kennismaken">Plan een kennismaking <span aria-hidden="true">↗</span></a>
    <p className={s.heroNote}>Vanaf €100.000 · Een persoonlijk gesprek als eerste stap</p>
   </div>
   <figure className={s.heroVisual}>
    <Image src="/images/capital/mediterranean-light.webp" alt="Sfeerbeeld van mediterrane architectuur in warm zonlicht" width={1536} height={1024} priority sizes="(max-width: 800px) 100vw, 45vw"/>
    <figcaption><span>PRIVATE. INDEPENDENT. INTERNATIONAL.</span></figcaption>
   </figure>
  </section>
  <section id="uitgangspunten" className={s.terms} aria-label="Uitgangspunten van de samenwerking">
   {terms.map(([value,label])=><div key={label}><p>{value}</p><span>{label}</span></div>)}
  </section>
  <p className={s.termsNote}>Het exacte rentepercentage wordt per mogelijkheid overeengekomen en staat vast gedurende de afgesproken looptijd.</p>
  <section className={s.intro}>
   <div><p className={s.eyebrow}>01 / EEN PASSENDE SAMENWERKING</p><h2>Jouw kapitaal.<br/><em>Een gedeeld perspectief.</em></h2></div>
   <div className={s.prose}><p>MZS Group biedt verschillende mogelijkheden voor kapitaalverstrekking. We beginnen bij jouw uitgangspunten: het bedrag dat je wilt verstrekken, je gewenste looptijd en de voorwaarden die je belangrijk vindt.</p><p>Daarna bespreken we een concrete mogelijkheid, het betreffende vastgoed en de financieringsstructuur. Persoonlijk, zorgvuldig en met ruimte voor jouw vragen.</p><a className={s.textLink} href="#kennismaken">Ontdek wat bij je past <span aria-hidden="true">↗</span></a></div>
  </section>
  <section id="zekerheid" className={s.security}>
   <div className={s.securityIntro}><p className={s.eyebrow}>02 / VASTGOED ALS ZEKERHEID</p><h2>Een eerste hypotheekrecht.<br/><em>Inzicht in wat erachter zit.</em></h2><p>De zekerheid wordt vastgelegd op het betreffende vastgoed. Voor je een beslissing neemt, bespreken we het object, de waardering, bestaande financieringen en de verhouding tussen de lening en de vastgoedwaarde.</p></div>
   <div className={s.securityGrid}>
    <article><span className={s.index}>I</span><h3>Bestaand vastgoed</h3><p>Vastgoed dat inkomsten genereert vormt de basis. Per mogelijkheid ontvang je informatie over het object en de financiering.</p></article>
    <article><span className={s.index}>II</span><h3>Afspraken op papier</h3><p>Rente, looptijd, terugbetaling en het eerste hypotheekrecht worden vastgelegd in de overeenkomst en hypotheekdocumentatie.</p></article>
    <article><span className={s.index}>III</span><h3>Duidelijkheid over aflossing</h3><p>De hoofdsom wordt volledig afgelost aan het einde van de looptijd. Verlenging kan alleen met wederzijdse instemming, onder dan overeen te komen voorwaarden.</p></article>
   </div>
   <aside className={s.risk}><strong>Notarieel vastgelegde afspraken.</strong><p>Alle afspraken worden vastgelegd bij lokale notarissen. Dit omvat de overeengekomen rente, looptijd, terugbetaling en het eerste hypotheekrecht op het betreffende vastgoed.</p></aside>
  </section>
  <section id="werkwijze" className={s.process}>
   <div className={s.processHeading}><p className={s.eyebrow}>03 / VAN GESPREK NAAR SAMENWERKING</p><h2>Een persoonlijke aanpak.<br/><em>Van de eerste vraag tot de afspraken.</em></h2></div>
   <ol>{[
    ["Kennismaken","We bespreken je interesse, beschikbare kapitaal en gewenste looptijd. Een eerste gesprek is vrijblijvend."],
    ["Een mogelijkheid beoordelen","Je ontvangt informatie over het vastgoed, de voorwaarden, de zekerheden, de risico’s en de beoogde bron van aflossing."],
    ["De samenwerking vastleggen","Je krijgt ruimte om de documentatie te beoordelen en onafhankelijk advies in te winnen. Bij wederzijdse overeenstemming leggen we de afspraken vast."]
   ].map(([title,body],i)=><li key={title}><span>0{i+1}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol>
  </section>
  <section className={s.faq} aria-labelledby="vragen"><div><p className={s.eyebrow}>GOED OM TE WETEN</p><h2 id="vragen">Een paar eerste vragen.</h2></div><div>
   <details><summary>Is de rente gedurende de looptijd vast?</summary><p>Ja. Het exacte percentage wordt per mogelijkheid overeengekomen, rond 8% per jaar, en blijft tijdens de overeengekomen looptijd vast. De rente wordt maandelijks uitbetaald.</p></details>
   <details><summary>Wanneer krijg ik mijn hoofdsom terug?</summary><p>De volledige hoofdsom is aan het einde van de afgesproken looptijd van 1 tot 3 jaar terug te betalen. Er is geen tussentijdse aflossing voorzien. Verlenging gebeurt uitsluitend met wederzijdse instemming.</p></details>
   <details><summary>Gaat het om één specifiek vastgoedproject?</summary><p>Nee. De kennismaking is gericht op een bredere samenwerking met MZS Group. We bespreken welke van de beschikbare mogelijkheden aansluit bij jouw uitgangspunten.</p></details>
   <details><summary>Verplicht een kennismaking mij tot deelname?</summary><p>Nee. Een aanvraag en kennismaking zijn vrijblijvend. Een eventuele samenwerking wordt pas daarna afzonderlijk beoordeeld en vastgelegd.</p></details>
  </div></section>
  <section id="kennismaken" className={s.contact}>
   <div className={s.contactCopy}><p className={s.eyebrow}>04 / LATEN WE KENNISMAKEN</p><h2>Een goed gesprek<br/><em>is het begin.</em></h2><p>Vertel ons iets over je interesse. Samen onderzoeken we welke mogelijkheid bij je past.</p><figure className={s.conversation}><Image src="/images/capital/personal-conversation.webp" alt="Sfeerbeeld van een rustige plek voor een persoonlijk gesprek" fill sizes="(max-width: 800px) 100vw, 40vw"/><figcaption>Sfeerbeeld</figcaption></figure></div>
   <InvestorForm/>
  </section>
  <footer className={s.footer}><div className={s.wordmark}><span>MZS</span><small>GROUP</small></div><p>Private. Independent. International.</p><a href="#inhoud">Terug naar boven ↑</a></footer>
 </main>;
}
