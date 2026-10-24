// Desktop browsers can expose type="month" as plain text, including partial input.
export function invoiceMonthStart(period: string): string | null {
  if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(period) || period.startsWith('0000')) return null;
  return `${period}-01`;
}

export function leaseSubjectPreview(subject: string, period: string, language: string, addresses: string): string | null {
  const start = invoiceMonthStart(period);
  if (!start) return null;
  const locale = ['nl', 'en', 'es'].includes(language) ? language : 'en';
  const month = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(new Date(`${start}T12:00:00Z`));
  return subject.replaceAll('{unitadres}', addresses || '[unit]').replaceAll('{maand}', month).replaceAll('{jaar}', period.slice(0, 4));
}
