// Selected extracts from AMS003 DO plan book, 20 March 2026. Page numbers retain provenance.
// Source pixels and drawing geometry are preserved; presentation borders are excluded.
export type FlorawegVisual = {
  file: string; labelKey: string; group: "impressions" | "details" | "context" | "architecture" | "plans" | "landscape";
  width: number; height: number; page: number; suffix?: string; floor?: string; section?: string; featured?: boolean;
};
export const florawegVisuals: FlorawegVisual[] = [
  {
    "file": "park-noord.webp",
    "labelKey": "p000",
    "group": "impressions",
    "width": 2800,
    "height": 1790,
    "page": 40
  },
  {
    "file": "vuurwerkerweg.webp",
    "labelKey": "p001",
    "group": "impressions",
    "width": 2800,
    "height": 1791,
    "page": 41
  },
  {
    "file": "park-oost.webp",
    "labelKey": "p002",
    "group": "impressions",
    "width": 2800,
    "height": 1790,
    "page": 42
  },
  {
    "file": "vergezicht-floraweg.webp",
    "labelKey": "p005",
    "group": "context",
    "width": 2078,
    "height": 1324,
    "page": 43,
    "suffix": "Floraweg"
  },
  {
    "file": "vergezicht-kamperfoelieweg.webp",
    "labelKey": "p005",
    "group": "context",
    "width": 2078,
    "height": 1324,
    "page": 43,
    "suffix": "Kamperfoelieweg"
  },
  {
    "file": "vergezicht-buiksloterpark.webp",
    "labelKey": "p005",
    "group": "context",
    "width": 1485,
    "height": 947,
    "page": 43,
    "suffix": "Buiksloterpark"
  },
  {
    "file": "vergezicht-klaprozenweg.webp",
    "labelKey": "p005",
    "group": "context",
    "width": 1040,
    "height": 663,
    "page": 43,
    "suffix": "Klaprozenweg"
  },
  {
    "file": "balkon-detail.webp",
    "labelKey": "p004",
    "group": "details",
    "width": 2800,
    "height": 1784,
    "page": 62,
    "suffix": "1"
  },
  {
    "file": "terras-detail.webp",
    "labelKey": "p004",
    "group": "details",
    "width": 2800,
    "height": 1778,
    "page": 62,
    "suffix": "2"
  },
  {
    "file": "groene-plint.webp",
    "labelKey": "p004",
    "group": "details",
    "width": 1732,
    "height": 1104,
    "page": 62,
    "suffix": "3"
  },
  {
    "file": "groene-gevel.webp",
    "labelKey": "p004",
    "group": "details",
    "width": 2800,
    "height": 1778,
    "page": 62,
    "suffix": "4"
  },
  {
    "file": "locatie-amsterdam.webp",
    "labelKey": "p005",
    "group": "context",
    "width": 2800,
    "height": 1868,
    "page": 4
  },
  {
    "file": "locatie-blok-b.webp",
    "labelKey": "p005",
    "group": "context",
    "width": 2800,
    "height": 1868,
    "page": 5
  },
  {
    "file": "plankaart-klaprozenbuurt.webp",
    "labelKey": "p005",
    "group": "context",
    "width": 2800,
    "height": 1868,
    "page": 6
  },
  {
    "file": "plankaart-gemeente.webp",
    "labelKey": "p005",
    "group": "context",
    "width": 2800,
    "height": 1868,
    "page": 9
  },
  {
    "file": "situatie-blok-b.webp",
    "labelKey": "p008",
    "group": "context",
    "width": 2800,
    "height": 1868,
    "page": 14,
    "featured": true
  },
  {
    "file": "ontsluiting.webp",
    "labelKey": "p008",
    "group": "context",
    "width": 2800,
    "height": 1868,
    "page": 15
  },
  {
    "file": "positie-toren.webp",
    "labelKey": "p005",
    "group": "context",
    "width": 1484,
    "height": 1568,
    "page": 8
  },
  {
    "file": "bouwmassa.webp",
    "labelKey": "p003",
    "group": "architecture",
    "width": 2800,
    "height": 1868,
    "page": 11
  },
  {
    "file": "gevelaanzichten-1.webp",
    "labelKey": "p012",
    "group": "architecture",
    "width": 2800,
    "height": 1868,
    "page": 33,
    "suffix": "1"
  },
  {
    "file": "gevelaanzichten-2.webp",
    "labelKey": "p012",
    "group": "architecture",
    "width": 2800,
    "height": 1868,
    "page": 34,
    "suffix": "2"
  },
  {
    "file": "gevelritme.webp",
    "labelKey": "p012",
    "group": "architecture",
    "width": 2800,
    "height": 1868,
    "page": 35,
    "suffix": "3"
  },
  {
    "file": "torenkroon.webp",
    "labelKey": "p012",
    "group": "architecture",
    "width": 2800,
    "height": 1868,
    "page": 36,
    "suffix": "4"
  },
  {
    "file": "gevel-toren.webp",
    "labelKey": "p012",
    "group": "architecture",
    "width": 2800,
    "height": 1868,
    "page": 37,
    "suffix": "5"
  },
  {
    "file": "gevel-plint.webp",
    "labelKey": "p012",
    "group": "architecture",
    "width": 2800,
    "height": 1868,
    "page": 38,
    "suffix": "6",
    "featured": true
  },
  {
    "file": "blok-b-begane-grond.webp",
    "labelKey": "p006",
    "group": "plans",
    "width": 2800,
    "height": 1868,
    "page": 18,
    "suffix": "B · 00",
    "floor": "B · 00"
  },
  {
    "file": "toren-begane-grond.webp",
    "labelKey": "p006",
    "group": "plans",
    "width": 2800,
    "height": 1868,
    "page": 19,
    "suffix": "00",
    "floor": "00"
  },
  {
    "file": "toren-atelierwoningen.webp",
    "labelKey": "p006",
    "group": "plans",
    "width": 2800,
    "height": 1868,
    "page": 20,
    "suffix": "00 · atelier",
    "floor": "00 · atelier"
  },
  {
    "file": "blok-b-eerste-verdieping.webp",
    "labelKey": "p006",
    "group": "plans",
    "width": 2800,
    "height": 1868,
    "page": 21,
    "suffix": "B · 01",
    "floor": "B · 01"
  },
  {
    "file": "toren-01.webp",
    "labelKey": "p006",
    "group": "plans",
    "width": 2800,
    "height": 1868,
    "page": 22,
    "suffix": "01",
    "floor": "01"
  },
  {
    "file": "toren-02-04.webp",
    "labelKey": "p006",
    "group": "plans",
    "width": 2800,
    "height": 1868,
    "page": 23,
    "suffix": "02–04",
    "floor": "02–04"
  },
  {
    "file": "toren-05.webp",
    "labelKey": "p006",
    "group": "plans",
    "width": 2800,
    "height": 1868,
    "page": 24,
    "suffix": "05",
    "floor": "05"
  },
  {
    "file": "toren-06-13.webp",
    "labelKey": "p006",
    "group": "plans",
    "width": 2800,
    "height": 1868,
    "page": 25,
    "suffix": "06–13",
    "floor": "06–13",
    "featured": true
  },
  {
    "file": "toren-14.webp",
    "labelKey": "p006",
    "group": "plans",
    "width": 2800,
    "height": 1868,
    "page": 26,
    "suffix": "14",
    "floor": "14"
  },
  {
    "file": "toren-15.webp",
    "labelKey": "p006",
    "group": "plans",
    "width": 2800,
    "height": 1868,
    "page": 27,
    "suffix": "15",
    "floor": "15"
  },
  {
    "file": "dak.webp",
    "labelKey": "p003",
    "group": "plans",
    "width": 2800,
    "height": 1868,
    "page": 28,
    "suffix": "16"
  },
  {
    "file": "doorsnede-bb.webp",
    "labelKey": "p003",
    "group": "plans",
    "width": 2800,
    "height": 1868,
    "page": 30,
    "suffix": "B–B",
    "section": "B–B"
  },
  {
    "file": "doorsnede-aa.webp",
    "labelKey": "p003",
    "group": "plans",
    "width": 2800,
    "height": 1868,
    "page": 31,
    "suffix": "A–A",
    "section": "A–A"
  },
  {
    "file": "duurzaamheidsprincipes.webp",
    "labelKey": "p010",
    "group": "landscape",
    "width": 2800,
    "height": 1868,
    "page": 45,
    "suffix": "45"
  },
  {
    "file": "groen-zuid.webp",
    "labelKey": "p010",
    "group": "landscape",
    "width": 2800,
    "height": 1868,
    "page": 46,
    "suffix": "46"
  },
  {
    "file": "groen-noord.webp",
    "labelKey": "p010",
    "group": "landscape",
    "width": 2800,
    "height": 1868,
    "page": 47,
    "suffix": "47"
  },
  {
    "file": "daktuin-context.webp",
    "labelKey": "p010",
    "group": "landscape",
    "width": 2800,
    "height": 1868,
    "page": 48,
    "suffix": "48",
    "featured": true
  },
  {
    "file": "daktuin-schets.webp",
    "labelKey": "p010",
    "group": "landscape",
    "width": 2800,
    "height": 1868,
    "page": 49,
    "suffix": "49"
  },
  {
    "file": "ecologie-zuid.webp",
    "labelKey": "p010",
    "group": "landscape",
    "width": 2800,
    "height": 1868,
    "page": 52,
    "suffix": "52"
  },
  {
    "file": "ecologie-noord.webp",
    "labelKey": "p010",
    "group": "landscape",
    "width": 2800,
    "height": 1868,
    "page": 57,
    "suffix": "57"
  }
];
