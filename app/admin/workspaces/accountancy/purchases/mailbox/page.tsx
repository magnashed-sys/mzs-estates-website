import {requirePdfAdmin} from '../../../../../../lib/accountancy/pdf/server';
export const dynamic='force-dynamic';
const messages:Record<string,string>={
 ready:'De mailboxverbinding werkt. INBOX en Verwerkt zijn bereikbaar.',
 missing_password:'Het mailboxwachtwoord is nog niet ingesteld in deze preview.',
 authentication_failed:'Inloggen op de mailbox is niet gelukt. Controleer het ingestelde wachtwoord.',
 inbox_unavailable:'De inbox is niet bereikbaar.',
 processed_folder_unavailable:'De map Verwerkt is niet bereikbaar. Controleer de exacte mapnaam.',
 timeout:'De mailboxserver antwoordde niet binnen de tijdslimiet.',
 connection_failed:'De beveiligde verbinding met de mailboxserver is niet gelukt.',
 connection_closed:'De mailboxserver heeft de verbinding gesloten.',
 server_closed:'De mailboxserver heeft de verbinding gesloten.',
 invalid_greeting:'De beveiligde mailboxverbinding kon niet worden bevestigd.',
 unsupported_auth:'De mailboxserver biedt de verwachte inlogmethode niet aan.',
 unexpected_response:'De mailboxserver gaf een onverwacht antwoord.'
};
export default async function MailboxCheck({searchParams}:{searchParams:Promise<{result?:string}>}){
 await requirePdfAdmin();
 const params=await searchParams;
 const result=typeof params.result==='string'?messages[params.result]:undefined;
 return <main>
  <h1>Mailboxverbinding testen</h1>
  <p>mase@mzsgroup.eu · mailspace.org · INBOX → Verwerkt</p>
  <p>Deze test controleert de beveiligde verbinding, het inloggen en de bereikbaarheid van beide mappen. Er worden geen facturen ingelezen of e-mails verplaatst.</p>
  {result&&<p role="status">{result}</p>}
  <form method="post" action="/admin/workspaces/accountancy/purchases/mailbox-check">
   <button type="submit">Mailboxverbinding controleren</button>
  </form>
  <p>Een geslaagde verbindingstest betekent nog niet dat de factuurimport actief is.</p>
  <a href="/admin/workspaces/accountancy/purchases">Terug naar inkoopfacturen</a>
 </main>;
}
