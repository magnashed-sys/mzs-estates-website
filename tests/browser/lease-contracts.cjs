// Local browser fixture; all auth, database and document calls stay in memory.
const http=require('node:http'),assert=require('node:assert/strict');
const browserName=process.env.MZS_BROWSER||'chromium';
const browserType=require(process.env.MZS_PLAYWRIGHT_MODULE||'playwright')[browserName];
const next=require('next');
const id='11111111-1111-4111-8111-111111111111',pid='22222222-2222-4222-8222-222222222222',uid='33333333-3333-4333-8333-333333333333',cid='44444444-4444-4444-8444-444444444444';
let role='admin',active=true,contracts=[],invoices=[],relationships=[],issuers=[],issued=[],payments=[];
const user={id,aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
const token=[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fixture'].join('.');
const properties=[{id:pid,name:'Fixture residence',owner_name:'Fixture landlord',address:'Fixture Street 1'}];
const units=[{id:uid,property_id:pid,address:'Fixture Street 1A',tenant_name:'Fixture tenant',monthly_rent:1000,utilities_advance:null,rent_included:false}];
const mock=http.createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');let body='';for await(const chunk of req)body+=chunk;const payload=body?JSON.parse(body):{};const u=new URL(req.url,'http://local');let data=[];
 if(u.pathname==='/auth/v1/user')data=user;
 else if(u.pathname==='/rest/v1/profiles')data=u.searchParams.has('id')?{id,role,is_active:active}:[{id,full_name:'Fixture relationship',email:user.email}];
 else if(u.pathname==='/rest/v1/mzs_estate_properties')data=properties;
 else if(u.pathname==='/rest/v1/mzs_estate_units')data=units;
 else if(u.pathname==='/rest/v1/mzs_lease_issuers'){
  if(req.method==='POST'){issuers.push({...payload,id:'77777777-7777-4777-8777-777777777777',version:1,next_number:1});data={id:issuers[0].id};}else data=issuers;
 }
 else if(u.pathname==='/rest/v1/mzs_lease_invoices')data=u.searchParams.has('id')?issued[0]:issued;
 else if(u.pathname==='/rest/v1/mzs_lease_payments')data=payments;
 else if(u.pathname==='/rest/v1/rpc/mzs_issue_lease_invoice'){if(!issued.length)issued.push({id:'88888888-8888-4888-8888-888888888888',draft_id:invoices[0].id,contract_id:cid,number:'TEST-000001',issued_on:'2026-11-14',due_date:'2026-11-30',total:invoices[0].total,payload:invoices[0],delivery_status:'unsent'});data=issued[0].id;}
 else if(u.pathname==='/rest/v1/rpc/mzs_record_lease_payment'){payments.push({id:payload.p_id,invoice_id:payload.p_invoice,amount:Number(payload.p_amount),received_on:payload.p_date,reference:payload.p_reference,reversed_at:null});data=payload.p_id;}
 else if(u.pathname==='/rest/v1/rpc/mzs_reverse_lease_payment'){payments=payments.map(p=>({...p,reversed_at:new Date().toISOString(),reversal_reason:payload.p_reason}));data=null;}
 else if(u.pathname==='/rest/v1/rpc/mzs_claim_lease_invoice_mail'){issued[0].delivery_status='sending';data='99999999-9999-4999-8999-999999999999';}
 else if(u.pathname==='/rest/v1/rpc/mzs_finish_lease_invoice_mail'){issued[0].delivery_status=payload.p_status;data=true;}
 else if(u.pathname==='/rest/v1/mzs_lease_relationships'){
  if(req.method==='POST'){const r={...payload,id:'66666666-6666-4666-8666-666666666666',version:1};relationships.push(r);data={id:r.id};}else data=relationships;
 }
 else if(u.pathname==='/rest/v1/mzs_lease_contracts'){
  if(req.method==='POST'){contracts.push({...payload,id:cid,version:1,status:'draft',created_at:new Date().toISOString()});data={id:cid};}
  else if(req.method==='PATCH'){contracts=contracts.map(c=>({...c,...payload,version:c.version+1}));data={id:cid};}
  else data=u.searchParams.has('id')?contracts[0]:contracts;
 }
 else if(u.pathname==='/rest/v1/mzs_lease_invoice_drafts'){
  if(req.method==='PATCH'){invoices=invoices.map(i=>({...i,...payload}));data={id:invoices[0].id};}else data=invoices;
 }
 else if(u.pathname==='/rest/v1/rpc/mzs_generate_lease_drafts'){
  data=invoices.length?0:1;
  if(!invoices.length){const c=contracts[0];invoices.push({id:'55555555-5555-4555-8555-555555555555',contract_id:c.id,period_start:'2026-12-01',period_end:'2026-12-31',scheduled_date:'2026-11-14',due_date:'2026-11-30',subject:'Huur Fixture Street 1A — december 2026',snapshot:{...c,unit_addresses:'Fixture Street 1A',covered_from:'2026-12-01',covered_to:'2026-12-31'},lines:[{description:'Huur',amount:'1000.00',vat:'exempt',net:1000,tax:0,total:1000}],subtotal:1000,tax_total:0,total:1000,review_status:'pending',review_note:''});}
 }
 else if(u.pathname==='/rest/v1/rpc/mzs_has_department_scope')data=false;
 res.end(JSON.stringify(data));
});
(async()=>{
 await new Promise(r=>mock.listen(3091,'127.0.0.1',r));
 const original=global.fetch;global.fetch=(input,init)=>{const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;if(url.startsWith('https://senonkpxdtlhyhrubicg.supabase.co'))return original(url.replace('https://senonkpxdtlhyhrubicg.supabase.co','http://127.0.0.1:3091'),init);return original(input,init)};
 process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';process.env.VERCEL_ENV='preview';process.env.NEXT_PUBLIC_SUPABASE_URL='https://senonkpxdtlhyhrubicg.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='fixture-public-key';
 const app=next({dev:false,hostname:'127.0.0.1',port:3096});await app.prepare();const server=http.createServer(app.getRequestHandler());await new Promise(r=>server.listen(3096,'127.0.0.1',r));
 const browser=await browserType.launch({headless:true});const ctx=await browser.newContext();const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await ctx.addCookies([{name:'sb-senonkpxdtlhyhrubicg-auth-token',value:'base64-'+Buffer.from(JSON.stringify({access_token:token,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})).toString('base64url'),domain:'127.0.0.1',path:'/'}]);
 await page.goto('http://127.0.0.1:3096/admin/group/estates/contracts');
 await page.getByRole('heading',{name:'Contracts & invoices.'}).waitFor();
 await page.getByRole('button',{name:'Rental relationships',exact:true}).click();
 await page.getByRole('button',{name:'New rental relationship',exact:true}).click();
 await page.getByLabel('Legal name / person').fill('Fixture tenant company');
 await page.getByRole('button',{name:'Save rental relationship',exact:true}).click();
 await page.getByRole('button',{name:'Fixture tenant company',exact:true}).waitFor();
 assert.equal(relationships.length,1);assert.equal(relationships[0].address,'','only name/type required for offline relationship');
 await page.getByRole('button',{name:'Issuing entities',exact:true}).click();
 await page.getByRole('button',{name:'New issuing entity',exact:true}).click();
 await page.getByLabel('Legal name',{exact:true}).fill('Fixture issuer');
 await page.getByLabel('Billing address',{exact:true}).fill('Fixture issuer address');
 await page.getByLabel('IBAN',{exact:true}).fill('NLTESTACCOUNT');
 await page.getByLabel('Unique invoice prefix').fill('TEST');
 await page.getByRole('button',{name:'Save issuing entity',exact:true}).click();
 await page.getByRole('button',{name:'Fixture issuer',exact:true}).waitFor();
 assert.equal(issuers.length,1);
 await page.getByRole('button',{name:'Contracts',exact:true}).click();
 await page.getByRole('button',{name:'New contract',exact:true}).click();
 await page.getByLabel('Rental relationship (optional)').selectOption(relationships[0].id);
 assert.equal(await page.getByLabel('Tenant / legal company name').inputValue(),'Fixture tenant company');
 await page.getByLabel('Contract subject',{exact:true}).fill('Fixture long-term rental');
 // Unsupported month pickers (desktop Safari/Firefox) expose partial text while typing.
 const month=page.getByLabel('First invoice month in MZS');
 console.log(browserName+' native month input type: '+await month.evaluate(el=>el.type));
 // React restores the declared type on render; reapply the unsupported-browser fallback for each edit.
 const fillMonth=async value=>{await month.evaluate(el=>{el.type='text'});await month.fill(value);};
 for(const value of ['2','20','2026-','2026-1','2026-13','11/2026','']){
  await fillMonth(value);
  await page.waitForTimeout(50);
  assert.deepEqual(errors,[],`month input ${JSON.stringify(value)} must not crash`);
  assert.equal(await month.evaluate(el=>el.checkValidity()),false,'incomplete month cannot be submitted');
  assert.equal(await page.getByLabel('Contract subject',{exact:true}).inputValue(),'Fixture long-term rental');
 }
 await page.locator('form select').filter({has:page.locator('option[value="'+pid+'"]')}).selectOption(pid);
 await page.getByLabel(/Fixture Street 1A/).check();
 await page.getByRole('button',{name:'Suggest amounts from selected units'}).click();
 assert.equal(await page.getByLabel('Monthly amount',{exact:true}).nth(1).inputValue(),'','unknown advance stays empty');
 await page.getByRole('button',{name:'Remove line 2'}).click();
 await page.getByLabel('Tenant billing address').fill('Fixture tenant address');
 await page.getByLabel('Registered issuing entity').selectOption(issuers[0].id);
 assert.equal(await page.getByLabel('Issuer billing address').inputValue(),'Fixture issuer address');
 assert.equal(await page.getByLabel('Issuer IBAN').inputValue(),'NLTESTACCOUNT');
 await page.getByLabel('Tenant email',{exact:true}).fill('fixture@example.invalid');
 await page.getByLabel('Lease start',{exact:true}).fill('2024-01-01');

 await fillMonth('2026-1');
 await page.getByRole('button',{name:'Save contract draft',exact:true}).click();
 assert.equal(contracts.length,0,'invalid period never reaches save');
 assert.equal(await page.getByLabel('Tenant billing address').inputValue(),'Fixture tenant address');
 await fillMonth('2026-12');
 assert.equal(await page.getByLabel('First draft preparation date').inputValue(),'2026-11-14');
 assert.equal(await month.evaluate(el=>el.checkValidity()),true,'correcting the month removes validation error');
 await page.getByText('Huur Fixture Street 1A — december 2026',{exact:true}).waitFor();
 for(const width of [375,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/tmp/mzs-contract-form-'+width+'.png',fullPage:true});}
 await page.getByRole('button',{name:'Save contract draft',exact:true}).click();
 await page.getByRole('button',{name:'Activate schedule',exact:true}).waitFor();
 assert.equal(contracts[0].first_period,'2026-12-01');assert.equal(contracts[0].lease_start,'2024-01-01');assert.deepEqual(contracts[0].unit_ids,[uid]);
 await page.getByRole('button',{name:'Activate schedule',exact:true}).click();
 await page.getByRole('button',{name:'Stop billing schedule',exact:true}).waitFor();
 await page.getByRole('button',{name:'Invoice drafts',exact:true}).click();
 await page.getByRole('button',{name:'Prepare due drafts now',exact:true}).click();
 await page.getByRole('button',{name:'Huur Fixture Street 1A — december 2026',exact:true}).click();
 await page.getByRole('button',{name:'Mark checked',exact:true}).click();
 await page.getByText('checked',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Prepare due drafts now',exact:true}).click();
 await page.getByText(/0 new invoice draft/).waitFor();assert.equal(invoices.length,1);
 await page.getByRole('button',{name:'Approve & issue invoice',exact:true}).click();
 await page.getByText(/Issued as TEST-000001/).waitFor();assert.equal(issued.length,1);
 await page.getByRole('button',{name:'Invoices & cashflow',exact:true}).click();
 await page.getByRole('button',{name:'TEST-000001',exact:true}).click();
 await page.getByRole('button',{name:'Send approved invoice',exact:true}).click();
 await page.getByText(/Delivery result: captured/).waitFor();assert.equal(issued[0].delivery_status,'captured');
 await page.getByLabel('Amount received',{exact:true}).fill('100');
 await page.getByLabel('Bank reference',{exact:true}).fill('Fixture transfer');
 await page.getByRole('button',{name:'Record payment',exact:true}).click();
 await page.getByText(/Fixture transfer/).waitFor();assert.equal(payments.length,1);
 for(const width of [375,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/tmp/mzs-integration-billing-'+width+'.png',fullPage:true});}
 await page.goto('http://127.0.0.1:3096/admin/group/estates/contracts?view=relationships');
 await page.getByRole('button',{name:'New rental relationship',exact:true}).waitFor();
 await page.reload();await page.getByRole('button',{name:'New rental relationship',exact:true}).waitFor();

 for(const [r,a] of [['client',true],['admin',false]]){role=r;active=a;await page.goto('http://127.0.0.1:3096/admin/group/estates/contracts');assert.ok(!(await page.locator('body').innerText()).includes('Fixture long-term rental'));}
 await ctx.clearCookies();await page.goto('http://127.0.0.1:3096/admin/group/estates/contracts');assert.ok(!(await page.locator('body').innerText()).includes('Fixture long-term rental'));
 assert.deepEqual(errors,[]);await browser.close();await new Promise(r=>server.close(r));await app.close();mock.close();console.log('PASS browser: relationship + issuer → contract → activation → draft → review → issue → captured PDF email → partial receipt; repeat guards; deep-link reload; mobile/desktop; signed-out/client/inactive denied');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
