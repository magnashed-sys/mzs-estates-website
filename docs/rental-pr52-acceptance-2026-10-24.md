# PR #52 — gerichte acceptatiecontrole

Datum: 24 oktober 2026. Uitgangspunt: feature-head `d01e5f2f21f0ec32bc581ecca6368c22bac8862e`.

## Oordeel en actuele situatie

De kernfuncties slagen in de hieronder genoemde controles. Twee aantoonbare fouten zijn op de featurebranch hersteld en met regressietests afgedekt. Volledige functionele eindacceptatie blijft voorwaardelijk: de bestaande browsercontrole is hergebruikt, niet opnieuw geslaagd in deze uitvoeromgeving; echte SMTP-verzending en ontvangst zijn niet getest.

Het oorspronkelijke uitgangspunt was achterhaald: PR #52 is op 24 oktober om 09:45:31 UTC (11:45:31 Europe/Madrid) al samengevoegd. Production draaide bij de start van de audit op `1634f109f493127043d00e56e88377a920b4b698`; Vercel meldde READY en de publieke domeinen wezen naar die deployment. De oorspronkelijke integratiemigratie was al op Production geregistreerd als `20261024094506_rental_platform_integration`. Ook `MZS_LEASE_INVOICE_SEND_ENABLED=true` stond al ingesteld voor Production. Deze audit heeft geen van die Production-instellingen gewijzigd.

De herstelwijzigingen blijven op `feature/rental-platform-integration`. De aanvullende correctiemigratie is uitsluitend op Staging toegepast. Er zijn geen echte factuurmails verstuurd, geen bestaande facturen gewijzigd en geen wijzigingen naar main gepubliceerd.

## Gevonden en hersteld

1. **Registratienummer buiten de goedgekeurde momentopname (middel).** Na controle van een concept kon wijziging van de issuing entity alsnog een ander registratienummer op de definitieve factuur zetten. De nieuwe regressietest faalde eerst met `REG-CHANGED` in plaats van `REG-ORIGINAL`. Het registratienummer wordt nu bij het opslaan van een conceptcontract vastgelegd, in de conceptcontrole getoond en bij uitgifte uit die momentopname gelezen. Bestaande facturen worden niet herschreven. Ontbrekende historische registratienummers worden niet achteraf afgeleid.
2. **Afrondingsverschil in de prognose (laag).** Binaire kommagetalberekening kon bij deelmaanden een cent afwijken van de PostgreSQL-factuurberekening: de helft van EUR 0,29 werd EUR 0,14 in plaats van EUR 0,15. De prognose rekent nu met gehele centen en verhoudingen, inclusief btw-afronding. De regressietest faalde vóór en slaagt na de correctie. Definitieve factuurbedragen waren al met PostgreSQL numeric berekend en zijn niet aangepast.

## Bewijs per onderdeel

| Onderdeel | Uitkomst | Werkelijk uitgevoerd / beperking |
| --- | --- | --- |
| Bestaande CI | Geslaagd, hergebruikt | Exacte oorspronkelijke head: Platform checks run `40082220682`, job `120837933982`; log bevestigt 85 tests, 0 fouten, build en TypeScript geslaagd. Security run `40082220677`, job `120837933849` geslaagd. |
| Nieuwe automatische controles | Geslaagd | `npm test`: 86 tests, 0 fouten. Inclusief databaselevenscyclus op PGlite met de echte SQL-migraties en de extra acceptatieasserties. |
| Build en typen | Geslaagd | Productiebuild lokaal met uitsluitend fictieve buildcredentials; daarna `npm run typecheck`. Bestaande CSS/webpack-waarschuwingen zijn geen buildfouten. |
| Security guardrails | Geslaagd | Dezelfde offline static-security-opdrachten als CI uitgevoerd. Geen lease-gerelateerde security-advisorbevindingen op Staging vóór/na de correctie of op Production bij read-only inspectie. Dit is geen verklaring dat het hele platform vrij van beveiligingsmeldingen is. |
| Toegang | Geslaagd binnen geteste scope | Actieve Group-admin vereist in routes/actions én database; client/inactieve admin/anon afgewezen in fixtures. Productie-RLS op alle zes kernregisters aan; echte `is_admin()` controleert rol én actiefstatus. |
| Relatie/account/contract | Geslaagd | Expliciete relatie-, account- en issuerverwijzingen worden opgeslagen; koppelen wijzigt geen accountrol. Een gekoppelde cliënt krijgt nog steeds geen beheerrechten. Wijziging van relatie-/issuerstamgegevens verandert de goedgekeurde factuurmomentopname niet. |
| Object/units | Geslaagd | Bestaande unitverwijzingen blijven bestaan; ongeldige en dubbele unitselecties worden afgewezen; validatie controleert dat units bij het gekozen object horen. Bestaande overlap- en vervangingscontroles slagen. |
| Companies | Beperkte integratie, correct beschreven | De Companies-tab bevat navigatie naar issuing entities. Bestaande zelf opgegeven bedrijfsaffiliaties worden niet samengevoegd of rechtstreeks als contractpartij gekoppeld. Een huurrelatie van type company en een issuing entity blijven afzonderlijke expliciete records. |
| Bestaande gegevens | Geslaagd in migratieproef | Volledige rijvergelijking vóór/na de oorspronkelijke integratiemigratie en de correctiemigratie; nieuwe kolommen uitgezonderd. Ook bestaande testfacturen, betalingen, auditregels en issuer-nummerstanden blijven gelijk. Geen historische Production-backupvergelijking beschikbaar; daar zijn alleen actuele aantallen en migratiecode gecontroleerd. |
| Goedkeuring | Geslaagd | Ongecontroleerd concept kan niet worden uitgegeven; na uitgifte kan de review niet worden teruggedraaid en kunnen bedragen/payload niet via browserrollen worden gewijzigd. Verzending heeft een afzonderlijke bevestiging. |
| Nummering | Geslaagd | Herhaalde uitgifte van hetzelfde concept retourneert dezelfde factuur; nummerstand loopt eenmaal op. Onafhankelijke prefixreeks per issuer; dubbele prefix, prefixwijziging en tellerwijziging door browserrollen geweigerd. |
| Betalingen | Geslaagd | Deelbetaling, herhaling met dezelfde request-ID, overschrijding van openstaand bedrag, datum in de toekomst en terugboeken met reden gecontroleerd. Bankimport en banktransactiededuplicatie zijn niet geïmplementeerd; een nieuw request-ID is een nieuwe handmatige boekingspoging. |
| Dubbele verwerking | Geslaagd voor herhaling; concurrency statisch beoordeeld | Unieke conceptperiode/factuurreferentie, rijlocks en claimstatussen aanwezig. Herhaalde generatie, uitgifte, betaling en mailclaim getest. Geen nieuwe test met meerdere onafhankelijke gelijktijdige PostgreSQL-sessies uitgevoerd. |
| Decemberplanning | Geslaagd | Lokale SQL-test: 13 november geen decemberconcept; 14 november precies één; tweede uitvoering nul; huurperiode 1 december, vervaldatum 30 november 2026. Production-cron `mzs-production-lease-drafts` staat actief op `15 5 * * *` en gebruikt Europe/Amsterdam als verwerkingsdatum. |
| PDF | Geslaagd | Echte applicatiegenerator aangeroepen met fictieve facturen; tekstextractie en visuele controle van een normale en een driepaginafactuur, inclusief accenten, btw en registratie. Font aanwezig in buildtraces van pagina én PDF-route. Interne notities ontbreken in de PDF. |
| PDF zonder login op Preview | Geslaagd | GET op de beschermde PDF-route eindigt op `/login` (HTML, geen PDF; private/no-store). Geen cliënt- of adminsessie gebruikt. |
| Mailisolatie | Geslaagd voor code/tests/configuratie | Branch-Preview is aan Staging gekoppeld. Preview forceert capture zonder SMTP; Production vereist juiste database plus vrijgaveschakelaar. Testfixture verifieert PDF-bijlage, ontvangercontrole en onzekere uitkomsten. Werkelijke SMTP-aanmelding/bezorging niet uitgevoerd. |
| Desktop/mobiel | Eerder bewijs hergebruikt | Oorspronkelijke PR/documentatie rapporteert volledige fixtureworkflow geslaagd. Herhaling hier strandde vóór browserstart op `socket() failed: Operation not permitted`. Niet als nieuwe geslaagde browsercontrole geteld. |

## Staging en Production

Staging: `senonkpxdtlhyhrubicg`. Production: `ptrnjzmcehrhbsfxntgw`. De vijf oorspronkelijke factuur-/betalings-/mailfuncties hadden vóór de correctie identieke definitiehashes in beide omgevingen. Server- en buildcontroles weigeren Preview met de Production-database.

De nieuwe migratie `20261024110718_rental_acceptance_snapshot_fix.sql` is op Staging toegepast. Vergelijking van de recordhashes vóór/na bevestigt dat bestaande contractwaarden (zonder de nieuwe kolom), issuers, facturen en betalingen gelijk zijn gebleven. De nieuwe kolom en de aangepaste snapshotbron zijn daarna read-only bevestigd. Er is geen nieuwe volledige gebruikersworkflow op de echte Staging-database uitgevoerd.

Bij de Production-inventarisatie waren er 2 objecten, 22 units en 26 profielen. De zes huurregisters bevatten toen nog 0 relaties, 0 issuers, 0 contracten, 0 concepten, 0 definitieve facturen en 0 betalingen. Dit is een momentopname, geen bewijs over eerder verwijderde gegevens. De audit heeft Production uitsluitend gelezen.

## Voorwaarden vóór gebruik voor echte decemberfacturen

- Na expliciete toestemming: de correctiemigratie op Production toepassen en de geteste herstelcode publiceren. De oorspronkelijke PR52-migratie staat er al; niet opnieuw blind uitvoeren.
- Controleer de echte juridische entiteiten, adressen, IBANs en een unieke prefix die niet overlapt met de oude administratie. Sla conceptcontracten na issuerselectie op; bestaande actieve legacy-contracten zonder issuer vragen een afzonderlijk beoordeelde mapping.
- Herhaal de functionele acceptatie op de nieuwste Preview met een beheerder. Controleer contractpartij, accountkoppeling, units en beide goedkeuringsstappen.
- De Production-verzendschakelaar staat al aan. Controleer de aanwezige SMTP/serviceconfiguratie en voer pas na gerichte toestemming een gecontroleerde echte testmail uit. SMTP-acceptatie bewijst nog geen inboxontvangst.
- Claims met `sending` of `uncertain` eerst met providerlogs onderzoeken; geen blinde retry. De automatische voorbereiding maakt alleen concepten, geen definitieve facturen of verzending.
- Zorg vóór 14 november dat alle decembercontracten compleet en actief zijn. Controleer/keur de concepten goed en verstuur ze afzonderlijk; betalingen moeten uiterlijk 30 november ontvangen zijn.

Creditnota's, annulering van definitieve facturen, bankimport/-reconciliatie, herinneringen en fiscale tariefbepaling vallen buiten deze release. Per-unit bedragen worden niet afgeleid bij een contract over meerdere units; daar wordt het gehele contractbedrag expliciet getoond.

## Bronnen

- [PR #52](https://github.com/magnashed-sys/mzs-estates-website/pull/52)
- [Oorspronkelijke CI](https://github.com/magnashed-sys/mzs-estates-website/actions/runs/40082220682)
- [Oorspronkelijke security-controle](https://github.com/magnashed-sys/mzs-estates-website/actions/runs/40082220677)
- [Production-deployment bij aanvang](https://vercel.com/mzs3/mzs-group/AYDe5bkq9HhfeDepyCBhEdQFFFC6)
- [Integratiebeschrijving](rental-platform-integration.md)
