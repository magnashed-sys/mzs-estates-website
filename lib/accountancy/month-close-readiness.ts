/**
 * Source-backed month-close preparation, not a posting, month lock, tax return,
 * bank reconciliation, profit calculation, or proof of actual settlement.
 * Current invoice balances are displayed as of NOW for invoices issued in the
 * chosen month, never as historical month-end payment snapshots.
 */
import {yearIncome} from './cost-centers';
import {annualEvidenceReadiness} from './annual-evidence';
import {annualInvoiceControl} from './invoice-control';
import type {YearSource} from './administration';
import type {InvoiceRow} from '../finance/invoice-register';
import {remaining,type BankSnapshot} from './bank/model';

export type MonthCloseBankStatus='available'|'unavailable';
export type MonthCloseReadiness={
 month:string;issuer_id:string;
 invoices:{count:number;unknownBalances:number;unpaidCount:number;outstandingCents:number;overdueCents:number;receivedRecordedCents:number};
 purchases:{count:number;missingOriginals:number;pendingReview:number;archiveReview:number;duplicateSignals:number;grossConceptCents:number};
 allocations:{unallocatedInvoices:number;unallocatedGrossCents:number};
 bank:{status:MonthCloseBankStatus;transactionCount:number|null;unallocatedTransactions:number|null;unallocatedAbsoluteCents:number|null};
 checklist:{completed:number;total:number};
};
const checkMoney=(n:number)=>{
 if(!Number.isSafeInteger(n)||n<0||n>100_000_000_000_000)throw Error('Unverified month-close source amount');
 return n;
};
function add(previous:number,next:number){
 const sum=previous+checkMoney(next);
 if(!Number.isSafeInteger(sum))throw Error('Month-close amount exceeds safe range');
 return sum;
}
const iso=/^20\d{2}-(0[1-9]|1[0-2])$/;
export function monthCloseReadiness(source:YearSource,invoices:readonly InvoiceRow[],month:string,
 today:string,bank:BankSnapshot|null):MonthCloseReadiness{
 if(!iso.test(month)||Number(month.slice(0,4))!==source.administration.fiscal_year||
    !/^\d{4}-\d{2}-\d{2}$/.test(today))throw Error('Invalid reporting period');
 const issuer_id=source.administration.issuer_id;
 const relevant=invoices.filter(i=>i.issuerId===issuer_id&&i.issuedOn.slice(0,7)===month&&i.source!=='archive');
 const seen=new Set<string>();
 let outstandingCents=0,overdueCents=0,receivedRecordedCents=0,unknownBalances=0,unpaidCount=0;
 for(const invoice of relevant){
  const id=invoice.source+':'+invoice.id;
  if(seen.has(id))throw Error('Duplicate month-close invoice');seen.add(id);
  checkMoney(Math.abs(invoice.gross));
  if(invoice.paid===null||invoice.balance===null){unknownBalances++;continue;}
  checkMoney(Math.abs(invoice.paid));checkMoney(Math.abs(invoice.balance));
  if(invoice.gross>0&&invoice.balance>0){
   unpaidCount++;outstandingCents=add(outstandingCents,invoice.balance);
   if(invoice.dueOn&&invoice.dueOn<today)overdueCents=add(overdueCents,invoice.balance);
  }
  if(invoice.gross>0&&invoice.paid>0)receivedRecordedCents=add(receivedRecordedCents,invoice.paid);
 }
 const costs=source.costs.filter(c=>c.invoice_date.slice(0,7)===month);
 const evidence=annualEvidenceReadiness(source).rows.filter(r=>r.invoice_date.slice(0,7)===month);
 const controls=annualInvoiceControl(source).rows.filter(r=>r.invoice_date.slice(0,7)===month);
 let grossConceptCents=0;
 for(const cost of costs)grossConceptCents=add(grossConceptCents,cost.gross_cents);
 const income=yearIncome(source).filter(r=>r.invoice_date.slice(0,7)===month&&!r.allocation);
 let unallocatedGrossCents=0;
 for(const i of income)unallocatedGrossCents=add(unallocatedGrossCents,i.gross_cents);
 const purchases={
  count:costs.length,
  missingOriginals:evidence.filter(r=>r.issues.includes('missing_original')).length,
  pendingReview:evidence.filter(r=>r.issues.includes('cost_pending_review')).length,
  archiveReview:evidence.filter(r=>r.issues.includes('archive_pending_review')).length,
  duplicateSignals:controls.filter(r=>r.issues.includes('possible_double_entry')).length,
  grossConceptCents
 };
 const result:MonthCloseReadiness={
  month,issuer_id,
  invoices:{count:relevant.length,unknownBalances,unpaidCount,outstandingCents,overdueCents,receivedRecordedCents},
  purchases,
  allocations:{unallocatedInvoices:income.length,unallocatedGrossCents},
  bank:{status:'unavailable',transactionCount:null,unallocatedTransactions:null,unallocatedAbsoluteCents:null},
  checklist:{completed:Object.values(source.administration.checks).filter(Boolean).length,total:Object.keys(source.administration.checks).length}
 };
 if(bank){
  if(bank.issuer_id!==issuer_id||bank.year!==source.administration.fiscal_year)throw Error('Bank register outside selected administration');
  let unallocatedTransactions=0,unallocatedAbsoluteCents=0;
  const transactions=bank.transactions.filter(tx=>!tx.voided_at&&tx.booked_on.slice(0,7)===month);
  for(const tx of transactions){
   const rem=remaining(tx,bank.allocations);
   if(!Number.isSafeInteger(rem)||rem<0||rem>Math.abs(tx.amount_cents))throw Error('Invalid bank allocation remaining amount');
   if(rem>0){
    unallocatedTransactions++;
    unallocatedAbsoluteCents=add(unallocatedAbsoluteCents,rem);
   }
  }
  result.bank={status:'available',transactionCount:transactions.length,unallocatedTransactions,unallocatedAbsoluteCents};
 }
 return result;
}
