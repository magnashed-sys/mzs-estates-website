import styles from "./propertyPresentation.module.css";
import {nuciaNeighbourhoodCopy} from "./nuciaNeighbourhoodCopy";

const places = [
  {name: "Altea", query: "Casco antiguo Altea", description: 4},
  {name: "Playa de Poniente · Benidorm", query: "Playa de Poniente Benidorm", description: 5},
  {name: "Faro de l’Albir", query: "Faro de l'Albir", description: 6},
  {name: "Ciudad Deportiva Camilo Cano", query: "Ciudad Deportiva Camilo Cano La Nucia", description: 7},
] as const;

export default function VillaNeighbourhood({locale}: {locale: string}) {
  const copy = nuciaNeighbourhoodCopy[locale] || nuciaNeighbourhoodCopy.en;
  return (
    <section className={styles.marinaMapSection} aria-labelledby="nucia-map-heading">
      <div className={styles.marinaMapIntroduction}>
        <p className={styles.kicker}>LA NUCÍA / COSTA BLANCA</p>
        <h2 id="nucia-map-heading">{copy[0]}</h2>
        <p>{copy[1]}</p>
      </div>
      <div className={styles.marinaMapLayout}>
        <div className={styles.marinaMapMain}>
          <div className={styles.marinaMapFrame}>
            <iframe src="https://maps.google.com/maps?q=La%20Nucia%20Alicante%20Spain&z=12&output=embed"
              title={`La Nucía · ${copy[0]}`} loading="lazy"
              referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
          </div>
          <p className={styles.marinaMapNote}>{copy[2]}</p>
          <a className={styles.marinaMapLink}
            href="https://www.google.com/maps/search/?api=1&query=La%20Nucia%20Alicante%20Spain"
            target="_blank" rel="noopener noreferrer">
            {copy[3]} <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div className={styles.marinaNearby}>
          {places.map((place, index) => (
            <a key={place.query} className={styles.marinaNearbyItem}
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.query)}`}
              target="_blank" rel="noopener noreferrer">
              <span className={styles.marinaNearbyIndex}>{index + 1} /</span>
              <strong>{place.name}</strong>
              <span>{copy[place.description]}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
