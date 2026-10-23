// Local integration fixture only: all auth/data calls use an in-memory server, never real accounts.
const {chromium}=require(process.env.MZS_PLAYWRIGHT_MODULE || 'playwright');
const http=require('node:http');const assert=require('node:assert/strict');const {spawn}=require('node:child_process');
const id='11111111-1111-4111-8111-111111111111';
let contactUpdates=[],cancellationCalls=[],bookingStatus='confirmed',cancellations=[];
let saved={},role='client',active=true,failSave=false,failLogin=false,updates=[];
const user=()=>({id,aud:'authenticated',role:'authenticated',email:'test@example.invalid',email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:saved});
const token=()=>[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'local-test-signature'].join('.');
const mock=http.createServer(async(req,res)=>{res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');res.setHeader('Content-Type','application/json');if(req.method==='OPTIONS'){res.end();return;}let body='';for await(const b of req)body+=b;let data={};try{data=JSON.parse(body||'{}')}catch{}
const url=new URL(req.url,'http://local');
if(url.pathname==='/auth/v1/token'){if(failLogin){res.statusCode=400;res.end(JSON.stringify({error:'invalid_grant',error_description:'Invalid login credentials'}));return;}res.end(JSON.stringify({access_token:token(),refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user:user()}));return;}
if(url.pathname==='/auth/v1/user'){if(req.method==='PUT'){updates.push(data);if(failSave){res.statusCode=500;res.end(JSON.stringify({msg:'Test failure'}));return;}saved={...saved,...data.data};}res.end(JSON.stringify(user()));return;}
if(url.pathname==='/auth/v1/logout'){res.end('{}');return;}
if(url.pathname==='/rest/v1/profiles'){res.end(JSON.stringify({id,role,is_active:active,full_name:'Preview Tester'}));return;}
if(url.pathname==='/rest/v1/mzs_member_contact_details'){res.end('{}');return;}
if(url.pathname==='/rest/v1/rpc/mzs_set_member_contact'){contactUpdates.push(data);res.end('true');return;}
if(url.pathname==='/rest/v1/rental_bookings'){res.end(JSON.stringify([{id:'22222222-2222-4222-8222-222222222222',project_id:'property-1',rental_configuration_id:null,check_in:'2027-03-21',check_out:'2027-03-25',guest_count:2,status:bookingStatus,is_test:false,quoted_total_eur:1200,created_at:'2026-10-23T10:00:00Z'}]));return;}
if(url.pathname==='/rest/v1/projects'){res.end(JSON.stringify([{id:'property-1',title:'TEST Residence',slug:'test-residence'}]));return;}
if(url.pathname==='/rest/v1/rental_cancellation_requests'){res.end(JSON.stringify(cancellations));return;}
if(url.pathname==='/rest/v1/rpc/request_booking_cancellation'){cancellationCalls.push(data);cancellations=[{id:'33333333-3333-4333-8333-333333333333',booking_id:data.p_booking_id,reason:data.p_reason,status:'pending',created_at:'2026-10-23T10:00:00Z',reviewed_at:null}];res.end(JSON.stringify(cancellations[0].id));return;}
if(url.pathname==='/rest/v1/rpc/mzs_has_department_scope'){res.end('false');return;}
res.end('[]');});
(async()=>{await new Promise(r=>mock.listen(3091,'127.0.0.1',r));const server=spawn('npm',['run','dev','--','--hostname','127.0.0.1','--port','3090'],{cwd:process.cwd(),env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3091',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'local-test-key',VERCEL_ENV:'development'},stdio:'ignore'});process.on('exit',()=>{server.kill();mock.close()});for(let n=0;n<120;n++){try{await fetch('http://127.0.0.1:3090/login');break;}catch{}await new Promise(r=>setTimeout(r,500));}
const browser=await chromium.launch({headless:true});const errors=[];
async function ctx(){const context=await browser.newContext();await context.route('**/api/capital-client-summary',r=>r.fulfill({status:200,contentType:'application/json',body:'{"items":[]}'}));const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {page,context};}
async function login(page,locale){await page.goto('http://127.0.0.1:3090'+(locale==='en'?'':('/'+locale))+'/login');await page.locator('input[name=email]').fill('test@example.invalid');await page.locator('input[name=password]').fill('local-only-test-password');await page.locator('button[type=submit]').click();}
let {page,context}=await ctx();
for(const [locale,errorText] of [['en','Invalid email or password.'],['nl','Ongeldig e-mailadres of wachtwoord.'],['es','Correo electrónico o contraseña incorrectos.']]){failLogin=true;await login(page,locale);await page.locator('p[role=alert]').waitFor();assert.equal(await page.locator('p[role=alert]').innerText(),errorText);for(const width of [375,1440]){await page.setViewportSize({width,height:950});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'login overflow '+locale);}}
failLogin=false;await login(page,'nl');await page.waitForURL('**/private');await page.getByRole('heading',{name:/Welkom/}).waitFor();assert.equal(await page.locator('html').getAttribute('lang'),'nl');
await page.locator('summary[aria-label="Kies je taal"]').click();await page.getByRole('link',{name:'Español',exact:true}).click();await page.getByRole('heading',{name:/Bienvenido/}).waitFor();assert.equal(saved.preferred_language,'es');assert.deepEqual(updates.map(x=>x.data),[{preferred_language:'es'}]);assert.ok(updates.every(x=>!x.email&&!x.password));console.log('PASS login errors in EN/NL/ES, layout widths, NL dashboard and account preference saving');
await page.setViewportSize({width:375,height:950});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'dashboard overflow');await page.screenshot({caret:'initial',path:'/tmp/client-es-375.png'});
await context.close();({page,context}=await ctx());await login(page,'en');await page.waitForURL('**/private');await page.getByRole('heading',{name:/Bienvenido/}).waitFor();assert.equal(await page.locator('html').getAttribute('lang'),'es');console.log('PASS persisted account language on a new device despite English login');
failSave=true;await page.locator('summary[aria-label="Elige tu idioma"]').click();await page.getByRole('link',{name:'Nederlands',exact:true}).click();await page.locator('p[role=alert]').waitFor();assert.match(await page.locator('p[role=alert]').innerText(),/No se ha podido guardar/);assert.equal(saved.preferred_language,'es');failSave=false;console.log('PASS visible save failure without false preference update');
// Local-only profile mutations and cancellation requests verify translated UI keeps RPC contracts.
for(const [locale,profileTitle,companyTab,securityTab,reservationTitle] of [
 ['en','My Profile.','My Companies','Email & Security','My Reservations.'],
 ['nl','Mijn profiel.','Mijn bedrijven','E-mail en beveiliging','Mijn reserveringen.'],
 ['es','Mi perfil.','Mis empresas','Correo y seguridad','Mis reservas.']]) {
 saved={preferred_language:locale};
 await page.goto('http://127.0.0.1:3090/private/profile');
 await page.getByRole('heading',{name:profileTitle,exact:true}).waitFor();
 await page.locator('input[autocomplete="name"]').waitFor();
 for(const width of [375,1440]){await page.setViewportSize({width,height:950});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'profile overflow '+locale);}
 await page.getByRole('button',{name:companyTab,exact:true}).click();
 await page.getByRole('button',{name:/^\+ /}).click();
 assert.equal(await page.locator('select option').count(),8);
 await page.getByRole('button',{name:securityTab,exact:true}).click();
 assert.equal(await page.locator('input[type="password"]').count(),3);
 await page.goto('http://127.0.0.1:3090/private/reservations');
 await page.getByRole('heading',{name:reservationTitle,exact:true}).waitFor();
 await page.getByRole('heading',{name:'TEST Residence',exact:true}).waitFor();
 assert.ok((await page.locator('main').innerText()).includes(new Intl.NumberFormat(locale==='en'?'en-GB':locale,{style:'currency',currency:'EUR'}).format(1200)));
 for(const width of [375,1440]){await page.setViewportSize({width,height:950});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'reservations overflow '+locale);}
}
await page.goto('http://127.0.0.1:3090/private/profile');
await page.locator('input[autocomplete="name"]').fill('Updated Test Name');
await page.getByRole('button',{name:'Guardar datos personales →',exact:true}).click();
await page.getByText('Tus datos personales y tu dirección se han guardado.',{exact:true}).waitFor();
assert.equal(contactUpdates.at(-1).p_full_name,'Updated Test Name');
await page.goto('http://127.0.0.1:3090/private/reservations');
await page.getByRole('button',{name:'SOLICITAR CANCELACIÓN',exact:true}).click();
await page.getByLabel('Motivo de cancelación').fill('Controlled local test only');
page.once('dialog',async d=>{assert.match(d.message(),/¿Enviar/);await d.accept()});
await page.getByRole('button',{name:'ENVIAR SOLICITUD DE CANCELACIÓN',exact:true}).click();
await page.getByRole('heading',{name:'HISTORIAL DE CANCELACIONES',exact:true}).waitFor();
assert.equal(cancellationCalls.length,1);assert.equal(cancellationCalls[0].p_reason,'Controlled local test only');
assert.equal(await page.getByRole('button',{name:'SOLICITAR CANCELACIÓN',exact:true}).count(),0);
await page.setViewportSize({width:375,height:950});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'cancellation history overflow');
await page.screenshot({path:'/tmp/member-reservations-es.png'});
console.log('PASS EN/NL/ES profiles, company/security tabs, reservations, formats, mobile layouts; profile RPC and cancellation RPC with pending duplicate protection');
await context.close();({page,context}=await ctx());active=false;await login(page,'nl');await page.locator('p[role=alert]').waitFor();assert.match(await page.locator('p[role=alert]').innerText(),/niet actief/);assert.ok(page.url().endsWith('/nl/login'));console.log('PASS inactive accounts remain blocked');
assert.deepEqual(errors,[]);await browser.close();server.kill();mock.close();process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
