import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const layoutSource = readFileSync('app/admin/layout.tsx','utf8');
const lightCSS = readFileSync('app/admin/admin-light-content.css','utf8');

async function renderAdminLayout(locale = 'en') {
  const exports = {};
  const js = ts.transpileModule(layoutSource,{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}
  }).outputText;
  vm.runInNewContext(js,{
    exports,
    require(id){
      if(id === 'next-intl/server') return {getLocale:async()=>locale};
      if(id === './AdminHeader') return {default:()=>React.createElement('header',{id:'shared-header'},'MZS GROUP')};
      if(id === './AdminNavigationGuard') return {AdminNavigationProvider:({children})=>React.createElement(React.Fragment,null,children)};
      if(id.endsWith('.css')) return {};
      return require(id);
    }
  });
  return renderToStaticMarkup(await exports.default({
    children:React.createElement('main',{id:'sample-administration-page'},'WORKSPACE DATA')
  }));
}

test('shared header stays outside the light-themed content on both admin languages',async()=>{
  for(const locale of ['en','es']){
    const html=await renderAdminLayout(locale);
    assert.match(html,/<header id="shared-header">MZS GROUP<\/header>/);
    assert.match(html,/<div class="admin-light-content"><main id="sample-administration-page">/);
    assert.ok(html.indexOf('shared-header') < html.indexOf('admin-light-content'));
    assert.equal((html.match(/id="shared-header"/g)||[]).length,1);
    assert.ok(html.includes('lang="'+locale+'"'));
  }
});

test('admin light CSS is scoped below the header and covers core information surfaces',()=>{
  assert.match(layoutSource,/import '\.\/admin-light-content\.css'/);
  assert.match(lightCSS,/\.admin-light-content\s*\{/);
  assert.doesNotMatch(lightCSS,/(?:^|\n)\s*(?:body|html|\.shell|header|\.admin-header)\s*\{/);
  for(const selector of [
    '.admin-page', '.mzsGroup','[class*="workspace_shell__"]',
    '[class*="_cockpit__"]','[class*="_panel__"]',
    '[class*="_card__"]','[class*="_metric__"]',
    '[class*="_tableWrap__"]','[class*="_filters__"]',
    '[class*="_failure__"]','[class*="_badge__"]'
  ]) assert.ok(lightCSS.includes(selector),'missing shared light treatment for '+selector);
  assert.match(lightCSS,/input:not\(\[type="checkbox"\]\)/);
  assert.match(lightCSS,/color-scheme:\s*light/);
  assert.match(lightCSS,/prefers-reduced-motion/);
});

test('new theme does not alter routes, persistence or the original shared header',()=>{
  const original=readFileSync('app/admin/AdminHeader.module.css','utf8');
  assert.match(original,/background:#0c0b09/);
  assert.doesNotMatch(lightCSS,/fetch\s*\(|auth\.|supabase|localStorage/);
  assert.ok(!layoutSource.includes('AdminHeader theme'));
});

test('light administration foregrounds maintain readable contrast',()=>{
  function luminance(hex){
    const c=hex.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
    return .2126*c[0]+.7152*c[1]+.0722*c[2];
  }
  function contrast(a,b){
    const x=luminance(a),y=luminance(b);
    return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
  }
  assert.ok(contrast('243f35','f5f5f0')>=7);
  assert.ok(contrast('455f50','ffffff')>=4.5);
  assert.ok(contrast('ffffff','28543f')>=7);
  assert.ok(contrast('607568','ffffff')>=4.5);
});
