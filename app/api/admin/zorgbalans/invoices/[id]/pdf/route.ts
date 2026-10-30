import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {requireEstateAdmin} from '../../../../../../../lib/security/estate-properties';
import {requireStaffEnvironment} from '../../../../../../../lib/security/property-staff';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Invoice={id:string;invoice_number:string;issued_on:string;due_on:string;period_from:string;period_until:string;
 customer_name:string;customer_reference:string;hours:number;net_cents:number;vat_cents:number;gross_cents:number;
 status:'concept'|'externally_issued';issuer_id:string};
type Line={id:string;worked_on:string;actual_minutes:number;invoiced_hours:number;net_cents:number;description:string};
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 requireStaffEnvironment();const {db}=await requireEstateAdmin();
 const {id}=await params;if(!uuid.test(id))return new Response('Invalid private invoice.',{status:400,headers});
 const {data:invoice,error}=await db.from('mzs_ops_zorgbalans_invoices')
  .select('id,invoice_number,issued_on,due_on,period_from,period_until,customer_name,customer_reference,hours,net_cents,vat_cents,gross_cents,status,issuer_id')
  .eq('id',id).maybeSingle();
 if(error||!invoice)return new Response('Invoice not found.',{status:404,headers});
 const [lineResult,issuerResult]=await Promise.all([
  db.from('mzs_ops_zorgbalans_invoice_lines').select('id,worked_on,actual_minutes,invoiced_hours,net_cents,description')
   .eq('invoice_id',id).order('worked_on').order('id').limit(101),
  db.from('mzs_lease_issuers').select('name,address,iban,tax_id,kind').eq('id',invoice.issuer_id).maybeSingle()
 ]);
 const lines=lineResult.data as Line[]|null,source=invoice as Invoice,issuer=issuerResult.data;
 if(lineResult.error||issuerResult.error||!issuer||!lines||!lines.length||lines.length>100||
  issuer.name!=='Magdy Nashed'||issuer.kind!=='person'||!issuer.iban||!issuer.tax_id||
  lines.reduce((n,l)=>n+l.invoiced_hours,0)!==source.hours||
  lines.reduce((n,l)=>n+l.net_cents,0)!==source.net_cents||
  lines.some(l=>l.net_cents!==l.invoiced_hours*2500)||
  source.gross_cents!==source.net_cents+source.vat_cents||
  source.vat_cents!==Math.round(source.net_cents*.21))
  return new Response('Incomplete invoice data; PDF withheld.',{status:409,headers});
 const pdf=await PDFDocument.create();pdf.setTitle('Factuur '+source.invoice_number+' · Magdy Nashed');
 pdf.setAuthor('Magdy Nashed');pdf.setCreator('Magdy Nashed');pdf.setSubject('Zorgbalans dienstverlening');
 const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const ink=rgb(.13,.15,.18),muted=rgb(.39,.42,.45),gold=rgb(.60,.47,.29),line=rgb(.84,.84,.84);
 const safe=(value:string)=>String(value).normalize('NFKD').replace(/[^\x20-\x7e]/g,'?');
 const date=(value:string)=>value.slice(8,10)+'-'+value.slice(5,7)+'-'+value.slice(0,4);
 const money=(value:number)=>'EUR '+(value/100).toFixed(2).replace('.',',');
 function txt(page:ReturnType<typeof pdf.addPage>,value:string,x:number,y:number,size=10,strong=false,color=ink){
  page.drawText(safe(value).slice(0,115),{x,y,size,font:strong?bold:regular,color});
 }
 function base(title:string){
  const page=pdf.addPage([595.28,841.89]);page.drawLine({start:{x:42,y:780},end:{x:553,y:780},color:gold,thickness:1.5});
  txt(page,'MAGDY NASHED',43,804,19,true);
  txt(page,title,43,746,21,true);
  txt(page,'Privé-administratie · geen MZS-factuur',43,729,8,false,muted);
  return page;
 }
 const p=base(source.status==='concept'?'CONCEPTFACTUUR - NIET VERZONDEN':'FACTUUR');
 txt(p,'Afzender',43,680,11,true);
 for(const [i,t] of ['Magdy Nashed','Melis Stokelaan 23','1948 DA Beverwijk','Nederland','BTW: '+issuer.tax_id].entries())txt(p,t,43,659-17*i,10);
 txt(p,'Factuur aan',320,680,11,true);
 for(const [i,t] of ['Stichting Zorgbalans','Postbus 2070','2002 CB Haarlem','Nederland'].entries())txt(p,t,320,659-17*i,10);
 p.drawLine({start:{x:42,y:549},end:{x:553,y:549},color:line,thickness:1});
 const detail=[
 ['Factuurnummer',source.invoice_number],['Factuurdatum',date(source.issued_on)],
 ['Vervaldatum',date(source.due_on)],['Periode',date(source.period_from)+' t/m '+date(source.period_until)],
 ['Referentie',source.customer_reference]
 ];
 detail.forEach(([label,value],i)=>{txt(p,label,43,525-i*22,9,false,muted);txt(p,value,190,525-i*22,9,i===0);});
 p.drawLine({start:{x:42,y:393},end:{x:553,y:393},color:line,thickness:1});
 txt(p,'Diensten Zorgbalans / Prettig Thuis IJmuiden',43,370,11,true);
 txt(p,source.hours+' factuururen x EUR 25,00',43,345,10);
 txt(p,money(source.net_cents),455,345,10,true);
 txt(p,'Subtotaal excl. btw',330,313,10);txt(p,money(source.net_cents),455,313,10);
 txt(p,'BTW 21%',330,292,10);txt(p,money(source.vat_cents),455,292,10);
 p.drawLine({start:{x:320,y:279},end:{x:552,y:279},color:gold,thickness:1.5});
 txt(p,'Totaal incl. btw',320,258,12,true);txt(p,money(source.gross_cents),448,258,11,true);
 txt(p,'Betaling binnen 14 dagen onder vermelding van factuurnummer '+source.invoice_number+'.',43,201,9);
 txt(p,'IBAN: '+issuer.iban,43,184,9,true);
 txt(p,'Bijlage: specificatie van geregistreerde bezoeken (naar boven afgerond per bezoek).',43,149,9,false,muted);
 if(source.status==='concept')txt(p,'CONCEPT - Nog niet extern verzonden. Controleer voor verzending.',43,107,11,true,gold);
 else txt(p,'De registratie van externe verzending wordt afzonderlijk in de administratie bijgehouden.',43,107,9,false,muted);
 let pageIndex=0;
 for(let offset=0;offset<lines.length;offset+=22){
  const page=base('BIJLAGE - URENSPECIFICATIE');pageIndex++;
  txt(page,'Factuurnummer '+source.invoice_number+' · pagina '+pageIndex,43,708,9);
  txt(page,'Datum',43,680,10,true);txt(page,'Omschrijving',113,680,10,true);
  txt(page,'Minuten',420,680,9,true);txt(page,'Uren',500,680,9,true);
  page.drawLine({start:{x:42,y:668},end:{x:553,y:668},color:line,thickness:1});
  for(let i=0;i<Math.min(22,lines.length-offset);i++){
   const row=lines[offset+i],y=645-i*24;
   txt(page,date(row.worked_on),43,y,9);
   txt(page,row.description.slice(0,56),113,y,9);
   txt(page,String(row.actual_minutes),430,y,9);txt(page,String(row.invoiced_hours),507,y,9,true);
  }
  txt(page,'Werkelijk geregistreerde minuten blijven behouden; factuururen zijn per bezoek afgerond.',43,80,8,false,muted);
 }
 const bytes=await pdf.save();
 return new Response(new Uint8Array(bytes),{status:200,headers:{
  ...headers,'Content-Type':'application/pdf',
  'Content-Disposition':'attachment; filename="Factuur-'+source.invoice_number+'-Zorgbalans'+(source.status==='concept'?'-CONCEPT':'')+'.pdf"'
 }});
}
