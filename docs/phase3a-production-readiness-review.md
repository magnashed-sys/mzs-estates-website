# Phase 3A — productiecontrole en herstelplan

Controle: 19 oktober 2026. Status: voorbereiding; **geen productievrijgave**.

## Afbakening en gecontroleerde versie

- Featurebranch: `feature/phase3a-admin-scopes-capital-integrated`.
- Functionele versie: `8d97234f6755e21178f6db3df7d4f3033d188a9f`.
- Referentie voor terugkeer naar de eerdere website: main `113972641c870a06b49619df4ae3d58b94368acb`, deployment `dpl_3ZCZuDdaJvGZATKwh6BfXMxoQ2Nt`. Controleer voor vrijgave opnieuw of dit nog de juiste herstelversie is.
- Productie: `ptrnjzmcehrhbsfxntgw`; uitsluitend catalogus- en migratiehistorie gelezen, binnen read-only transacties. Geen klantgegevens geëxporteerd.
- Staging: `senonkpxdtlhyhrubicg`. Geen productie-DDL, wijzigingen aan main of merge van PR #10 uitgevoerd.

## Gecontroleerde databaseafhankelijkheden

Productie bevat `mzs_capital_requests` met RLS, de benodigde kolommen en de statussen `new`, `in_review`, `contacted`, `closed`. De migratiehistorie bevat `mzs_capital_requests_production`.

De bestaande SELECT-policy laat alleen de eigenaar of een actieve globale admin lezen. `authenticated` heeft alleen SELECT op deze tabel; writes lopen in de huidige productiecode via een gecontroleerde serverroute met service-role. De nieuwe route vervangt dat door een sessiegebonden RPC met atomische audit.

`profiles` bevat de vereiste id, role, is_active, full_name en email. `is_admin()` controleert zowel de aangemelde gebruiker als een actief profiel met role admin. Die functie, het role-enum en de bestaande project-/huurpolicies worden niet gewijzigd.

De fase 3A-tabellen en RPC's ontbreken nog in Productie. Er is bij deze controle dus geen naamconflict vastgesteld.

## Exacte gewenste wijzigingen

| Onderdeel | Productiehandeling na goedkeuring |
| --- | --- |
| Scopefundament (bron 20261016_phase3a_admin_scopes_staging.sql) | Nieuwe assignments-tabel, index, RLS en mzs_has_department_scope(text) |
| Scope-audit (bron 20261017_phase3a_scoped_admin_audit_staging.sql) | Nieuwe scope-audittabel en gecontroleerde mzs_set_admin_department_scope(uuid,text,boolean); geen directe authenticated writes naar assignments |
| Capital-audit (bron 20261018_phase3a_capital_requests_scoped_staging.sql) | Nieuwe request-audittabel plus mzs_capital_admin_list_requests() en mzs_capital_admin_update_request(uuid,text) |
| Pilot (20261019_phase3a_pilot_trusted_test_accounts_staging.sql) | **Niet meenemen**: beide mzs_phase3a_pilot_* functies blijven uitsluitend Staging |
| Bestaande aanvragen, profielen en gebruikers | Niet kopiëren, verwijderen, opnieuw aanmaken of van rol veranderen |

De drie kernbronnen zijn uitdrukkelijk als Staging geschreven. Ze zijn geen goedgekeurd productiescript. Maak een afzonderlijk, gereviewd migratiepakket met projectcontrole, preconditions en één transactie voor alle drie onderdelen. Daarmee wordt de tijdelijke directe schrijftoegang uit de eerste stap nooit afzonderlijk gepubliceerd. Geen algemene `db push` van de volledige map: historische/pilotmigraties mogen niet onbedoeld meekomen. Registreer het definitieve pakket in de migratiehistorie.

Geen initiële scope-grants tijdens de schema-installatie. Capital-operators blijven client/partner; maak ze nooit globale admins. De huidige rechteninterface werkt alleen in geïsoleerde Preview. Voor echte medewerkers is nog een afzonderlijk gecontroleerd toekenningsproces via een ingelogde Group Admin nodig; de testpilot is daarvoor niet geschikt.

## Uitrolvolgorde

1. Bevestig nieuwste productiecode/deployment, schemasnapshot en beschikbare back-up/herstelpunt. Leg tijdstip, eigenaar, RPO en RTO vast. Beschikbaarheid en herstelduur zijn nu **niet geverifieerd**.
2. Maak het definitieve productiemigratiepakket. Oefen installatie op een lege fase-3A-basis met dezelfde relevante productiestructuur, uitsluitend in een geïsoleerde testdatabase. De bestaande Staging bevat de objecten al en is geen bewijs dat installatie vanaf nul slaagt.
3. Voer positieve/negatieve roltests, directe RPC-/REST-tests en herstelrepetitie op die testbasis uit. Controleer grants, RLS, lege scope-grants en afwezigheid van pilotfuncties.
4. Pas na expliciete vrijgave: kernschema atomisch installeren, eerst database verifiëren, daarna exacte goedgekeurde websiteversie publiceren. De oude website blijft tijdens de additieve migratie bruikbaar.
5. Controleer bestaande Group Admin, client/private, projecten/documenten, verhuur en Capital-aanvragen. Controleer Production URL/keys en mailconfiguratie zonder Preview-waarden over te nemen.
6. Ken pas na afzonderlijke gecontroleerde autorisatie echte Capital-rechten toe. Controleer actor en audit. Monitor fouten en onverwachte toegang.

## Herstelplan

Trigger: onverwachte toegang, mislukte status/audittransacties, uitval van bestaande admin/clientfuncties of verkeerde databaseomgeving.

**Voorkeur: toegang afsluiten en code terugzetten, data behouden.**

1. Stop verdere uitrol en toekenningen. Sluit EXECUTE af voor PUBLIC, anon, authenticated en service_role op de vier nieuwe kernfuncties. Dit blokkeert ook directe API-aanroepen; alleen een website-rollback doet dat niet. De functies zijn: mzs_has_department_scope(text), mzs_set_admin_department_scope(uuid,text,boolean), mzs_capital_admin_list_requests(), mzs_capital_admin_update_request(uuid,text).
2. Indien pilotfuncties onverhoopt aanwezig zijn, sluit ook die af en behandel hun aanwezigheid als een uitrolfout. Gebruik uitsluitend werkelijk bestaande functies en correcte signatures.
3. Zet de website terug naar de vooraf vastgelegde productieversie. Verifieer dat de oude actieve-Group-Admin-route en haar bestaande Production serviceconfiguratie werken. Deze oude route maakt geen gebruik van de vier nieuwe RPC's.
4. Laat tabellen, scopehistorie, audits en reeds legitiem gewijzigde aanvraagstatussen staan. Geen DROP CASCADE, geen blind terugzetten van aanvragen, geen verwijderen van gebruikers. De request-audit bevat RESTRICT foreign keys naar verzoeken en gebruikers; dit is ook relevant bij latere testopruiming.
5. Controleer dat directe aanroepen naar de nieuwe functies geweigerd worden en dat de bestaande website bruikbaar is. In-flight transacties kunnen al gecommit zijn; inspecteer audit en requeststatus na afsluiten, beloof geen retroactieve annulering.
6. Herstel van een volledige databaseback-up is alleen noodherstel bij daadwerkelijke datacorruptie, met aparte goedkeuring. Dat kan recente legitieme wijzigingen verliezen en veroorzaakt downtime. Storage-objecten vallen niet onder een gewone databaseback-up.

Herinschakeling is een aparte release: leg de juiste grants vast, corrigeer de oorzaak, test, vraag vrijgave. Kopieer niet blind alle oude ACL's terug.

## Daadwerkelijk uitgevoerde controles

- Read-only productiecatalogus: benodigde kolommen/types, constraints, RLS-policy, tabelgrants, is_admin()-definitie en afwezigheid van fase 3A-objecten.
- Codeverschil ten opzichte van de referentie-main bekeken; nieuwe adminroute gebruikt sessie-RPC, oude route service-role na actieve admincontrole.
- Preview-only controle van de pilotpagina vastgesteld; databasepilot wordt uitgesloten van productievoorstel.
- Staging-herstelrepetitie: EXECUTE op vier kernfuncties en twee pilotfuncties tijdelijk ingetrokken binnen een subtransactie. Voor anon/authenticated/service_role gecontroleerd dat EXECUTE ontbreekt. Subtransactie teruggedraaid; volledige oorspronkelijke functie-ACL's gelijk bevonden. Geen blijvende rechtenwijziging.
- Eerder in deze sessie: build/TypeScript, 7 Node-securitytests, drie SQL-roltests, browsertoekenning/intrekking, Capital lezen/statuswijziging met geverifieerde audit, Group/Estates-afscherming en mislukte write vanuit oud scherm na intrekking.

Dit is **geen** geslaagde productie-installatierepetitie, volledige back-uprestore of live website-rollbacktest.

## Nog open voor productie

- Definitief productiemigratiepakket en installatie-/rollbackrepetitie vanaf geschikte testbasis.
- Beschikbaar productieback-upmoment, herstelprocedure en haalbare RPO/RTO bevestigen.
- Nog niet aangetoonde echte-sessie directe REST/RPC-negatieve controles, aparte Estates-fixturecontrole en brede bestaande project/verhuur/clientregressie afronden.
- Staging-mailisolatie: branchspecifieke MZS_SMTP_PORT is aanwezig, door gebruiker als 0 ingesteld; waarde is afgeschermd en runtimeblokkade niet onafhankelijk bevestigd. Supabase Auth gebruikt volgens gebruiker dezelfde SMTP-configuratie als Production. Dit wacht op Superspace; geen Auth-mailtests uitvoeren.
- Testgegevens behouden tot retentie/opruiming is afgesproken; Capital-testscope is ingetrokken.
- Expliciete uiteindelijke productiegoedkeuring; PR #10 blijft Draft.

Referentie voor back-upbeperkingen: https://supabase.com/docs/guides/platform/backups (geraadpleegd 19 oktober 2026).

## Aanvulling na lokale installatierepetitie — 19 oktober 2026

Deze aanvulling actualiseert de eerdere openstaande punten hierboven.

- De eigenaar bevestigde dat de productieback-up van **19 oktober 2026 01:18:27** succesvol is afgerond en herstelbaar wordt aangeboden. Tijdzone van de dashboardweergave is niet onafhankelijk vastgesteld. Geen restore uitgevoerd; beschikbaarheid is door de eigenaar bevestigd, daadwerkelijke herstelduur niet getest. Vóór uitrol het nieuwste herstelpunt opnieuw controleren.
- Het releasepakket staat nu in `supabase/releases/phase3a`, bewust buiten automatische migratiedetectie. Het bevat uitsluitend de drie kernonderdelen in één transactie en een gegevensbehoudend afsluitscript. Geen pilotfuncties of initiële rechten.
- Lokale PostgreSQL-repetitie met PGlite 0.5.10, op een minimale relevante productiebaseline, **11 checkpoints geslaagd**: ontbrekende acknowledgement geweigerd; geforceerde installatiefout draait alle DDL terug; succesvolle installatie; geen pilot/rechten en ongewijzigde bestaande policies; anon/service-role RPC geweigerd; twee bestaande SQL-rol/auditsuites; geen resterende fixtures; herhaalde installatie geweigerd; echte RPC-aanroep geweigerd na afsluiten met behoud van alle aanvraag/scope/auditgegevens; oude service-role database-update blijft mogelijk.
- Herhaalbaar script: `scripts/phase3a-release-rehearsal.mjs`; fixture: `tests/fixtures/phase3a-release-baseline.sql`. Auth/profile-trigger is een testdouble, geen volledige Supabase-kopie. Geen concurrentietest, gehoste migratierunner, REST-schema-cache, Vercel-rollback of back-uprestore getest. De eerdere Staging/browsercontroles blijven aanvullende bewijslast.
- Productiemigratie en herstel-SQL zijn daarmee lokaal technisch geoefend. Nog geen vrijgave: mailisolatie blijft op verzoek geparkeerd; brede bestaande project/verhuur/clientregressie en ontbrekende echte-sessie REST-controles blijven open. Productie-operatorworkflow voor echte scope-toekenningen moet worden vastgesteld. Expliciete eigenaar-goedkeuring blijft noodzakelijk.
- Deze voorbereidende werkzaamheden hebben geen remote databasewijzigingen uitgevoerd. Het productieschema en de productiecode zijn niet aangepast.

## Vrijgavevoorbereiding — vervolg op eigenaarinstructie

De eigenaar heeft toestemming gegeven om de overige releasevoorbereiding voort te zetten met mailisolatie als expliciet uitgesteld punt. Dit is geen bevestiging van mailveiligheid en geen toestemming om Production te wijzigen. Geen Staging-mailtests uitvoeren.

De broncode van `app/private`, de bestaande centrale adminpagina, projecttoegang, projectbeheer en Supabase-clienthelpers is vergeleken met main `113972641c870a06b49619df4ae3d58b94368acb`: geen wijzigingen in deze onderdelen. De actieve globale-admincontroles van projectbeheer/projecttoegang blijven aanwezig. Dit is broncodecontrole, geen nieuwe echte-sessie functionele regressietest.

Open menselijke sessiecontroles: bestaande Group Admin-projecten/relaties openen; bestaande geautoriseerde Staging-client een toegestaan project/document laten openen; huurkalender en reserveringen bekijken zonder boeking of e-mail te versturen. Directe REST-negatieve controles met echte sessies zijn nog niet zelfstandig uitgevoerd; SQL-roltests en de browser-PATCH na intrekking zijn wel uitgevoerd zoals hierboven beschreven.

## Kalenderfixture — 20 oktober 2026

Eigenaar bevestigde bestaande Group Admin-project/relatiebeheer en geautoriseerde client-project/documentweergave. Het testobject had geen kalender omdat de algemene projectpagina die niet rendert; dit was bestaand gedrag. Op verzoek is alleen voor `staging-test-residence` met de exacte testproject-ID en uitsluitend geïsoleerde Vercel Preview de bestaande RentalCalendar toegevoegd. Staging rental_settings voor dit fictieve object: EUR 100/nacht, 7 nachten minimum, 4 gasten, geen zwembadverwarming. Geen toegangsrechten toegevoegd. Production en de bestaande kalendercomponent zijn ongewijzigd.

Build/TypeScript geslaagd (bestaande CSS-waarschuwingen). In een teruggedraaide SQL-transactie kalender-RPC gelezen als reeds geautoriseerde Staging-client en geweigerd voor een niet-geautoriseerde identiteit. Dit is een database-roltest, geen nieuwe browseracceptatie. Geen boeking of mail verstuurd. Visuele kalenderacceptatie blijft nog te doen.

Daarnaast: GitHub-checks voor releasepakket 2da0a227 waren succesvol, Preview READY. Vier echte anonieme Staging REST-RPC-aanroepen naar scopebeheer/Capitalbeheer/pilotlijst geweigerd met HTTP 401 en SQL-code 42501.
