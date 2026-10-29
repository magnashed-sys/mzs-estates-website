import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync('lib/admin/translation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>({default:JSON.parse(readFileSync('lib/admin/'+name.replace('./',''),'utf8'))})});
export const {createAdminTranslator,adminI18n}=exports;
export function adminI18nFixture(language='en'){
 return {useAdminI18n:()=>adminI18n(language),getAdminI18n:async()=>adminI18n(language)};
}
