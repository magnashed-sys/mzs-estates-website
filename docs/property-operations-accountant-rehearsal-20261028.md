# Property Operations — Correctievoorstellen en accountant-proefexport

Datum: 28 oktober 2026. Scope: alleen **MZS Staging** in Draft PR #143, geen productie-uitrol.

## Uitgewerkt

1. Na **afgeronde** beoordeling (goedgekeurd of afgewezen) kan een Group Administrator een **correctievoorstel** vastleggen met reden, nieuwe omschrijving en voorgestelde net- en btw-bedragen.
2. Een database-trigger controleert administrator, oude reviewstatus, geldige unittoewijzing, bedragen in centen en dat de correctie iets verandert. Het voorstel is apart, auditbaar, append-only en niet wijzigbaar. De oorspronkelijke leveranciersfactuur, haar document en goedkeuring blijven onaangetast. Maximaal één open correctievoorstel per oorspronkelijk concept. De huidige UI biedt dit alleen voor concepten met **één** object- of unittoewijzing; meerdere unitverdelingen vragen nog een uitgebreide editor.
3. Dit is **nog niet de definitieve correctie-afhandeling**: er is geen nieuwe definitieve inkoopfactuur, creditnota of grootboekcorrectie aangemaakt. Een voorstel kan pas via een aanvullende, goedgekeurde opvolgworkflow worden verwerkt.
4. De proefexport staat onder `/admin/workspaces/estates/expenses`; een actieve Group Administrator kan een **juridische entiteit** en kalenderjaar (oorspronkelijke factuurdatum) selecteren. De server ondersteunt uitsluitend Preview met Staging Supabase.
5. De server haalt per entiteit en jaar alle beschikbare inkoopconcepten gepagineerd en geteld op, controleert bijbehorende review-events, bewijsdocumenten, leveranciers en correctievoorstellen. Onvolledige of veranderende tellingen, verkeerde entiteit, ontbrekend origineel bij goedgekeurde kosten en SHA-256 afwijkingen **stoppen de export zonder gedeeltelijk ZIP-bestand**.
6. Alleen definitief intern **goedgekeurde kosten zonder open correctievoorstel** komen in `purchase-invoices.csv`. Het originele document wordt intern gedownload, op grootte en SHA-256 gecontroleerd, en toegevoegd aan een lokaal gemaakt ZIP-bestand. De bijbehorende uitsplitsing staat in `property-allocations.csv`.
7. Concepten, afgewezen posten, ingediende maar niet goedgekeurde posten en eerder goedgekeurde posten met een **open correctievoorstel** komen uitsluitend in `exceptions.csv`.
8. Het ZIP bevat een duidelijke waarschuwing `STAGING REHEARSAL / NOT COMPLETE LEGAL ACCOUNTS`, plus README en manifest met SHA-256 per bronbestand en exportbestand. Beperking: 24 MB ongecomprimeerde inhoud, maximaal 150 bestanden. Bestandsnamen worden getoetst op veilige paden en worden niet van onbetrouwbare bestandsnamen overgenomen.

## Wat deze export niet pretendeert

- Geen volledige boekhouding, btw-aangifte, jaarrekening, betaal-/bankafstemming, Private Capital-rekening, volledige verkoopfacturen of bruto/netto-resultaat.
- Zonder externe accountantstoetsing geen uitspraak over lokale btw-aftrekbaarheid, kostendatum, fiscale verplichtingen of winst.
- Geen externe mailverzending; het pakket wordt alleen op aanvraag van de actieve administrator gedownload.
- Geen documenten van andere juridische entiteiten of oncontroleerbare onvolledige selectie.
- De identiteit in de export is de exact geselecteerde juridische entiteit, niet een op basis van eigenaarsnaam veronderstelde vennootschap.

## Geteste randgevallen / nog uit te voeren

**Automatische controles:** database-RLS, geen schrijfrechten voor cliënten of anonieme bezoekers, complete review voor correctieverzoek, onveranderbare originele bedragen en documenten, geen dubbel correctievoorstel, rekensommen per unit, ZIP-bestandsveiligheid, CRC, herhaalbare extractie, fail-closed export en autorisatie van route.

**Nog uit te voeren via een ingelogde browser op Staging:**
- Upload een synthetische leveranciers-PDF in een synthetisch aangemaakt kostenconcept, voer submit/approve uit, download originele PDF, exporteer een ZIP voor juiste entiteit en jaar.
- Controleer dat de ZIP een originele PDF, `purchase-invoices.csv`, `property-allocations.csv`, `exceptions.csv` en `manifest.json` bevat.
- Dien een correctievoorstel in voor een beoordeelde synthetische post; exporteer opnieuw en verifieer dat die post uit de goedgekeurde kosten is verwijderd en naar uitzonderingen is verhuisd.
- Test meerdere juridische entiteiten en dat geen enkele derde partij posten van een andere entiteit ziet; controleer bestandsgrootte, mobiele toegang, herlogin en gesloten sessie.
- Pas **geen** persoonlijke WhatsApp-gegevens van Catherine, originele private kosten of eerder voorbereide factuur 7113 automatisch toe. Verifieer eerst welke bewijsstukken en feitelijke uitgifte-/betaaldata beschikbaar zijn.

## Volgende noodzakelijke ontwikkelstap

De definitieve opvolgprocedure voor een correctievoorstel: door bevoegde beheerder goedgekeurde vervangingsversie met eventueel nieuw bewijsstuk, expliciete herallocatie, behoud van volledige geschiedenis en aparte exportversies/diff. Vervolgens samenvoegen van goedgekeurde huur-, boekings- en kapitaalgegevens in een compleet exportpakket voor lokale accountants. Geen Production-publicatie zonder aparte goedkeuring.
