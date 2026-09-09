import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const server=spawn('python3',['-m','http.server','4173','--directory','whatsup-dog'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
  await sleep(900);
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.addInitScript(()=>{
    localStorage.setItem('wd_profile_v1',JSON.stringify({name:'Sterre',avatar:'🐕',homePlace:'Nijkerk',homeLat:52.2182,homeLng:5.4835}));
    localStorage.removeItem('wd_reports_v1');
  });
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  await page.locator('[data-view="map"]').first().click();
  await page.locator('#reportFab').click();
  await page.locator('[data-report-type="vegetation"]').click();
  await page.locator('#smartReportToolsV2').waitFor({state:'visible',timeout:10000});

  for(const sel of ['#reportCameraV2','#reportPhotoV2','#recognizePhotoV2','#geometryPointV2','#geometryAreaV2','#pickOnMapV2']){
    if(await page.locator(sel).count()!==1) throw new Error(`Missing ${sel}`);
  }

  // A tiny valid PNG verifies that file selection, canvas re-encoding and preview work.
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAQAAABFaP0WAAAADUlEQVR42mNk+M/wHwAF/gL+4T2V5QAAAABJRU5ErkJggg==','base64');
  await page.locator('#reportPhotoV2').setInputFiles({name:'plant.png',mimeType:'image/png',buffer:png});
  await page.locator('#photoPreviewWrapV2.has-photo').waitFor({state:'visible'});
  if(await page.locator('#recognizePhotoV2').isDisabled()) throw new Error('Recognize button should be enabled after photo');

  // Exact point selection round-trip.
  await page.locator('#geometryPointV2').click();
  await page.locator('#pickOnMapV2').click();
  await page.locator('#map').click({position:{x:205,y:360}});
  await page.locator('#reportDialog[open]').waitFor({state:'visible'});
  const pointStatus=await page.locator('#drawStatusV2').innerText();
  if(!pointStatus.includes('Exacte plek')) throw new Error(`Point selection failed: ${pointStatus}`);

  // Area drawing round-trip and persisted polygon.
  await page.locator('#geometryAreaV2').click();
  await page.locator('#pickOnMapV2').click();
  const mapBox=page.locator('#map');
  await mapBox.click({position:{x:130,y:310}});
  await mapBox.click({position:{x:255,y:315}});
  await mapBox.click({position:{x:225,y:430}});
  await page.locator('.draw-done').click();
  await page.locator('#reportDialog[open]').waitFor({state:'visible'});
  await page.locator('[data-subtype="Distels"]').click();
  await page.locator('#reportText').fill('Distels langs het wandelpad');
  await page.locator('#publishReport').click();
  await page.waitForTimeout(150);
  const reports=await page.evaluate(()=>JSON.parse(localStorage.getItem('wd_reports_v1')||'[]'));
  if(reports.length!==1) throw new Error(`Expected 1 report, got ${reports.length}`);
  if(reports[0].geometryType!=='polygon'||!Array.isArray(reports[0].polygon)||reports[0].polygon.length<3) throw new Error('Polygon report was not persisted');
  if(!reports[0].photoDataUrl?.startsWith('data:image/jpeg')) throw new Error('Re-encoded photo was not persisted');
  if(reports[0].photoPrivacy!=='canvas-reencoded-no-original-exif') throw new Error('Photo privacy marker missing');

  // Close button remains a true close control.
  await page.locator('#reportFab').click();
  await page.locator('#reportDialog [data-close-dialog]').click();
  if(await page.locator('#reportDialog').evaluate(d=>d.open)) throw new Error('Report dialog close button did not close');

  console.log('Whatsup dog mobile reporting smoke PASS');
  await browser.close();
} finally {
  server.kill('SIGTERM');
}
