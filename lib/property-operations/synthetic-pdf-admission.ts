/**
 * Staging fixture intake only. This is NOT a malware scanner, sanitizer
 * or approval to handle real supplier/customer documents in Production.
 *
 * A conspicuous, exact marker is required to avoid accidental uploads of
 * real invoices while testing the private Storage/evidence workflow.
 */
export const SYNTHETIC_PDF_MARKER="MZS-SYNTHETIC-EXPENSE-TEST-2026";
export const MAX_SYNTHETIC_PDF_BYTES=4_194_304;
export type SyntheticPdfCheck={ok:true}|{ok:false;reason:string};

export function checkSyntheticExpensePdf(bytes:Uint8Array):SyntheticPdfCheck{
 if(!(bytes instanceof Uint8Array)||bytes.length<128||bytes.length>MAX_SYNTHETIC_PDF_BYTES)
  return {ok:false,reason:"Ongeldige grootte van het PDF-testbestand."};
 const text=Buffer.from(bytes).toString("latin1");
 if(!/^%PDF-(?:1\.[0-7]|2\.0)\r?\n/.test(text))
  return {ok:false,reason:"Het bestand begint niet met een geldige PDF-versie."};
 // Only PDFs generated specifically for MZS synthetic workflow admission.
 if(!text.slice(0,1024).includes("%"+SYNTHETIC_PDF_MARKER+"\n"))
  return {ok:false,reason:"Gebruik uitsluitend een herkenbaar fictief MZS PDF-testbestand."};
 if(!/%%EOF[ \t\r\n]*$/.test(text))
  return {ok:false,reason:"Het testbestand heeft geen geldig PDF-einde."};
 // Structural sanity checks: these do not independently prove that the
 // document is parseable, secure or free of malware.
 if(!/\/Type\s*\/Catalog\b/.test(text)||!/(\bxref\b|\/Type\s*\/XRef\b)/.test(text))
  return {ok:false,reason:"De basisstructuur van het PDF-testbestand ontbreekt."};
 // Basic denial of obvious active content. Compressed/obfuscated scripts can
 // evade token checks; never mistake this for antivirus or content scanning.
 if(/\/(?:JavaScript|JS|OpenAction|AA|Launch|EmbeddedFiles?|RichMedia|XFA|AcroForm|Encrypt)\b/i.test(text))
  return {ok:false,reason:"Het testbestand bevat actieve, ingebedde of versleutelde PDF-onderdelen."};
 return {ok:true};
}
