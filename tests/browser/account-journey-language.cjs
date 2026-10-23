// Local integration fixture only: all auth/data calls use an in-memory server, never real accounts.
const {chromium}=require(process.env.MZS_PLAYWRIGHT_MODULE || 'playwright');
const http=require('node:http');const assert=require('node:assert/strict');const {spawn}=require('node:child_process');
let debugPage;
const id='11111111-1111-4111-8111-111111111111';
let proof=true, consume=true, activation=true, recoveries=[], rpcCalls=[];
let saved={},role='client',active=true,failSave=false,failLogin=false,updates=[];
const user=()=>({id,aud:'authenticated',role:'authenticated',email:'test@example.invalid',email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:saved});
const token=()=>[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'local-test-signature'].join('.');
const mock=http.createServer(async(req,res)=>{res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');res.setHeader('Content-Type','application/json');if(req.method==='OPTIONS'){res.end();return;}let body='';for await(const b of req)body+=b;let data={};try{data=JSON.parse(body||'{}')}catch{}
const url=new URL(req.url,'http://local');if(process.env.DEBUG_ACCOUNT_FIXTURE)console.log(req.method,url.pathname);
if(url.pathname==='/auth/v1/recover'){recoveries.push(data);res.end('{}');return;}
if(url.pathname.startsWith('/rest/v1/rpc/')){rpcCalls.push({path:url.pathname,data});if(url.pathname.endsWith('/has_mzs_verified_auth_action')){res.end(JSON.stringify(proof));return;}if(url.pathname.endsWith('/consume_mzs_password_recovery')){res.end(JSON.stringify(consume));return;}if(url.pathname.endsWith('/complete_invitation_name')){res.end('true');return;}if(url.pathname.endsWith('/finalize_invited_registration')){res.end(JSON.stringify(activation));return;}}
if(url.pathname==='/auth/v1/token'){if(failLogin){res.statusCode=400;res.end(JSON.stringify({error:'invalid_grant',error_description:'Invalid login credentials'}));return;}res.end(JSON.stringify({access_token:token(),refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user:user()}));return;}
if(url.pathname==='/auth/v1/user'){if(req.method==='PUT'){updates.push(data);if(failSave){res.statusCode=500;res.end(JSON.stringify({msg:'Test failure'}));return;}saved={...saved,...data.data};}res.end(JSON.stringify(user()));return;}
if(url.pathname==='/auth/v1/logout'){res.end('{}');return;}
if(url.pathname==='/rest/v1/profiles'){res.end(JSON.stringify({id,role,is_active:active,full_name:'Preview Tester'}));return;}
if(url.pathname==='/rest/v1/rpc/mzs_has_department_scope'){res.end('false');return;}
res.end('[]');});
(async()=>{
 await new Promise(r=>mock.listen(3091,'127.0.0.1',r));
 const server=spawn('npm',['run','dev','--','--hostname','127.0.0.1','--port','3090'],{cwd:process.cwd(),env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3091',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'local-test-key',VERCEL_ENV:'development'},stdio:'ignore'});
 process.on('exit',()=>{server.kill();mock.close()});
 for(let n=0;n<120;n++){try{await fetch('http://127.0.0.1:3090/login');break;}catch{}await new Promise(r=>setTimeout(r,500));}
 const browser=await chromium.launch({headless:true});const context=await browser.newContext();const page=await context.newPage();debugPage=page;page.setDefaultTimeout(25000);const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/MISSING_MESSAGE|FORMATTING_ERROR|IntlError/.test(m.text()))errors.push(m.text());});
 // Next dev normalizes locale redirects to localhost; keep one cookie origin throughout.
 const base='http://localhost:3090';let registrations=[],registrationError=null;
 await context.route('**/api/account/register',async r=>{registrations.push(r.request().postDataJSON());await r.fulfill({status:registrationError?409:201,contentType:'application/json',body:JSON.stringify(registrationError?{error:registrationError}:{ok:true})});});
 async function layout(name){for(const width of [375,1440]){await page.setViewportSize({width,height:950});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' overflow '+width);}}
 async function login(){active=true;await page.goto(base+'/login');await page.locator('input[name=email]').fill('test@example.invalid');await page.locator('input[name=password]').fill('local-only-test-password');await page.locator('button[type=submit]').click();await page.waitForURL('**/private');await page.getByRole('heading',{name:/Welcome|Welkom|Bienvenido/}).waitFor();}
 for(const locale of (process.env.ACCOUNT_TEST_LOCALE?[process.env.ACCOUNT_TEST_LOCALE]:['en','nl','es'])){
  const c=require('../../messages/'+locale+'.json').AccountUI;
  await context.addCookies([{name:'MZS_LOCALE',value:locale,url:base}]);saved={preferred_language:locale};
  await page.goto(base+'/request-access');await page.getByRole('heading',{name:c.a078,exact:true}).waitFor();assert.equal(await page.locator('html').getAttribute('lang'),locale);await layout(locale+' registration');
  await page.locator('input[autocomplete=name]').fill('Local Tester');await page.locator('input[type=email]').fill('test@example.invalid');
  await page.locator('input[type=password]').nth(0).fill('local-test-password');await page.locator('input[type=password]').nth(1).fill('local-test-password');
  await page.getByLabel(c.a065,{exact:true}).check();registrationError='Your account may have been created, but we could not verify the application record. Contact MZS Group; do not register twice.';
  await page.locator('button[type=submit]').click();await page.locator('p[role=alert]').waitFor();assert.equal(await page.locator('p[role=alert]').innerText(),c.registration12);registrationError=null;
  await page.locator('button[type=submit]').click();await page.getByRole('heading',{name:c.a074,exact:true}).waitFor();assert.equal(registrations.at(-1).preferred_language,locale);assert.deepEqual(registrations.at(-1).interests,['investment']);await layout(locale+' registered');
  await page.goto(base+'/registration-pending');await page.getByRole('heading',{name:c.a092,exact:true}).waitFor();await layout(locale+' pending');
  await page.goto(base+'/forgot-password');await page.getByRole('heading',{name:c.a003,exact:true}).waitFor();await layout(locale+' forgot');await page.locator('input[type=email]').fill('test@example.invalid');await page.locator('button[type=submit]').click();await page.getByRole('heading',{name:c.a002,exact:true}).waitFor();assert.equal(await page.locator('p[role=status]').innerText(),c.a000);assert.equal(recoveries.at(-1).email,'test@example.invalid');
  await login();proof=false;await page.goto(base+'/reset-password');await page.getByRole('heading',{name:c.a022,exact:true}).waitFor();await layout(locale+' invalid recovery');
  proof=true;await page.reload();await page.getByRole('heading',{name:c.a025,exact:true}).waitFor();await layout(locale+' recovery');
  await page.locator('input[type=password]').nth(0).fill('new-local-password');await page.locator('input[type=password]').nth(1).fill('different-password');await page.locator('button[type=submit]').click();assert.equal(await page.locator('p[role=alert]').innerText(),c.a012);
  await page.locator('input[type=password]').nth(1).fill('new-local-password');await page.locator('button[type=submit]').click();await page.getByRole('heading',{name:c.a032,exact:true}).waitFor();assert.ok(rpcCalls.some(x=>x.path.endsWith('/consume_mzs_password_recovery')));assert.ok(updates.some(x=>x.password==='new-local-password'));
  await login();active=false;proof=true;await page.goto(base+'/accept-invitation');await page.getByRole('heading',{name:c.a054,exact:true}).waitFor();await layout(locale+' invite');
  await page.locator('input[type=password]').nth(0).fill('local-invite-password');await page.locator('input[type=password]').nth(1).fill('local-invite-password');await page.locator('button[type=submit]').click();await page.getByRole('heading',{name:c.welcomeName.replace('{name}','Preview'),exact:true}).waitFor();assert.ok(rpcCalls.some(x=>x.path.endsWith('/finalize_invited_registration')));await layout(locale+' activated');
  console.log('PASS',locale,'registration incl partial error, pending, generic recovery, invalid/valid reset, verified invitation, RPC contracts and mobile/desktop');
 }
 // Invalid token pages retain both search and hash when changing language; no new prefixed security URLs.
 await context.clearCookies();await page.goto(base+'/reset-password?test=keep#keep-fragment');await page.getByRole('heading',{name:'Link unavailable.',exact:true}).waitFor();await page.locator('summary[aria-label]').click();await page.getByRole('link',{name:'Nederlands',exact:true}).click();await page.getByRole('heading',{name:'Link niet beschikbaar.',exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,'/reset-password');assert.equal(new URL(page.url()).search,'?test=keep');assert.equal(new URL(page.url()).hash,'#keep-fragment');
 await page.setViewportSize({width:375,height:950});await page.screenshot({path:'/tmp/account-recovery-nl-375.png'});
 assert.deepEqual(errors,[]);console.log('PASS language switch preserves token-route query/hash; no browser translation errors');
 await browser.close();server.kill();mock.close();process.exit(0);
})().catch(async e=>{console.error(e);if(debugPage){console.log(await debugPage.locator('main').innerText());}console.log('Recent RPCs',rpcCalls.slice(-8));process.exit(1)});
