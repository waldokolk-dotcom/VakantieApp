import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const server=spawn('python3',['-m','http.server','4174','--directory','whatsup-dog'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const USER_ID='11111111-1111-4111-8111-111111111111';

const fakeSupabase=`
window.__wdSharedWrites=[];window.__wdUploads=[];
window.supabase={createClient(){
  const from=(table)=>({
    upsert:async row=>{window.__wdSharedWrites.push({table,row});return {data:row,error:null}},
    select:()=>({eq:()=>({order:()=>({limit:async()=>({data:[],error:null})})})})
  });
  return {
    auth:{getSession:async()=>({data:{session:{user:{id:'${USER_ID}'}}},error:null}),signInAnonymously:async()=>({data:{session:{user:{id:'${USER_ID}'}}},error:null})},
    from,
    storage:{from:()=>({upload:async(path,blob,opts)=>{window.__wdUploads.push({path,size:blob.size,type:blob.type,opts});return {data:{path},error:null}},createSignedUrl:async path=>({data:{signedUrl:'https://signed.invalid/'+path},error:null})})},
    channel:()=>({on(){return this},subscribe(){return this}})
  };
}};
`;

try{
  await sleep(700);
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('**/backend-config.js*',route=>route.fulfill({contentType:'application/javascript',body:`window.WHATSUP_DOG_BACKEND={provider:'supabase',enabled:true,url:'https://fake.supabase.co',publishableKey:'sb_publishable_test_key_abcdefghijklmnopqrstuvwxyz1234567890',photoBucket:'report-photos',maxSharedReports:200,signedPhotoSeconds:3600};`}));
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',route=>route.fulfill({contentType:'application/javascript',body:fakeSupabase}));
  await page.addInitScript(()=>{
    localStorage.setItem('wd_profile_v1',JSON.stringify({name:'Sterre',avatar:'🐕',homePlace:'Nijkerk',homeLat:52.2182,homeLng:5.4835}));
    localStorage.removeItem('wd_reports_v1');
    localStorage.removeItem('wd_shared_report_queue_v1');
  });
  await page.goto('http://127.0.0.1:4174/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('profileStatus')?.textContent==='Community aan',{timeout:10000});
  await page.locator('[data-view="map"]').first().click();
  await page.locator('#reportFab').click();
  await page.locator('[data-report-type="vegetation"]').click();
  await page.locator('#smartReportToolsV2').waitFor({state:'visible'});
  const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#5b8c45"/><path d="M24 42V10M24 20L10 12M24 28L38 18" stroke="#fff" stroke-width="4"/></svg>');
  await page.locator('#reportPhotoV2').setInputFiles({name:'distel.svg',mimeType:'image/svg+xml',buffer:svg});
  await page.locator('#photoPreviewWrapV2.has-photo').waitFor({state:'visible'});
  await page.locator('[data-subtype="Distels"]').click();
  await page.locator('#reportText').fill('Distels langs het wandelpad');
  await page.locator('#publishReport').click();
  await page.waitForFunction(()=>window.__wdSharedWrites?.some(x=>x.table==='reports'),{timeout:10000});

  const result=await page.evaluate(()=>({writes:window.__wdSharedWrites,uploads:window.__wdUploads,reports:JSON.parse(localStorage.getItem('wd_reports_v1')||'[]'),queue:JSON.parse(localStorage.getItem('wd_shared_report_queue_v1')||'[]'),status:document.getElementById('profileStatus')?.textContent}));
  const write=result.writes.find(x=>x.table==='reports');
  if(!write)throw new Error('No shared report write');
  if(write.row.user_id!=='${USER_ID}')throw new Error('Wrong user ownership');
  if(write.row.type!=='vegetation'||write.row.subtype!=='Distels')throw new Error('Wrong report classification');
  if(write.row.status!=='active')throw new Error('Report not active');
  if(!write.row.photo_path?.startsWith('${USER_ID}/'))throw new Error('Photo path not scoped to user');
  if(result.uploads.length!==1||result.uploads[0].type!=='image/jpeg')throw new Error('Photo was not re-encoded/uploaded as JPEG');
  if(result.queue.length!==0)throw new Error('Shared queue not cleared after successful sync');
  if(result.status!=='Community aan')throw new Error('Community status not connected');
  if(!result.reports.some(r=>r.id===write.row.id&&r._remote===true))throw new Error('Local report not marked synced');
  console.log('Whatsup dog shared community smoke PASS');
  await browser.close();
} finally {
  server.kill('SIGTERM');
}
