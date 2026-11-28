import {notFound} from 'next/navigation';
import Link from 'next/link';
import {requireEstateAdmin} from '../../../../../../lib/security/estate-properties';
import {isAssistantBridgeEnvironment,isAssistantBridgeStaging} from '../../../../../../lib/accountancy/assistant-bridge';
import {scannerOptions} from '../../../../../../lib/accountancy/pdf/server';
import {scannerIsExplicitlyEnabled} from '../../../../../../lib/property-operations/scanner/cloudmersive-advanced';
import {archiveEntities,archiveLanguage} from '../../../../../../lib/accountancy/archive-data';
import {OriginalTransferForm} from './transfer-form';
import s from '../archive.module.css';

export const dynamic='force-dynamic';
export default async function AssistantOriginals(){
 if(!isAssistantBridgeEnvironment())notFound();
 const {db,user}=await requireEstateAdmin();
 const [language,entities,drafts]=await Promise.all([
  archiveLanguage(db,user.id),archiveEntities(db),
  db.from('mzs_ops_expense_drafts').select('id,legal_entity_id,invoice_date,supplier_invoice_number')
   .eq('status','draft').order('invoice_date',{ascending:false}).limit(200)
 ]);
 if(drafts.error)throw Error('Drafts unavailable');
 const options=(drafts.data??[]).map(d=>({id:d.id,label:
  `${d.supplier_invoice_number} · ${entities.find(e=>e.id===d.legal_entity_id)?.name??d.legal_entity_id} · ${d.invoice_date}`}));
 const ready=isAssistantBridgeStaging()&&scannerIsExplicitlyEnabled(scannerOptions());
 const es=language==='es';
 return <section className={s.panel}>
  <Link href="/admin/workspaces/accountancy/documents">← {es?'Archivo documental':'Document archive'}</Link>
  <h1>{es?'Transferencia de originales · Staging':'Original document transfer · Staging'}</h1>
  <p>{es?'Seleccione cada PDF original y su concepto existente. La entidad y el ejercicio proceden del concepto. No se crean facturas, proveedores ni pagos.':'Select each original PDF and its existing expense draft. Entity and financial year come from the draft. No invoices, suppliers or payments are created.'}</p>
  {!ready&&<p role="status">{es?'Transferencia desactivada. Requiere aprobación de privacidad y seguridad, configuración del antivirus y activación explícita en Staging.':'Transfer disabled. Privacy and security approval, antivirus configuration and explicit Staging activation are required.'}</p>}
  <OriginalTransferForm drafts={options} ready={ready} language={language}/>
 </section>;
}
