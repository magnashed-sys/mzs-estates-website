// Local integration fixture only: all auth/data calls use an in-memory server, never real accounts.
const {chromium}=require(process.env.MZS_PLAYWRIGHT_MODULE || 'playwright');
const http=require('node:http');const assert=require('node:assert/strict');const {spawn}=require('node:child_process');
const id='11111111-1111-4111-8111-111111111111';
let contactUpdates=[],cancellationCalls=[],bookingStatus='confirmed',cancellations=[];
let saved={},role='client',active=true,failSave=false,failLogin=false,updates=[];
let grant=true,offeringGrant=true,calendarFailure=false;
const projectId='44444444-4444-4444-8444-444444444444';
const tomorrow=new Date();tomorrow.setUTCMonth(tomorrow.getUTCMonth()+1,1);
const dateKey=n=>new Date(Date.UTC(tomorrow.getUTCFullYear(),tomorrow.getUTCMonth(),n)).toISOString().slice(0,10);
const configurations=[{id:'config-two',code:'2br',bedrooms:2,bathrooms:1,maximum_guests:4,minimum_nights:2,nightly_rate_eur:400},{id:'config-three',code:'3br',bedrooms:3,bathrooms:2,maximum_guests:6,minimum_nights:2,nightly_rate_eur:600}];
const user=()=>({id,aud:'authenticated',role:'authenticated',email:'test@example.invalid',email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:saved});
const token=()=>[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'local-test-signature'].join('.');
const mock=http.createServer(async(req,res)=>{res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');res.setHeader('Content-Type','application/json');if(req.method==='OPTIONS'){res.end();return;}let body='';for await(const b of req)body+=b;let data={};try{data=JSON.parse(body||'{}')}catch{}
const url=new URL(req.url,'http://local');if(process.env.DEBUG_PROJECT_FIXTURE)console.log(req.method,req.url);
if(url.pathname==='/auth/v1/token'){if(failLogin){res.statusCode=400;res.end(JSON.stringify({error:'invalid_grant',error_description:'Invalid login credentials'}));return;}res.end(JSON.stringify({access_token:token(),refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user:user()}));return;}
if(url.pathname==='/auth/v1/user'){if(req.method==='PUT'){updates.push(data);if(failSave){res.statusCode=500;res.end(JSON.stringify({msg:'Test failure'}));return;}saved={...saved,...data.data};}res.end(JSON.stringify(user()));return;}
if(url.pathname==='/auth/v1/logout'){res.end('{}');return;}
if(url.pathname==='/rest/v1/profiles'){res.end(JSON.stringify({id,role,is_active:active,full_name:'Preview Tester'}));return;}
if(url.pathname==='/rest/v1/mzs_member_contact_details'){res.end('{}');return;}
if(url.pathname==='/rest/v1/rpc/mzs_set_member_contact'){contactUpdates.push(data);res.end('true');return;}
if(url.pathname==='/rest/v1/rental_bookings'){res.end(JSON.stringify([{id:'22222222-2222-4222-8222-222222222222',project_id:'property-1',rental_configuration_id:null,check_in:'2027-03-21',check_out:'2027-03-25',guest_count:2,status:bookingStatus,is_test:false,quoted_total_eur:1200,created_at:'2026-10-23T10:00:00Z'}]));return;}
if(url.pathname==='/rest/v1/projects'){const slug=(url.searchParams.get('slug')||'eq.villa-la-nucia').slice(3);const project={id:projectId,title:slug,slug};res.end(JSON.stringify(url.searchParams.has('slug')?project:[project]));return;}
if(url.pathname==='/rest/v1/project_access'){res.end(JSON.stringify(grant?(url.searchParams.has('project_id')?{project_id:projectId}:[{project_id:projectId}]):null));return;}
if(url.pathname==='/rest/v1/offering_access'){res.end(JSON.stringify(offeringGrant?[{offering_id:'offer-rental'},{offering_id:'offer-investment'}]:[]));return;}
if(url.pathname==='/rest/v1/offerings'){res.end(JSON.stringify([{id:'offer-rental',offering_type:'rental'},{id:'offer-investment',offering_type:'investment'}]));return;}
if(url.pathname==='/rest/v1/project_content'){res.end(JSON.stringify([{id:'editorial-1',content:{heading:'Original editorial',body:'Owner-provided text remains original.'}}]));return;}
if(url.pathname==='/rest/v1/mzs_project_documents'){res.end(JSON.stringify([{id:'doc-1',title:'Original document title',description:'Original description',category:'permit',file_path:'test.pdf',mime_type:'application/pdf',file_size_bytes:1024}]));return;}
if(url.pathname==='/storage/v1/object/sign/mzs-private-project-documents/test.pdf'){assert.equal(data.expiresIn,60);res.end(JSON.stringify({signedURL:'/object/sign/mzs-private-project-documents/test.pdf?token=local-test-only'}));return;}
if(url.pathname==='/rest/v1/rpc/get_rental_calendar'||url.pathname==='/rest/v1/rpc/get_configured_rental_calendar'){assert.equal(data.p_project_id,projectId);if(calendarFailure){res.statusCode=403;res.end(JSON.stringify({message:'local denied'}));return;}const unavailable=[{check_in:dateKey(10),check_out:dateKey(13)}];res.end(JSON.stringify(url.pathname.endsWith('/get_rental_calendar')?{settings:{nightly_rate_eur:400,minimum_nights:2,maximum_guests:8,pool_heating_available:true,pool_heating_surcharge_eur:50},unavailable}:{configurations,unavailable}));return;}

if(url.pathname==='/rest/v1/rental_cancellation_requests'){res.end(JSON.stringify(cancellations));return;}
if(url.pathname==='/rest/v1/rpc/request_booking_cancellation'){cancellationCalls.push(data);cancellations=[{id:'33333333-3333-4333-8333-333333333333',booking_id:data.p_booking_id,reason:data.p_reason,status:'pending',created_at:'2026-10-23T10:00:00Z',reviewed_at:null}];res.end(JSON.stringify(cancellations[0].id));return;}
if(url.pathname==='/rest/v1/rpc/mzs_has_department_scope'){res.end('false');return;}
res.end('[]');});
(async()=>{await new Promise(r=>mock.listen(3091,'127.0.0.1',r));const server=spawn('npm',['run','dev','--','--hostname','127.0.0.1','--port','3090'],{cwd:process.cwd(),env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3091',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'local-test-key',VERCEL_ENV:'development'},stdio:['ignore',require('fs').openSync('/tmp/project-browser-server.log','w'),require('fs').openSync('/tmp/project-browser-server-errors.log','w')]});process.on('exit',()=>{server.kill();mock.close()});for(let n=0;n<120;n++){try{await fetch('http://127.0.0.1:3090/login');break;}catch{}await new Promise(r=>setTimeout(r,500));}
const browser=await chromium.launch({headless:true});const errors=[];
async function ctx(){const context=await browser.newContext();await context.route('**/api/capital-client-summary',r=>r.fulfill({status:200,contentType:'application/json',body:'{"items":[]}'}));const page=await context.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(90000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/MISSING_MESSAGE|FORMATTING_ERROR|IntlError/.test(m.text()))errors.push(m.text())});return {page,context};}
async function login(page,locale){await page.goto('http://127.0.0.1:3090'+(locale==='en'?'':('/'+locale))+'/login');await page.locator('input[name=email]').fill('test@example.invalid');await page.locator('input[name=password]').fill('local-only-test-password');await page.locator('button[type=submit]').click();}
let {page,context}=await ctx();const catalogs=Object.fromEntries(['en','nl','es'].map(l=>[l,require('../../messages/'+l+'.json').ProjectUI]));
const dateLabel=(l,n)=>new Intl.DateTimeFormat(l==='en'?'en-GB':l,{dateStyle:'long',timeZone:'UTC'}).format(new Date(dateKey(n)+'T12:00:00Z'));
let requests=[],submitFailure=false;
await context.route('**/api/rental/booking-request',async route=>{requests.push(route.request().postDataJSON());await route.fulfill({status:submitFailure?409:201,contentType:'application/json',body:JSON.stringify(submitFailure?{error:'English server error'}:{id:'local-request',message:'English success'})});});
await login(page,'en');await page.waitForURL('**/private',{waitUntil:'domcontentloaded'});
for(const locale of (process.env.PROJECT_TEST_LOCALE?[process.env.PROJECT_TEST_LOCALE]:['en','nl','es'])){
 saved={preferred_language:locale};const c=catalogs[locale];
 for(const slug of ['villa-la-nucia','marina-botafoch-apartment','villa-can-juan-ibiza','villa-des-coloms-ibiza','amsterdam-floraweg']){
  console.log('Checking',locale,slug);
  const response=await page.goto('http://127.0.0.1:3090/private/projects/'+slug,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200,slug);
  await page.getByText('Original editorial',{exact:true}).waitFor();await page.getByText('Original document title',{exact:true}).waitFor();assert.equal(await page.locator('html').getAttribute('lang'),locale);
  assert.ok((await page.locator('main').innerText()).toLowerCase().includes(c.documentCategories.permit.toLowerCase()));
  for(const width of [375,1440]){await page.setViewportSize({width,height:950});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth ? [...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(-12).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,90),right:e.getBoundingClientRect().right})) : []);assert.deepEqual(overflow,[],'overflow '+locale+' '+slug+' '+JSON.stringify(overflow));}
  if(slug==='villa-can-juan-ibiza'){
   await page.getByRole('heading',{name:c.p446,exact:true}).waitFor();const terms=await page.locator('dl').innerText();assert.match(terms,/1[,.]000[,.]000/);assert.match(terms,/10%/);assert.ok(terms.includes(c.loanTerm));
  }
  if(slug==='amsterdam-floraweg'){
   const href=await page.getByRole('link',{name:c.p069,exact:true}).getAttribute('href');assert.ok(decodeURIComponent(href).includes(c.investmentKind));assert.equal(await page.getByRole('link',{name:c.p074,exact:true}).count(),0,'no sale grant');
  }
  if(slug==='villa-la-nucia'||slug==='marina-botafoch-apartment'){
   const configured=slug.startsWith('marina');await page.getByRole('button',{name:c.nextMonth,exact:true}).click();
   const day=n=>page.getByRole('button',{name:dateLabel(locale,n),exact:true});
   const blocked=page.getByRole('button',{name:new RegExp('^'+dateLabel(locale,11))});assert.equal(await blocked.isDisabled(),true);
   await day(2).click();await day(3).click();await page.getByRole('status').waitFor();assert.ok((await page.getByRole('status').innerText()).includes('2'));
   await day(4).click();await page.getByRole('button',{name:c.p120,exact:true}).waitFor();
   if(!configured)await page.getByRole('checkbox').check();
   const price=new Intl.NumberFormat(locale==='en'?'en-GB':locale,{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(configured?800:900);assert.ok((await page.locator('main').innerText()).includes(price));
   await page.getByLabel(c.p118).fill('Local-only test');
   if(locale==='es'&&!configured){await page.setViewportSize({width:375,height:950});await page.getByRole('heading',{name:c.p162,exact:true}).last().locator('..').screenshot({path:'/tmp/project-calendar-es-375.png'});}
   if(locale==='es'){submitFailure=true;await page.getByRole('button',{name:c.p120,exact:true}).click();await page.getByText(c.p090,{exact:true}).waitFor();submitFailure=false;}
   const before=requests.length;await page.getByRole('button',{name:c.p120,exact:true}).click();await page.getByText(c.requestReceived,{exact:true}).waitFor();
   assert.equal(requests.length,before+1);assert.equal(await page.getByRole('button',{name:c.p120,exact:true}).count(),0);
   assert.deepEqual(requests.at(-1),configured?{mode:'configured',projectId,configurationId:'config-two',checkIn:dateKey(2),checkOut:dateKey(4),guests:2,arrival:'',departure:'',notes:'Local-only test'}:{mode:'villa',projectId,checkIn:dateKey(2),checkOut:dateKey(4),guests:2,arrival:'',departure:'',poolHeating:true,notes:'Local-only test'});
   // Existing overlap rule and shared calendar remain enforced.
   await day(8).click();await day(14).click();await page.getByText(configured?c.p087:c.p155,{exact:true}).waitFor();
   if(configured){await page.getByRole('button',{name:/^3 (BEDROOM|SLAAPKAMER|DORMITORIO)/}).click();assert.equal(await blocked.isDisabled(),true);}
   await page.getByRole('button',{name:c.p137,exact:true}).first().click();await page.getByRole('dialog').waitFor();await page.keyboard.press('ArrowRight');await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
  }
 }
 console.log('PASS '+locale+': five project presentations, financial terms, restricted offerings, calendars, minimum stay, overlap, totals, exact API payloads, localized responses, gallery and 375/1440px layouts');
}
saved={preferred_language:"es"};calendarFailure=true;await page.goto('http://127.0.0.1:3090/private/projects/villa-la-nucia');await page.getByText(catalogs.es.p086,{exact:true}).waitFor();calendarFailure=false;
for(const permission of ['project','offering']){if(permission==='project')grant=false;else offeringGrant=false;const r=await page.goto('http://127.0.0.1:3090/private/projects/villa-la-nucia');assert.equal(r.status(),404);assert.ok(!(await r.text()).includes(catalogs.es.p447),'denied response must not serialize loan narrative');assert.equal(await page.getByRole('heading',{name:'Villa La Nucia',exact:true}).count(),0);grant=true;offeringGrant=true;}
assert.deepEqual(errors,[]);console.log('PASS availability error and denied project/offering access fail closed; no browser errors; all requests local only');
await browser.close();server.kill();mock.close();process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
