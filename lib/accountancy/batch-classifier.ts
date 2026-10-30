import type {Category} from './archive';
export type BatchClassification={category:Category;fiscal_year:number;title:string;period_label:string;document_date:string|null;review_status:'pending_review'|'needs_attention';notes:string};
export function classifyPrivateAccountancyPdf(filename:string,defaultYear:number):BatchClassification{
 const base=filename.normalize('NFKC').trim();
 if(!base||base.length>255||/[\r\n/\\\u0000]/u.test(base)||!base.toLowerCase().endsWith('.pdf'))throw Error('invalid_filename');
 const invoice=/^Factura1-(20\d{2})-1-(\d{1,8})\b/i.exec(base);
 if(invoice){
  const year=Number(invoice[1]),num=invoice[2];
  return {
   category:'supplier_invoice',fiscal_year:year,title:'Supplier invoice '+year+'/1/'+num,
   period_label:year+'/1/'+num,document_date:null,review_status:'pending_review',
   notes:'Original supplier invoice archived from a supplied PDF. Invoice date, amount, VAT and payment status must be checked against the original before any financial entry. No invoice, payment or VAT deduction is posted by this archival action.'
  };
 }
 const a=/\b(20\d{2})\b/g,years=[...base.matchAll(a)].map(m=>Number(m[1]));
 const fiscal_year=years.find(y=>y>=2000&&y<=2199)??defaultYear;
 if(!Number.isInteger(fiscal_year)||fiscal_year<1900||fiscal_year>2199)throw Error('invalid_year');
 const type=/MOD[. _-]*200\b/i.test(base)?'corporate_tax':
  /MOD[. _-]*303\b/i.test(base)?'vat_return':
  /MOD[. _-]*390\b/i.test(base)?'vat_summary':'other';
 const quarter=/(?:\b[1-4]\s*[º°]?\s*T\b|\b[1-4]\s*TRIM)/i.exec(base);
 return {category:type,fiscal_year,
  title:base.replace(/\.pdf$/i,'').slice(0,160),
  period_label:quarter?quarter[0].replace(/\s/g,'').slice(0,40):String(fiscal_year),
  document_date:null,review_status:'pending_review',
  notes:'Historical original retained by year and legal entity; no tax, VAT, ledger or payment posting. All source details require a separate accountant review.'};
}
