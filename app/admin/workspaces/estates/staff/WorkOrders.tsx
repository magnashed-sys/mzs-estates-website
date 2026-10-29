'use client';
import {useAdminI18n} from '../../../../../lib/admin/i18n';

import {useActionState} from 'react';
import {initialFormActionState} from '../../../../../lib/property-operations/form-state';
import {createInternalWorkOrder,decideInternalWorkOrder} from './work-order-actions';
import type {Ticket} from '../../../../../lib/property-operations/staff-work';
import s from '../../../../staff/staff.module.css';
export type Order={id:string;ticket_id:string;legal_entity_id:string;supplier_relationship_id:string;scope_of_work:string;quotation_reference:string;approved_budget_net_cents:number;approved_budget_vat_cents:number;decision:string;latest_decision_id:string|null;decision_reason:string|null;created_at:string};
type Option={id:string;name:string};
const labels:Record<string,string>={draft:"Awaiting review",authorized_internally:"Budget approved internally",declined:"Rejected",cancelled:'Interne goedkeuring ingetrokken'};
const euro=(n:number, adminLocale = 'en-GB')=>new Intl.NumberFormat(adminLocale,{style:'currency',currency:'EUR'}).format(n/100);
function OrderDecision({order}:{order:Order}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const [state,action,pending]=useActionState(decideInternalWorkOrder,initialFormActionState);
 return <form className={s.form} action={action}><input type="hidden" name="work_order_id" value={order.id}/><input type="hidden" name="expected_decision_id" value={order.latest_decision_id??''}/><label>{adminT("Budget decision")}<select name="decision">{order.decision==='draft'?<><option value="authorized_internally">{adminT("Approve internally")}</option><option value="declined">{adminT("Reject")}</option></>:<option value="cancelled">{adminT("Withdraw internal approval")}</option>}</select></label><label>{adminT("Supporting evidence")}<textarea name="reason" required minLength={8} maxLength={1000} rows={2}/></label><button disabled={pending}>{pending?adminT("Saving…"):adminT("Beslissing vastleggen")}</button>{state.message&&<p role="status">{adminT(state.message)}</p>}</form>;
}
function NewOrder({ticket,issuers,suppliers}:{ticket:Ticket;issuers:Option[];suppliers:Option[]}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const [state,action,pending]=useActionState(createInternalWorkOrder,initialFormActionState);
 return <form className={s.form} action={action}><h4>{adminT("New draft work order")}</h4><input type="hidden" name="ticket_id" value={ticket.id}/><label>{adminT("Paying entity")}<select required name="legal_entity_id" defaultValue=""><option value="" disabled>{adminT("Choose verified cost bearer")}</option>{issuers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>{adminT("Supplier")}<select required name="supplier_relationship_id" defaultValue=""><option value="" disabled>{adminT("Choose existing relationship")}</option>{suppliers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>{adminT("Work description")}<textarea required name="scope_of_work" rows={3} minLength={10} maxLength={2000}/></label><label>{adminT("Quotation reference")}<input required name="quotation_reference" minLength={3} maxLength={180}/></label><div className={s.two}><label>{adminT("Budget excl. VAT (€)")}<input required name="net_eur" inputMode="decimal" placeholder="100,00"/></label><label>{adminT("VAT amount (€)")}<input required name="vat_eur" inputMode="decimal" placeholder={adminT("Bijvoorbeeld 0,00")}/></label></div><button disabled={pending||!issuers.length||!suppliers.length}>{pending?adminT("Saving…"):adminT("Save draft work order")}</button>{!issuers.length&&<p>{adminT("First record the paying entity under Properties & legal entities.")}</p>}{state.message&&<p role="status">{adminT(state.message)}</p>}</form>;
}
export default function WorkOrders({ticket,orders,issuers,suppliers,payerIds,history}:{ticket:Ticket;orders:Order[];issuers:Option[];suppliers:Option[];payerIds:string[];history:{id:string;work_order_id:string;decision:string;reason:string;decided_at:string}[]}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 return <section id="work-orders" className={s.panel}><h3>{adminT("Internal work orders & budget")}</h3><p>{adminT("Budget approval is an internal decision. Issue a supplier instruction separately. Budgets are not incurred or paid costs.")}</p>{orders.map(o=><article className={s.history} key={o.id}><h4>{o.quotation_reference} · {adminT(labels[o.decision])}</h4><p>{suppliers.find(x=>x.id===o.supplier_relationship_id)?.name??adminT("Supplier")} · {issuers.find(x=>x.id===o.legal_entity_id)?.name??adminT("Entity")}</p><p>{o.scope_of_work}</p><p>{euro(Number(o.approved_budget_net_cents), adminLocale)}  {adminT("excl. VAT +")} {euro(Number(o.approved_budget_vat_cents), adminLocale)}  {adminT("VAT =")} <strong>{euro(Number(o.approved_budget_net_cents)+Number(o.approved_budget_vat_cents), adminLocale)}</strong></p>{['draft','authorized_internally'].includes(o.decision)&&<OrderDecision key={o.latest_decision_id??o.id} order={o}/>}<ul>{history.filter(x=>x.work_order_id===o.id).map(x=><li key={x.id}>{x.decided_at.slice(0,10)} · {adminT(labels[x.decision])} · {x.reason}</li>)}</ul></article>)}{!orders.length&&<p>{adminT("No work orders yet.")}</p>}{['triaged','scheduled','in_progress'].includes(ticket.status)?<NewOrder ticket={ticket} issuers={issuers.filter(x=>payerIds.includes(x.id))} suppliers={suppliers}/>:<p>{adminT("Review the report first, or reopen planning, to add a draft work order.")}</p>}</section>;
}
