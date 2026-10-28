# Property Operations — eerste beheerpagina / Staging review

Datum: 28 oktober 2026
Status: **Preview, uitsluitend lezen en rekenen. Geen opslag, factuuruitgifte of financiële mutaties.**
Werkbranch: `feature/property-operations-accountancy-foundation-20261028`.
PR: [#143](https://github.com/magnashed-sys/mzs-estates-website/pull/143).

## Nieuwe pagina

Na aanmelding als actieve Group Administrator:

`/admin/workspaces/estates/expenses`

Bereikbaar via Estates Workspace → **Objectkosten & inkoopfacturen**.

Het scherm biedt een interactief controlevoorbeeld voor:

- selecteren van een bestaande facturerende entiteit (privépersoon of onderneming);
- selecteren van een bestaande relatie als leverancier en invoeren van diens factuurnummer;
- kiezen van het object, kostensoort, datum en omschrijving;
- handmatig invoeren van bedrag exclusief btw en de btw zoals vermeld op de leveranciersfactuur;
- directe cent-nauwkeurige berekening per volledig object, één unit of gelijke verdeling over alle units.

Het is **geen boekhoudkundige vastlegging**. De geselecteerde entiteit en het object zijn nog niet juridisch aan elkaar gekoppeld. De UI meldt dat expliciet. Er is geen Opslaan-, Factureren- of Verzendactie; berekening gebeurt alleen lokaal in de browser. De bestaande data worden op de server gelezen via de oude Group Administrator-guard en RLS, met exacte telling en een foutmelding wanneer een register onvolledig geladen is. Er worden geen klant- of objectdata in de source code opgenomen.

## Veiligheidsgrenzen

1. De route en de omvattende workspace layout roepen ieder `requireEstateAdmin()` aan; Preview is alleen toegestaan met MZS Staging Supabase.
2. Alleen vier bestaande registers worden gelezen: `mzs_lease_issuers`, `mzs_lease_relationships`, `mzs_estate_properties`, `mzs_estate_units`.
3. Browser stuurt niets naar een API; er is geen database-, Storage- of emailwrite.
4. Een verkeerd object/unit-combinatie, een verkeerde centverdeling, ongeldige bedragen en ongeldige datums worden niet als geldige preview gepresenteerd.
5. Ontbrekende, onvolledige of te grote registers leiden tot een geblokkeerde berekening.
6. Btw is het ingevoerde bedrag op de inkomende factuur, zonder automatische btw-tariefkeuze.
7. De twee vereiste branch-only Preview variabelen verwijzen uitsluitend naar `MZS Staging`; Production variabelen zijn niet aangepast.

## Acceptatiescenario's

- [ ] Groepsbeheerder kan de pagina openen vanaf Estates Workspace.
- [ ] Client, Partner, niet-actieve beheerder en anonieme bezoeker kunnen deze pagina niet openen.
- [ ] Entiteiten en objecten komen alleen uit MZS Staging, niet uit Production.
- [ ] Vergelijk het voorbeeld "€100,01 + €21,00 btw" per gebouw met de verdeling over drie afzonderlijke units: de som blijft €121,01.
- [ ] Bij selectie van één unit verschijnt uitsluitend die unit in de berekening.
- [ ] Onvolledige relatie-/object-/unitregisters blokkeren het overzicht, zonder stilzwijgend een deelsom te tonen.
- [ ] Wijzig je juridische entiteit, dan verschijnt **geen** claim dat deze eigenaar of betaler van het geselecteerde object is.
- [ ] Wijzig datums en bedragen; de berekening past zich meteen aan.
- [ ] Verlaat de pagina en keer terug: de proefgegevens zijn niet opgeslagen.
- [ ] Controleer weergave op mobiel en desktop, inclusief de horizontaal scrollbare kostentabel.
- [ ] Controleer dat geen service_role secrets of ongewenste privacygegevens in de pagina verschijnen.

## Nog niet beschikbaar

Een echte leveranciersfactuur of kostenpost verwerken vereist eerst een afzonderlijk beoordeelde Staging-migratie, geverifieerde juridische object-entiteitkoppelingen, privéschijf voor factuurbestanden met opslagbeleid, een transactieve controle/goedkeuringsfunctie, audit en een veilige export. Daarna volgen Staff uren en onderhoudstickets. Deze features staan bewust nog niet live.
