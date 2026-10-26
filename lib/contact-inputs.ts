import {getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode} from 'libphonenumber-js';

// ISO 3166-1 territories without a separate telephone plan are still valid addresses.
export const phoneCountries = getCountries();
export const countryCodes = [...new Set<string>([...phoneCountries, 'AQ', 'BV', 'GS', 'HM', 'PN', 'TF', 'UM'])].filter(c => !['AC', 'TA'].includes(c)).sort();
const locales = ['en', 'nl', 'es', 'de', 'it', 'fr', 'ru', 'pt-BR', 'ar', 'tr', 'lt', 'pl', 'zh-CN', 'sv', 'ro'];
const names = new Map<string, Intl.DisplayNames>();
function displayNames(locale: string) {
  if (!names.has(locale)) names.set(locale, new Intl.DisplayNames([locale], {type: 'region'}));
  return names.get(locale)!;
}
export function countryName(code: string, locale = 'en') { return displayNames(locale).of(code) || code; }
export function countryOptions(locale: string, telephone = false) {
  return (telephone ? phoneCountries : countryCodes).map(code => ({code, name: countryName(code, locale)}))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}
const lookup = new Map<string, string>();
function key(value: string) { return value.trim().normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase(); }
export function countryCode(value: string) {
  if (!lookup.size) {
    for (const code of countryCodes) {
      lookup.set(key(code), code);
      for (const locale of locales) lookup.set(key(countryName(code, locale)), code);
    }
    for (const [alias, code] of Object.entries({Holland:'NL', UK:'GB', UAE:'AE', USA:'US', Turkey:'TR'})) lookup.set(key(alias), code);
  }
  return lookup.get(key(value));
}
export function callingCode(country: string) {
  return country.startsWith('+') ? country.slice(1) : getCountryCallingCode(country as CountryCode);
}
function international(value: string) {
  return value.trim().replace(/[\u0660-\u0669\u06f0-\u06f9]/g, d => String(d.charCodeAt(0) % 16)).replace(/^00/, '+');
}
export function splitPhone(value: string) {
  const input = international(value);
  const parsed = input.startsWith('+') ? parsePhoneNumberFromString(input, {extract: false}) : undefined;
  return {value, country: parsed ? parsed.country || '+' + parsed.countryCallingCode : '', national: parsed ? parsed.formatNational() : value, error: ''};
}
export function editPhone(national: string, country: string) {
  const input = international(national);
  if (!input) return {value: '', country, national, error: ''};
  if (!country && !input.startsWith('+')) return {value: national, country, national, error: 'chooseCode'};
  const candidate = input.startsWith('+') ? input : country.startsWith('+') ? country + input : input;
  const parsed = parsePhoneNumberFromString(candidate, {defaultCountry: phoneCountries.includes(country as CountryCode) ? country as CountryCode : undefined, extract: false});
  if (!parsed || !parsed.isPossible()) return {value: national, country, national, error: 'invalidPhone'};
  const value = parsed.number + (parsed.ext ? ' ext. ' + parsed.ext : '');
  if (value.length > 40) return {value: national, country, national, error: 'invalidPhone'};
  return {value, country: input.startsWith('+') ? parsed.country || '+' + parsed.countryCallingCode : country,
    national: input.startsWith('+') ? parsed.formatNational() : national, error: ''};
}
