/** Snapshot new-locale region labels and their order so SSR and browser ICU versions cannot disagree.
 * Regenerate deliberately and review the diff when updating CLDR/Node or the telephone library.
 */
import {getCountries} from 'libphonenumber-js';
import {writeFileSync} from 'node:fs';
const codes=[...new Set([...getCountries(),'AQ','BV','GS','HM','PN','TF','UM'])].sort();
const data=Object.fromEntries(['da','uk','fi','cs','hu','bg','sk','el'].map(locale=>{
 const names=new Intl.DisplayNames([locale],{type:'region'});
 return [locale,codes.map(code=>({code,name:names.of(code)||code})).sort((a,b)=>a.name.localeCompare(b.name,locale))];
}));
writeFileSync(new URL('../lib/european-country-names.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
console.log('Wrote reviewed country label snapshots for da, uk, fi, cs, hu, bg, sk and el.');
