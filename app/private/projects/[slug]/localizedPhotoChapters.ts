import {nuciaExtraCopy} from "./nuciaExtraCopy";
import chapters from "./villaLaNuciaPhotos.json";

// Only fixed presentation copy is translated; the source asset metadata stays authoritative.
const copyKeys: Record<string, string> = {
  "Pool & terraces": "p455",
  "Sunlight, water and room to unwind.": "p456",
  "Pool and terraces at Villa La Nucia": "p457",
  "Pool and terraces": "p458",
  "Poolside living at Villa La Nucia": "p459",
  "Poolside living": "p460",
  "Outdoor seating at Villa La Nucia": "p461",
  "Outdoor seating": "p462",
  "Barbecue terrace at Villa La Nucia": "p463",
  "Barbecue terrace": "p464",
  "Poolside shower at Villa La Nucia": "p465",
  "Poolside shower": "p466",
  "Arrival": "p467",
  "A private entrance to your Costa Blanca stay.": "p468",
  "The villa at Villa La Nucia": "p469",
  "The villa": "p470",
  "Main entrance at Villa La Nucia": "p471",
  "Main entrance": "p472",
  "Villa approach at Villa La Nucia": "p473",
  "Villa approach": "p474",
  "Living & dining": "p475",
  "Gather in the heart of the main residence.": "p476",
  "Living and dining at Villa La Nucia": "p477",
  "Living and dining": "p478",
  "The lounge at Villa La Nucia": "p479",
  "The lounge": "p480",
  "Doors to the terrace at Villa La Nucia": "p481",
  "Doors to the terrace": "p482",
  "Interior hallway at Villa La Nucia": "p483",
  "Interior hallway": "p484",
  "Main bedrooms": "p485",
  "Two individual bedrooms in the main residence.": "p486",
  "Bedroom with botanical bedding at Villa La Nucia": "p487",
  "Bedroom with botanical bedding": "p488",
  "Bedroom wardrobe and window at Villa La Nucia": "p489",
  "Bedroom wardrobe and window": "p490",
  "Bedroom with plum bedding at Villa La Nucia": "p491",
  "Bedroom with plum bedding": "p492",
  "Bedroom dressing area at Villa La Nucia": "p493",
  "Bedroom dressing area": "p494",
  "Main bathroom": "p495",
  "A closer look at the bathroom.": "p496",
  "Main bathroom at Villa La Nucia": "p497",
  "Shower and basin at Villa La Nucia": "p498",
  "Shower and basin": "p499",
  "Guest room · white": "p500",
  "A separate space with its own bathroom.": "p501",
  "Guest bedroom at Villa La Nucia": "p502",
  "Guest bedroom": "p503",
  "Guest bedroom and bathroom entrance at Villa La Nucia": "p504",
  "Guest bedroom and bathroom entrance": "p505",
  "Guest bedroom reverse view at Villa La Nucia": "p506",
  "Guest bedroom reverse view": "p507",
  "Guest shower room at Villa La Nucia": "p508",
  "Guest shower room": "p509",
  "Guest bathroom basin at Villa La Nucia": "p510",
  "Guest bathroom basin": "p511",
  "Guest room · green": "p512",
  "Another private room, with an adjoining bathroom.": "p513",
  "Guest bedroom with green artwork at Villa La Nucia": "p514",
  "Guest bedroom with green artwork": "p515",
  "Wardrobe and bathroom entrance at Villa La Nucia": "p516",
  "Wardrobe and bathroom entrance": "p517",
  "Guest bedroom window at Villa La Nucia": "p518",
  "Guest bedroom window": "p519",
  "Guest shower at Villa La Nucia": "p520",
  "Guest shower": "p521",
  "Guest bathroom at Villa La Nucia": "p522",
  "Guest bathroom": "p523",
  "Outdoor living": "p524",
  "Relax by the pool, gather on the terrace and enjoy the barbecue area.": "p525"
};

// The new roof-terrace chapter joins the Dutch review first.
const dutchRoofCopy: Record<string, string> = {
  "Private roof terrace": "Privédakterras",
  "Above the rear guest accommodation, with two sun loungers, a seating area and views over the villa and its surroundings. Access is via the outdoor staircase.": "Boven het achterste gastenverblijf, met twee ligbedden, een zitje en uitzicht over de villa en de omgeving. Bereikbaar via de buitentrap.",
  "Private roof terrace with two sun loungers, two chairs and a small table at Villa La Nucia": "Privédakterras met twee ligbedden, twee stoelen en een bijzettafel bij Villa La Nucía",
  "Private roof terrace with loungers and seating": "Privédakterras met ligbedden en zitje",
  "Curved outdoor staircase beside the rear guest accommodation leading to the roof terrace at Villa La Nucia": "Gebogen buitentrap naast het achterste gastenverblijf naar het dakterras van Villa La Nucía",
  "Access via the outdoor staircase": "Toegang via de buitentrap",
  "View from the roof terrace over the pool, terraces, palm trees and main residence at Villa La Nucia": "Uitzicht vanaf het dakterras over het zwembad, de terrassen, palmbomen en de hoofdwoning van Villa La Nucía",
  "View over the pool and villa": "Uitzicht over zwembad en villa",
};

export function sourcePhotoChapters(locale = "en") {
  return chapters.filter(chapter => !chapter.locales || chapter.locales.includes(locale));
}

export function localizedPhotoChapters(t: (key: string) => string, locale = "en") {
  const extra = nuciaExtraCopy(locale);
  const copy = (text: string) => copyKeys[text] ? t(copyKeys[text]) : (locale === "nl" ? dutchRoofCopy[text] : undefined) || extra[text] || text;
  return sourcePhotoChapters(locale).map(chapter => ({
    ...chapter, title: copy(chapter.title), description: copy(chapter.description),
    photos: chapter.photos.map(photo => ({...photo, alt: copy(photo.alt), caption: copy(photo.caption)})),
  }));
}

