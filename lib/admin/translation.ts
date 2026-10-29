import catalogue from './translations.es.json';
import englishCatalogue from './translations.en.json';
export type AdminLanguage='en'|'es';
export type AdminValues=Record<string,string|number>;
export type AdminTranslator=(source:string|number|null|undefined,values?:AdminValues)=>string;
const spanish:Record<string,string>=catalogue;
const english:Record<string,string>=englishCatalogue;
const foldedSpanish=new Map(Object.entries(spanish).map(([key,value])=>[key.toLowerCase().replaceAll('_',' '),value]));
const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
const escape=(text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// Only reviewed, application-owned message patterns are eligible for interpolation.
// Data values are copied verbatim, never recursively translated or interpreted as HTML.
const patterns=Object.entries(spanish).filter(([key])=>/\{p\d+\}/.test(key)&&key.replace(/\{p\d+\}/g,'').replace(/[^A-Za-z]/g,'').length>=8&&!/\{p\d+\}\s*\{p\d+\}/.test(key)).map(([source,target])=>{
  const keys=[...source.matchAll(/\{(p\d+)\}/g)].map(m=>m[1]);
  const parts=source.split(/\{p\d+\}/);
  return {target,keys,prefix:parts[0],suffix:parts.at(-1)!,regex:new RegExp('^'+parts.map(escape).join('(.{1,2000}?)')+'$','s')};
});
function interpolate(text:string,values:AdminValues){return text.replace(/\{(\w+)\}/g,(match,key)=>Object.hasOwn(values,key)?String(values[key]):match);}
export function createAdminTranslator(language:string):AdminTranslator{
  return (source,values)=>{
    if(source===null||source===undefined)return '';
    if(typeof source==='number')return String(source);
    const key=normalize(source);
    const dictionary=language==='es'?spanish:english;
    let target=Object.hasOwn(dictionary,key)?dictionary[key]:language==='es'?(foldedSpanish.get(key.toLowerCase().replaceAll('_',' '))??source):source;
    if(language==='es'&&!Object.hasOwn(spanish,key)&&!values&&key.length<=2000){
      for(const pattern of patterns){
        if(!key.startsWith(pattern.prefix)||!key.endsWith(pattern.suffix))continue;
        const match=pattern.regex.exec(key);
        if(match){target=interpolate(pattern.target,Object.fromEntries(pattern.keys.map((name,i)=>[name,match[i+1]])));break;}
      }
    }
    return values?interpolate(target,values):target;
  };
}
const translators={en:createAdminTranslator('en'),es:createAdminTranslator('es')};
export function adminI18n(language:string){
  const key=language==='es'?'es':'en';
  return {t:translators[key],language:key as AdminLanguage,locale:key==='es'?'es-ES':'en-GB'};
}
