// Isolated local auth fixture. Never creates real users, sends mail or writes live data.
const {chromium}=require(process.env.MZS_PLAYWRIGHT_MODULE || 'playwright');
const http=require('node:http'), assert=require('node:assert/strict'), {spawn}=require('node:child_process');
let active=true,role='client';
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'ru-test@example.invalid',user_metadata:{preferred_language:'ru'}};
const token=()=>[Buffer.from('{"alg":"HS256"}').toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fixture'].join('.');
const mock=http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');res.setHeader('Content-Type','application/json');
 if(req.method==='OPTIONS'){res.end();return;}
 for await(const chunk of req){};
 if(req.url.startsWith('/auth/v1/token'))return res.end(JSON.stringify({access_token:token(),refresh_token:'fixture',expires_in:3600,token_type:'bearer',user}));
 if(req.url.startsWith('/auth/v1/user'))return res.end(JSON.stringify(user));
 if(req.url.startsWith('/auth/v1/logout'))return res.end('{}');
 if(req.url.startsWith('/rest/v1/profiles'))return res.end(JSON.stringify({id:user.id,role,is_active:active,full_name:'Russian Fixture'}));
 if(req.url.includes('/rpc/'))return res.end('false');
 res.end('[]');
});
(async()=>{
 let server,browser;
 try {
 await new Promise(r=>mock.listen(3091,'127.0.0.1',r));
 server=spawn('npm',['run','dev','--','--hostname','127.0.0.1','--port','3090'],{env:{...process.env,VERCEL_ENV:'development',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3091',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'local-fixture'},stdio:'ignore'});
 for(let i=0;i<120;i++){try{await fetch('http://localhost:3090/ru');break}catch{}await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({headless:true, ...(process.env.MZS_CHROMIUM_PATH ? {executablePath:process.env.MZS_CHROMIUM_PATH} : {})});
 const context=await browser.newContext();const page=await context.newPage();page.setDefaultTimeout(30000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/MISSING_MESSAGE|FORMATTING_ERROR|IntlError/.test(m.text()))errors.push(m.text());});
 const base='http://localhost:3090';
 for(const path of ['/ru','/ru/real-estate','/ru/private-capital','/ru/login']){
  await page.goto(base+path);await page.locator('h1').waitFor();assert.equal(await page.locator('html').getAttribute('lang'),'ru');
  for(const width of [375,768,1440]) {await page.setViewportSize({width,height:950});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+path+' '+width);}
  if(path!='/ru/login'){assert.match(await page.title(),/[А-Яа-я]/);assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),'https://www.mzsgroup.com'+path);}
 }
 await page.goto(base+'/ru/private-capital?campaign=test#securities');
 await page.locator('summary[aria-label="Выбрать язык"]').click();await page.getByRole('link',{name:'Español',exact:true}).click();
 await page.waitForURL('**/es/private-capital?campaign=test#securities');
 await page.locator('summary[aria-label="Elegir idioma"]').count().then(async n=>{if(n)await page.locator('summary[aria-label="Elegir idioma"]').click();else await page.locator('details summary').first().click()});
 await page.getByRole('link',{name:'Русский',exact:true}).click();await page.waitForURL('**/ru/private-capital?campaign=test#securities');
 for(const path of ['/request-access','/registration-pending','/forgot-password','/reset-password','/accept-invitation']) {
  await page.goto(base+path+'?fixture=1#preserved');assert.equal(await page.locator('html').getAttribute('lang'),'ru');
  assert.equal(new URL(page.url()).pathname,path);assert.equal(new URL(page.url()).hash,'#preserved');
  for(const width of [375,1440]){await page.setViewportSize({width,height:950});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+path);}
 }
 let payload;
 await context.route('**/api/intro-calls',async route=>{payload=route.request().postDataJSON();await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({recorded:true,id:'fixture-reference'})});});
 await page.goto(base+'/ru/real-estate');await page.locator('#intro-name').fill('Анна Иванова');await page.locator('#intro-email').fill('ru-test@example.invalid');await page.locator('#intro-message').fill('Интересует аренда недвижимости.');
 await page.locator('form button[type="submit"]').click();await page.getByText('fixture-reference',{exact:false}).waitFor();assert.equal(payload.name,'Анна Иванова');assert.equal(payload.source,'real-estate');
 await page.goto(base+'/ru/login');await page.locator('input[type="email"]').fill('ru-test@example.invalid');await page.locator('input[type="password"]').fill('fixture-password');active=false;
 await page.locator('button[type="submit"]').click();await page.getByText('Ваш аккаунт сейчас неактивен. Свяжитесь с MZS Group.').waitFor();
 active=true;await page.locator('button[type="submit"]').click();await page.waitForURL('**/private');assert.equal(await page.locator('html').getAttribute('lang'),'ru');
 assert.equal(await page.getByRole('link',{name:'Русский',exact:true}).count(),1);
 for(const path of ['/ru/private','/ru/admin','/ru/reset-password']){const response=await page.goto(base+path);assert.equal(response.status(),404,path);}
 await page.goto(base+'/ru/real-estate');await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/tmp/mzs-ru-desktop.png',fullPage:true});
 await page.goto(base+'/ru/login');await page.setViewportSize({width:375,height:950});await page.screenshot({path:'/tmp/mzs-ru-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS Russian public pages, widths 375/768/1440, SEO, query/hash, neutral token routes, Cyrillic form fixture, inactive denial, Russian private area, blocked aliases');
 } finally {if(browser)await browser.close();if(server)server.kill();mock.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
