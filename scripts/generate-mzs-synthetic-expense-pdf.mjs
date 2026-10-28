import {writeFileSync} from "node:fs";
import {pathToFileURL} from "node:url";

const MARKER="MZS-SYNTHETIC-EXPENSE-TEST-2026";
/** Generate a self-contained, *fictional* PDF with a valid xref table.
 * No third-party templates, real invoices, emails, customer names or amounts.
 */
export function buildMzsSyntheticExpensePdf(){
 const stream="BT /F1 14 Tf 55 770 Td (MZS GROUP - SYNTHETIC PDF ACCEPTANCE ONLY) Tj "+
  "0 -28 Td (NOT A SUPPLIER INVOICE - NO REAL INFORMATION) Tj "+
  "0 -28 Td (No legal, tax, accounting or payment effect.) Tj ET\n";
 const objects=[
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
  "<< /Length "+Buffer.byteLength(stream,"latin1")+" >>\nstream\n"+stream+"endstream",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
 ];
 let output="%PDF-1.4\n%"+MARKER+"\n";
 const offsets=[0];
 for(const [i,body] of objects.entries()){
  offsets.push(Buffer.byteLength(output,"latin1"));
  output+=(i+1)+" 0 obj\n"+body+"\nendobj\n";
 }
 const xref=Buffer.byteLength(output,"latin1");
 output+="xref\n0 "+(objects.length+1)+"\n0000000000 65535 f \n";
 for(const pos of offsets.slice(1))
  output+=String(pos).padStart(10,"0")+" 00000 n \n";
 output+="trailer\n<< /Size "+(objects.length+1)+" /Root 1 0 R >>\n";
 output+="startxref\n"+xref+"\n%%EOF\n";
 return Buffer.from(output,"latin1");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const target=process.argv[2]||"mzs-synthetic-expense-test.pdf";
 writeFileSync(target,buildMzsSyntheticExpensePdf(),{flag:"wx"});
 process.stdout.write("Generated fictional PDF test fixture: "+target+"\n");
}
