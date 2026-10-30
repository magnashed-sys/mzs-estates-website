import {requireEstateAdmin} from '../../../../../../../lib/security/estate-properties';
import {annualSource} from '../../../../../../../lib/accountancy/administration-data';
import {supplierPaymentMode,supplierPaymentRows} from '../../../../../../../lib/accountancy/supplier-payments';
import {allRows} from '../../../../../../../lib/property-operations/staff-data';
import type {SupplierIdentity} from '../../../../../../../lib/accountancy/supplier-integrity';
import {uuid} from '../../../../../../../lib/accountancy/administration';
import {yearAccountantFiles} from '../../../../../../../lib/accountancy/year-package';
import {accountantZipStream} from '../../../../../../../lib/property-operations/accountant-archive';
import {loadYearOriginals,YearOriginalError,MAX_YEAR_PDF_BYTES,MAX_YEAR_PDFS} from '../../../../../../../lib/accountancy/year-originals';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=300;
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {db}=await requireEstateAdmin(),{id}=await params;if(!uuid.test(id))return new Response('Invalid administration.',{status:400,headers});
 try{
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(240_000)]);
  const [source,suppliers]=await Promise.all([annualSource(db,id),allRows<SupplierIdentity>((a,b)=>db.from('mzs_lease_relationships').select('id,name,kind,company_details',{count:'exact'}).order('id').range(a,b))]);
  const paymentMode=supplierPaymentMode();
  const [payments,originals]=await Promise.all([paymentMode?supplierPaymentRows(db,source.costs):undefined,loadYearOriginals(db,source,signal)]);
  signal.throwIfAborted();
  const zip=accountantZipStream(yearAccountantFiles(source,id,suppliers,payments,paymentMode??undefined,originals),{maxFiles:MAX_YEAR_PDFS+150,maxBytes:MAX_YEAR_PDF_BYTES+24*1024*1024});
  return new Response(zip,{headers:{...headers,'Content-Type':'application/zip','Content-Disposition':'attachment; filename="MZS-Administration-'+source.administration.fiscal_year+'-'+source.administration.issuer_id.slice(0,8)+'.zip"'}});
 }catch(error){
  const known=error instanceof YearOriginalError;
  const reason=known&&error.code==='limit'?'This year exceeds 500 PDFs or 64 MiB of originals. Contact the administrator for a complete export. / Este ejercicio supera 500 PDF o 64 MiB de originales. Contacte con el administrador para obtener una exportación completa.':
   known?'An archived PDF is unavailable or changed. Check the document archive and try again. / Un PDF archivado no está disponible o ha cambiado. Revise el archivo e inténtelo de nuevo.':'The complete year package could not be created. Try again. / No se pudo crear el dossier anual completo. Inténtelo de nuevo.';
  const reference=known&&error.documentId?' Document / Documento: '+error.documentId+'.':'';
  return new Response(reason+reference+' No partial download was returned. / No se ha descargado un dossier parcial.',{status:known&&error.code==='limit'?413:503,headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}});
 }
}
