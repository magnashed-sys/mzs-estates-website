# MZS Group — vervangende leveranciersfactuur & gebundelde accountantsproefexport

**28 oktober 2026 | PR #143 blijft Draft | Uitsluitend MZS Staging**

## Nieuwe vervangingsworkflow

1. Beheerder registreert een kostenpost met brondocument en keurt die na controle goed, of wijst die met reden af.
2. Bij een geconstateerde fout dient de beheerder een onveranderbaar correctievoorstel in; dat voorstel vervangt **niet** automatisch het origineel.
3. Een andere expliciete administratieve beslissing legt vast dat de correctie is afgewezen of dat een nieuwe factuur noodzakelijk is.
4. Bij `replacement_required` wordt een **afzonderlijke, nieuwe leveranciersfactuur** als eigen kostenconcept ingevoerd, met **nieuw leveranciersfactuurnummer**, en dezelfde geverifieerde juridische entiteit, leverancier en vastgoedobject.
5. De nieuwe leveranciersfactuur moet haar **eigen origineel in privéopslag** hebben en zelfstandig het proces `draft → submitted → approved` doorlopen.
6. Pas hierna kan de beheerder de nieuw goedgekeurde factuur aan het oude correctieverzoek verbinden. Een private database-trigger controleert alle originele gegevens, het revisiebesluit, beide goedkeuringen, een eigen brondocument en unieke koppeling.
7. De bronfactuur wordt nooit overschreven, verwijderd, als klantfactuur uitgegeven of betaald. De goedgekeurde vervanging verschijnt uitsluitend als **nieuwe, zelfstandig getoetste kostenpost** in de relevante exportperiode. Het origineel met `replacement_required` blijft buiten de goedgekeurde kosten.

**Beperking:** een leverancier die een gecorrigeerde factuur met *hetzelfde* factuurnummer verstuurt, past niet in de huidige unieke leveranciersfactuursleutel; dat geval blijft in de uitzonderingenlijst tot een aparte, wettelijk correcte versieregel met bron-/correctienummering is ontworpen. Niet fictief hernummeren.

## Proefbundel accountants

`/admin/workspaces/estates/expenses/accountant-bundle?entity=<uuid>&year=2026`

Een beveiligde Staging-route maakt één ZIP-pakket met `purchase-review.zip`, `sales-receipts-review.zip`, `README.txt` en `manifest.json`. Beide deelrapporten worden eerst intern **zonder netwerkverzoek** aangemaakt. Alleen wanneer beide slagen, de juiste juridische entiteit en het jaar zijn gecontroleerd en de totale ZIP's maximaal 3 MiB zijn, wordt de download aangeboden. De originele sub-ZIPs bevatten elk hun eigen hashes, uitzonderingen en data-herkomst. Dit is een **samengebundelde proefexport**, nog geen volledig samengevoegde boekhouding of fiscale aangifte.

De inkoop-CSV bevat alleen onafhankelijk goedgekeurde kosten en eigen bronfacturen; een origineel met `replacement_required` blijft als uitzondering bestaan. `correction-lineage.csv` documenteert oorspronkelijke factuur, correctieverzoek, besluit en eventuele gekoppelde vervanging. De nieuwe goedgekeurde factuur wordt met haar eigen factuurdatum en eigen bron als zelfstandige regel opgenomen. Vervangingen met jaaroverschrijding worden in de oorspronkelijke periode als gekoppelde UUID getoond.

De aanvullende verkoop/ontvangstenproefexport omvat uitsluitend uitgegeven huur-/boekingsfacturen met eigen juridische `issuer_id`, plus hun gedateerde geregistreerde betaalgebeurtenissen. Een administratieve terugboeking is niet automatisch een bankterugbetaling. Niet-gefactureerde boekingen, ongekoppelde ontvangsten, verkoopcreditnota's, Capital, payroll, btw en bankafstemming ontbreken expliciet.

## Veiligheids- en acceptatiestappen

- [ ] Exact-head GitHub test, build, TypeScript en statische securitychecks groen.
- [ ] Geïsoleerde PostgreSQL-tests: verkeerde entiteit/leverancier/object geweigerd, origineel blijft onveranderd, nieuwe originele leveranciersfactuur + eigen goedkeuring verplicht, niet-admin geweigerd.
- [ ] Migratie `20261028163000_mzs_ops_expense_replacements_staging.sql` alleen op Staging na de groene tests; Production blijft ongewijzigd.
- [ ] RLS en Supabase Security Advisor na migratie controleren.
- [ ] Praktijktest met **synthetische facturen**: create original + source + approval, correction + decision, independent corrected invoice + upload + approval, then link lineage and export both jaren.
- [ ] ZIP controleren: originele factuur en vervanging correct gedocumenteerd, geen dubbele kosten en geen bestand van andere juridische entiteit.
- [ ] Mobiele/desktop-acceptatie en expliciete gebruikersgoedkeuring vóór eventueel toekomstig Production-voorstel.

Geen echte Catherine/Zorgbalans-gegevens of factuur 7113 automatisch overgezet. Geen echte PDF's geüpload, berichten verzonden, betaalregistraties aangemaakt of wijzigingen op Production aangebracht.
