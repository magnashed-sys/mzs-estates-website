export const relationshipUuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export type OverviewTarget={kind:'profile'|'relationship';id:string};
export type OverviewRelation={id:string;name:string;kind:string;profile_id:string|null;email:string;phone:string;address:string;roles:string[]};
export type OverviewScope={profileId:string|null;relationshipIds:string[]};
export type OverviewItem={id:string;title:string;detail:string;href:string;basis:string;date?:string;status?:string};
export type OverviewSection={id:string;items:OverviewItem[];unavailable:boolean};
export type LinkedContract={id:string;title:string;tenant_profile_id:string|null;tenant_relationship_id:string|null;property_id:string;status:string;lease_start:string;lease_end:string|null};
export function overviewTarget(params:Record<string,string|string[]|undefined>):OverviewTarget|null{
 const profile=params.profile,relationship=params.relationship;
 if((profile!==undefined)===(relationship!==undefined))return null;
 const id=profile??relationship;if(typeof id!=='string'||!relationshipUuid.test(id))return null;
 return {kind:profile?'profile':'relationship',id:id.toLowerCase()};
}
export function contractInScope(c:LinkedContract,scope:OverviewScope){
 // A saved contract account takes precedence over later changes to the CRM contact account.
 if(scope.profileId&&c.tenant_profile_id)return c.tenant_profile_id===scope.profileId;
 return !!c.tenant_relationship_id&&scope.relationshipIds.includes(c.tenant_relationship_id);
}
export function billingSelection<T extends {id:string;contract_id:string}>(rows:T[],contract:string|null,invoice:string|null){return rows.filter(r=>(!contract||r.contract_id===contract)&&(!invoice||r.id===invoice));}
export type OverviewInvoice={id:string;issuer_id:string;number:string;issued_on:string;gross:string|number;source:string;href:string;basis:string};
export function overviewInvoices(rows:OverviewInvoice[]):OverviewItem[]{
 const identities=new Map<string,OverviewInvoice>();
 for(const row of rows){
  if(!row.number?.trim()||!Number.isFinite(Number(row.gross)))throw Error('Invalid invoice identity');
  const key=row.issuer_id+':'+row.number.trim().toUpperCase(),old=identities.get(key);
  if(old){
   if(old.issued_on!==row.issued_on||Number(old.gross)!==Number(row.gross)||old.source===row.source||old.source!=='archive'&&row.source!=='archive')throw Error('Conflicting linked invoices');
   if(old.source==='archive')identities.set(key,row);
  }else identities.set(key,row);
 }
 return [...identities.values()].sort((a,b)=>b.issued_on.localeCompare(a.issued_on)||a.number.localeCompare(b.number)).map(r=>({id:r.source+':'+r.id,title:r.number,detail:'',date:r.issued_on,href:r.href,basis:r.basis,status:r.source}));
}
export const overviewCopy:Record<string,[string,string]>={
 entity_roles:['Entity–property roles','Funciones entidad–inmueble'],entity_property:['Recorded legal-entity link; dated role','Vínculo registrado de entidad; función con fechas'],entity_document:['Document filed under the linked legal entity','Documento archivado bajo la entidad vinculada'],account_inactive:['Account inactive','Cuenta inactiva'],companies:['Companies & linked CRM records','Empresas y registros CRM vinculados'],contracts:['Rental contracts','Contratos de alquiler'],properties:['Properties in rental contracts','Inmuebles en contratos de alquiler'],projects:['Project access','Acceso a proyectos'],bookings:['Account bookings','Reservas de la cuenta'],sales:['Issued invoices & credit notes','Facturas emitidas y abonos'],purchases:['Supplier invoices','Facturas del proveedor'],capital:['Loan dossier access','Acceso a expedientes de préstamos'],documents:['Linked documents','Documentos vinculados'],
 crm:['Explicit CRM account link','Vínculo explícito de cuenta CRM'],declared:['Self-declared company affiliation','Vinculación empresarial declarada'],contract:['Recorded tenant link','Vínculo de arrendatario registrado'],property:['Property recorded on linked contract','Inmueble registrado en contrato vinculado'],grant:['Recorded project permission','Permiso de proyecto registrado'],booking:['Booking linked to this account','Reserva vinculada a esta cuenta'],customer:['Recorded customer link','Vínculo de cliente registrado'],rental:['Rental contract invoice','Factura de contrato de alquiler'],archive:['Explicit import-customer link','Vínculo explícito de cliente importado'],service:['Platform invoice','Factura de plataforma'],external:['External invoice','Factura externa'],credit:['Credit note','Abono'],supplier:['Recorded supplier link','Vínculo de proveedor registrado'],loan:['Recorded client access; not proof of ownership','Acceso de cliente registrado; no prueba de propiedad'],document:['Document linked to a supplier invoice','Documento vinculado a factura de proveedor'],capital_document:['Document in linked loan dossier','Documento en expediente de préstamo vinculado'],
 active:['Active','Activo'],inactive:['Inactive / revoked','Inactivo / revocado'],open:['Open source →','Abrir origen →'],search:['Search within this overview','Buscar en este resumen'],empty:['No explicitly linked records found.','No se encontraron registros vinculados explícitamente.'],unavailable:['This section could not be loaded completely. Refresh to retry; no count is shown.','No se pudo cargar esta sección por completo. Actualice para reintentar; no se muestra un total.'],previous:['Previous','Anterior'],next:['Next','Siguiente'],
};
export function overviewText(language:string,key:string){return overviewCopy[key]?.[language==='es'?1:0]??key;}
