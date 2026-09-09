(()=>{
  const S={photo:null,photoName:null,ai:null,geometryMode:'point',point:null,polygon:null,draftPoints:[],draftLayer:null,savedLayer:null,toolbar:null,drawingMode:null,model:null,modelLoading:null};
  const $=id=>document.getElementById(id);
  const dialog=()=>$('reportDialog');

  function injectStyles(){
    if(document.getElementById('wd-smart-v2-style'))return;
    const s=document.createElement('style');s.id='wd-smart-v2-style';s.textContent=`
      .smart-step-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:3px 0 11px}.smart-step-head b{font-size:14px}.smart-step-head button{border:0;background:#f3ead6;color:#3b2418;border-radius:999px;padding:7px 10px;font-size:10px;font-weight:900}
      .selected-report-summary{display:flex;align-items:center;gap:10px;background:#fff4d7;border:1.5px solid #f7aa2b;border-radius:16px;padding:10px 12px;margin-bottom:11px}.selected-report-summary span{font-size:26px}.selected-report-summary b{display:block;font-size:13px}.selected-report-summary small{display:block;color:#71655c;margin-top:2px}
      .pick-map-btn{width:100%;border:1px solid rgba(59,36,24,.12);border-radius:14px;background:#eef4e7;color:#3b2418;padding:11px;font-weight:900;margin-top:8px}
      .smart-location-ok{color:#2f7a2d;font-weight:900}.smart-location-warn{color:#8a5a17}
      .draw-toolbar{grid-template-columns:1fr auto auto auto!important}.draw-toolbar .draw-center{background:#e8f3ff;color:#076aaf}.point-pick-marker{filter:drop-shadow(0 3px 5px rgba(0,0,0,.25))}
      .report-details.smart-visible{padding-top:4px}
      @media(max-width:480px){.report-details.smart-visible{scroll-margin-top:18px}.smart-step-head{position:sticky;top:0;z-index:4;background:#fbf5e8;padding:6px 0}.draw-toolbar{grid-template-columns:1fr 1fr!important}.draw-toolbar b{grid-column:1/-1}.draw-toolbar button{min-height:42px}}
    `;document.head.appendChild(s);
  }

  function typeMeta(){return reportTypes.find(t=>t.id===selectedReportType)||reportTypes[0]}
  function updateSummary(){
    const box=$('selectedReportSummary');if(!box)return;const t=typeMeta();
    box.innerHTML=`<span>${t.icon}</span><div><b>${escapeHTML(t.label)}</b><small>${selectedReportType==='vegetation'?'Kies hieronder welk soort vegetatie je ziet.':'Voeg eventueel een foto toe en bepaal de plek.'}</small></div>`;
  }

  function injectUI(){
    const details=$('reportDetails');if(!details||$('smartReportToolsV2'))return;
    details.classList.add('smart-visible');
    const head=document.createElement('div');head.className='smart-step-head';head.innerHTML='<b>Stap 2 · Vertel wat meer</b><button id="changeReportType" type="button">← andere categorie</button>';
    details.insertBefore(head,details.firstChild);
    const summary=document.createElement('div');summary.id='selectedReportSummary';summary.className='selected-report-summary';details.insertBefore(summary,head.nextSibling);
    const wrap=document.createElement('div');wrap.id='smartReportToolsV2';wrap.className='smart-report-tools';wrap.innerHTML=`
      <section class="smart-block">
        <div class="smart-block-title"><b>📷 Foto toevoegen</b><small>optioneel</small></div>
        <div class="photo-actions">
          <label class="photo-btn">📸 Maak foto<input id="reportCameraV2" type="file" accept="image/*" capture="environment"></label>
          <label class="photo-btn">🖼️ Kies foto<input id="reportPhotoV2" type="file" accept="image/*"></label>
        </div>
        <div id="photoPreviewWrapV2" class="photo-preview-wrap"><img id="photoPreviewV2" alt="Voorbeeld van de melding"><button id="removePhotoV2" class="remove-photo" type="button" aria-label="Foto verwijderen">×</button></div>
        <button id="recognizePhotoV2" class="ai-photo-btn" type="button" disabled>✨ Herken wat erop staat</button>
        <div id="aiResultV2" class="ai-result" aria-live="polite"></div>
        <p class="photo-privacy">🔒 We bouwen de foto opnieuw op voor opslag. De oorspronkelijke EXIF/GPS-metadata wordt niet bewaard.</p>
      </section>
      <section class="smart-block">
        <div class="smart-block-title"><b>📍 Waar is het?</b><small>punt of gebied</small></div>
        <div class="geometry-actions">
          <button id="geometryPointV2" type="button" class="geometry-btn active">📍 Eén plek</button>
          <button id="geometryAreaV2" type="button" class="geometry-btn">✏️ Een gebied</button>
        </div>
        <button id="pickOnMapV2" type="button" class="pick-map-btn">📍 Kies de exacte plek op de kaart</button>
        <div id="drawStatusV2" class="draw-status">Nog geen specifieke plek gekozen. Zonder keuze gebruiken we het midden van de kaart.</div>
      </section>`;
    details.insertBefore(wrap,summary.nextSibling);

    ['reportCameraV2','reportPhotoV2'].forEach(id=>$(id)?.addEventListener('change',onPhotoPicked));
    $('removePhotoV2')?.addEventListener('click',clearPhoto);
    $('recognizePhotoV2')?.addEventListener('click',recognizePhoto);
    $('geometryPointV2')?.addEventListener('click',()=>setGeometryMode('point'));
    $('geometryAreaV2')?.addEventListener('click',()=>setGeometryMode('area'));
    $('pickOnMapV2')?.addEventListener('click',()=>S.geometryMode==='area'?startAreaDrawing():startPointPicking());
    $('changeReportType')?.addEventListener('click',()=>{const grid=$('reportTypes');grid?.scrollIntoView({behavior:'smooth',block:'start'})});
  }

  function ensureSubtype(label){
    const grid=$('vegetationKinds');if(!grid)return null;
    let b=[...grid.querySelectorAll('[data-subtype]')].find(x=>x.dataset.subtype===label);
    if(!b){b=document.createElement('button');b.type='button';b.className='subtype';b.dataset.subtype=label;b.textContent=label;grid.appendChild(b);b.addEventListener('click',()=>{selectedVegetation=label;grid.querySelectorAll('.subtype').forEach(x=>x.classList.toggle('selected',x===b))})}
    return b;
  }

  async function fileToCleanDataUrl(file){
    if(!file||!file.type.startsWith('image/'))throw new Error('not-image');
    if(file.size>15*1024*1024)throw new Error('too-large');
    const src=URL.createObjectURL(file);
    try{
      const img=new Image();img.decoding='async';await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=src});
      const max=900,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
      const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
      const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
      let q=.76,data=c.toDataURL('image/jpeg',q);while(data.length>350000&&q>.42){q-=.08;data=c.toDataURL('image/jpeg',q)}return data;
    }finally{URL.revokeObjectURL(src)}
  }
  async function onPhotoPicked(e){
    const file=e.target.files?.[0];if(!file)return;
    try{toast('Foto veilig voorbereiden…');S.photo=await fileToCleanDataUrl(file);S.photoName=file.name||'foto.jpg';S.ai=null;$('photoPreviewV2').src=S.photo;$('photoPreviewWrapV2').classList.add('has-photo');$('recognizePhotoV2').disabled=false;$('aiResultV2').classList.remove('show');$('aiResultV2').innerHTML='';toast('📷 Foto toegevoegd')}
    catch(err){console.warn(err);toast(err.message==='too-large'?'Foto is te groot. Kies maximaal 15 MB.':'Deze foto kon niet worden gelezen.')}
    finally{e.target.value=''}
  }
  function clearPhoto(){S.photo=null;S.photoName=null;S.ai=null;$('photoPreviewV2')?.removeAttribute('src');$('photoPreviewWrapV2')?.classList.remove('has-photo');if($('recognizePhotoV2'))$('recognizePhotoV2').disabled=true;if($('aiResultV2')){$('aiResultV2').classList.remove('show');$('aiResultV2').innerHTML=''}}

  function loadScript(src,test){if(test())return Promise.resolve();return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=()=>test()?res():rej(new Error('load-failed'));s.onerror=()=>rej(new Error('load-failed'));document.head.appendChild(s)})}
  async function loadModel(){
    if(S.model)return S.model;if(S.modelLoading)return S.modelLoading;
    S.modelLoading=(async()=>{await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js',()=>typeof window.tf!=='undefined');await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js',()=>typeof window.mobilenet!=='undefined');S.model=await window.mobilenet.load({version:2,alpha:.5});return S.model})();
    try{return await S.modelLoading}finally{S.modelLoading=null}
  }
  function mapPredictions(preds){
    const text=preds.map(p=>String(p.className).toLowerCase()).join(' | ');
    if(/thistle|cardoon/.test(text))return{label:'Mogelijk distelachtige plant',subtype:'Distels',kind:'vegetation'};
    if(/mushroom|agaric|bolete|stinkhorn|fungus/.test(text))return{label:'Mogelijk paddenstoel',subtype:'Anders',kind:'vegetation'};
    if(/grass|hay|reed|corn|rapeseed|flower|daisy|sunflower/.test(text))return{label:'Mogelijk vegetatie of plant',subtype:null,kind:'vegetation'};
    if(/dog|retriever|terrier|spaniel|poodle|shepherd/.test(text))return{label:'Mogelijk hond op de foto',subtype:null,kind:'spotted'};
    return{label:'Niet betrouwbaar genoeg herkend',subtype:null,kind:null};
  }
  async function recognizePhoto(){
    if(!S.photo)return;const btn=$('recognizePhotoV2'),out=$('aiResultV2');btn.disabled=true;btn.textContent='✨ Even snuffelen…';out.classList.add('show');out.innerHTML='<b>Beeldmodel laden…</b><span class="ai-confidence">De foto blijft op dit toestel.</span>';
    try{
      const model=await loadModel(),preds=await model.classify($('photoPreviewV2'),3),mapped=mapPredictions(preds),best=preds[0]||{probability:0,className:'onbekend'};
      S.ai={label:mapped.label,confidence:Number(best.probability)||0,raw:preds.map(p=>({label:p.className,confidence:p.probability})),model:'MobileNet v2 on-device'};
      if(mapped.kind){selectedReportType=mapped.kind;document.querySelectorAll('.report-type').forEach(x=>x.classList.toggle('selected',x.dataset.reportType===mapped.kind));$('vegetationKinds')?.classList.toggle('hidden',mapped.kind!=='vegetation');updateSummary()}
      if(mapped.subtype){const b=ensureSubtype(mapped.subtype);selectedVegetation=mapped.subtype;document.querySelectorAll('.subtype').forEach(x=>x.classList.toggle('selected',x===b))}
      out.innerHTML=`<b>✨ ${escapeHTML(mapped.label)}</b><span class="ai-confidence">Suggestie ${Math.round((Number(best.probability)||0)*100)}% · ${escapeHTML(best.className||'')}</span><span class="ai-warning">Bevestig dit zelf. De herkenning zegt niet dat een plant veilig of giftig is.</span>`;
    }catch(err){console.warn(err);S.ai=null;out.innerHTML='<b>Herkenning lukte niet.</b><span class="ai-confidence">Je kunt de foto nog steeds gewoon melden.</span>'}
    finally{btn.disabled=false;btn.textContent='✨ Opnieuw herkennen'}
  }

  function ensureDraftLayer(){if(!S.draftLayer&&map)S.draftLayer=L.featureGroup().addTo(map);return S.draftLayer}
  function clearToolbar(){if(map&&S.drawingMode)map.off('click',onMapClick);S.drawingMode=null;S.toolbar?.remove();S.toolbar=null}
  function clearDraft(){ensureDraftLayer()?.clearLayers();S.draftPoints=[]}
  function reopenReport(){clearToolbar();if(!dialog()?.open)dialog()?.showModal();setTimeout(()=>$('smartReportToolsV2')?.scrollIntoView({behavior:'smooth',block:'start'}),80)}
  function makeToolbar(title,area=false){
    clearToolbar();const bar=document.createElement('div');bar.className='draw-toolbar';bar.innerHTML=`<b>${title}</b>${area?'<button type="button" class="draw-undo">↶ Terug</button><button type="button" class="draw-center">◎ Midden</button>':''}<button type="button" class="draw-cancel">× Stop</button>${area?'<button type="button" class="draw-done">✓ Klaar</button>':''}`;document.getElementById('view-map')?.appendChild(bar);S.toolbar=bar;bar.querySelector('.draw-cancel').onclick=()=>{clearDraft();reopenReport()};if(area){bar.querySelector('.draw-undo').onclick=()=>{S.draftPoints.pop();redrawAreaDraft()};bar.querySelector('.draw-center').onclick=()=>{const c=map.getCenter();S.draftPoints.push([c.lat,c.lng]);redrawAreaDraft()};bar.querySelector('.draw-done').onclick=finishAreaDrawing}return bar;
  }
  function startPointPicking(){
    S.geometryMode='point';S.point=null;dialog()?.close();showView('map');setTimeout(()=>map.invalidateSize(),40);S.drawingMode='point';makeToolbar('📍 Tik één plek op de kaart');map.on('click',onMapClick);toast('Tik de exacte plek van de melding');
  }
  function startAreaDrawing(){
    S.geometryMode='area';S.polygon=null;clearDraft();dialog()?.close();showView('map');setTimeout(()=>map.invalidateSize(),40);S.drawingMode='area';makeToolbar('🐾 Tik minimaal 3 punten rond het gebied',true);map.on('click',onMapClick);toast('Teken de rand van het gebied');
  }
  function onMapClick(e){
    if(S.drawingMode==='point'){
      S.point={lat:Number(e.latlng.lat.toFixed(6)),lng:Number(e.latlng.lng.toFixed(6))};clearDraft();L.marker([S.point.lat,S.point.lng],{interactive:false}).addTo(ensureDraftLayer());$('drawStatusV2').innerHTML='<span class="smart-location-ok">✓ Exacte plek gekozen op de kaart.</span>';$('reportLocationText').textContent='Exact punt gekozen op kaart';reopenReport();return;
    }
    if(S.drawingMode==='area'){S.draftPoints.push([e.latlng.lat,e.latlng.lng]);redrawAreaDraft()}
  }
  function redrawAreaDraft(){
    const layer=ensureDraftLayer();layer.clearLayers();S.draftPoints.forEach(p=>L.circleMarker(p,{radius:5,color:'#3b2418',fillColor:'#f7aa2b',fillOpacity:1,weight:2}).addTo(layer));if(S.draftPoints.length===2)L.polyline(S.draftPoints,{color:'#f7aa2b',weight:4,dashArray:'7 6'}).addTo(layer);if(S.draftPoints.length>=3)L.polygon(S.draftPoints,{color:'#f7aa2b',weight:4,fillColor:'#f7aa2b',fillOpacity:.18,dashArray:'7 6'}).addTo(layer);if(S.toolbar)S.toolbar.querySelector('b').textContent=`🐾 ${S.draftPoints.length} punten · tik verder langs de rand`;
  }
  function finishAreaDrawing(){if(S.draftPoints.length<3){toast('Tik minimaal 3 punten');return}S.polygon=S.draftPoints.map(p=>[Number(p[0].toFixed(6)),Number(p[1].toFixed(6))]);$('drawStatusV2').innerHTML=`<span class="smart-location-ok">✓ Gebied met ${S.polygon.length} punten ingetekend.</span>`;$('reportLocationText').textContent=`Ingetekend gebied · ${S.polygon.length} punten`;reopenReport()}
  function setGeometryMode(mode){S.geometryMode=mode;$('geometryPointV2')?.classList.toggle('active',mode==='point');$('geometryAreaV2')?.classList.toggle('active',mode==='area');$('pickOnMapV2').textContent=mode==='area'?'✏️ Teken het gebied op de kaart':'📍 Kies de exacte plek op de kaart';if(mode==='point'){$('drawStatusV2').innerHTML=S.point?'<span class="smart-location-ok">✓ Exacte plek gekozen.</span>':'Nog geen specifieke plek gekozen. Zonder keuze gebruiken we het midden van de kaart.'}else{$('drawStatusV2').innerHTML=S.polygon?`<span class="smart-location-ok">✓ Gebied met ${S.polygon.length} punten klaar.</span>`:'Teken minimaal 3 punten rond het gebied.'}}
  function polygonCenter(points){const b=L.latLngBounds(points),c=b.getCenter();return{lat:c.lat,lng:c.lng}}

  function resetSmart(){clearPhoto();clearToolbar();clearDraft();S.geometryMode='point';S.point=null;S.polygon=null;S.ai=null;$('geometryPointV2')?.classList.add('active');$('geometryAreaV2')?.classList.remove('active');if($('pickOnMapV2'))$('pickOnMapV2').textContent='📍 Kies de exacte plek op de kaart';if($('drawStatusV2'))$('drawStatusV2').textContent='Nog geen specifieke plek gekozen. Zonder keuze gebruiken we het midden van de kaart.'}

  function saveReport(e){
    e.preventDefault();e.stopImmediatePropagation();if(!selectedReportType){toast('Kies eerst wat je hebt gespot');return}if(selectedReportType==='vegetation'&&!selectedVegetation){toast('Kies welk soort vegetatie je ziet, of kies “Anders”.');return}if(S.geometryMode==='area'&&!S.polygon){toast('Teken eerst het gebied op de kaart');return}
    const p=profile(),reports=allReports();let loc;if(S.geometryMode==='area')loc=polygonCenter(S.polygon);else if(S.point)loc=S.point;else{const c=map.getCenter();loc={lat:c.lat,lng:c.lng}};
    const text=$('reportText').value.trim()||defaultReportText(selectedReportType,selectedVegetation),report={id:crypto.randomUUID?.()||String(Date.now()),type:selectedReportType,subtype:selectedVegetation,text,lat:loc.lat,lng:loc.lng,time:'Zojuist',createdAt:new Date().toISOString(),author:p?.name||'Anonieme hond',confirmed:0,geometryType:S.geometryMode==='area'?'polygon':'point',polygon:S.geometryMode==='area'?S.polygon:null,photoDataUrl:S.photo||null,photoName:S.photoName||null,aiSuggestion:S.ai||null,photoPrivacy:'canvas-reencoded-no-original-exif'};
    try{reports.push(report);saveJSON(STORAGE.reports,reports)}catch(err){console.warn(err);toast('Opslag op dit toestel zit vol. Verwijder een oude foto/melding.');return}
    drawReports();renderPolygons();updateProfileUI();dialog()?.close();clearDraft();toast(report.geometryType==='polygon'?'🐾 Gebied staat op de kaart.':'🐾 Melding staat op de kaart.');resetSmart();
  }

  function styleFor(r){if(r.type==='vegetation')return{color:'#2f7a2d',fillColor:'#82b85a'};if(r.type==='danger'||r.type==='lost')return{color:'#c83b34',fillColor:'#e86a60'};if(r.type==='road')return{color:'#c47712',fillColor:'#f7aa2b'};return{color:'#3b6f55',fillColor:'#7fb798'}}
  function ensureSavedLayer(){if(!S.savedLayer&&map)S.savedLayer=L.featureGroup().addTo(map);return S.savedLayer}
  function renderPolygons(){const layer=ensureSavedLayer();if(!layer)return;layer.clearLayers();allReports().filter(r=>r.geometryType==='polygon'&&Array.isArray(r.polygon)&&r.polygon.length>=3).filter(r=>activeFilter==='all'||activeFilter===r.type).forEach(r=>{const s=styleFor(r);L.polygon(r.polygon,{color:s.color,weight:3,fillColor:s.fillColor,fillOpacity:.27}).on('click',()=>openEnhancedDetail(r)).addTo(layer)})}
  function updateStoredReport(r,fn){const reports=allReports(),i=reports.findIndex(x=>x.id===r.id);if(i<0)return r;const updated={...reports[i]};fn(updated);reports[i]=updated;saveJSON(STORAGE.reports,reports);Object.assign(r,updated);return r}
  function openEnhancedDetail(r){
    const t=reportTypes.find(x=>x.id===r.type)||reportTypes[0],photo=r.photoDataUrl?`<img class="smart-photo-in-detail" src="${r.photoDataUrl}" alt="Foto bij melding">`:'',area=r.geometryType==='polygon'?`<div class="report-area-tag">✏️ Ingetekend gebied · ${r.polygon?.length||0} punten</div>`:'',ai=r.aiSuggestion?`<div class="ai-detail-note"><b>✨ Beeldsuggestie:</b> ${escapeHTML(r.aiSuggestion.label||'Onbekend')} ${Number.isFinite(r.aiSuggestion.confidence)?`(${Math.round(r.aiSuggestion.confidence*100)}%)`:''}<br>Geen vaststelling dat iets veilig of giftig is.</div>`:'';
    $('detailContent').innerHTML=`<div class="detail-icon">${t.icon}</div><h2>${escapeHTML(r.subtype||t.label)}</h2><div class="detail-meta">${escapeHTML(r.time)} · gemeld door ${escapeHTML(r.author||'hondenbezitter')}</div>${area}${photo}${ai}<p class="detail-body">${escapeHTML(r.text)}</p><div class="privacy-note" id="smartConfirmCount">🐾 ${Number(r.confirmed||0)} hondenbezitters bevestigen dit</div><div class="detail-actions"><button type="button" class="primary" id="confirmReport">👍 Nog steeds</button><button type="button" class="primary" id="thankReport">💚 Bedankt</button></div>`;$('detailDialog').showModal();$('confirmReport').onclick=()=>{updateStoredReport(r,x=>x.confirmed=Number(x.confirmed||0)+1);$('smartConfirmCount').textContent=`🐾 ${Number(r.confirmed||0)} hondenbezitters bevestigen dit`;toast('Bevestiging opgeslagen')};$('thankReport').onclick=()=>{toast('💚 Bedankje gegeven');$('detailDialog').close()}
  }

  function boot(){
    injectStyles();injectUI();ensureSubtype('Distels');
    const originalOpen=window.openReportDetail;if(typeof originalOpen==='function')window.openReportDetail=r=>(r?.photoDataUrl||r?.aiSuggestion||r?.geometryType==='polygon'?openEnhancedDetail(r):originalOpen(r));
    $('reportForm')?.addEventListener('submit',saveReport,true);
    $('reportTypes')?.addEventListener('click',e=>{const b=e.target.closest('[data-report-type]');if(!b)return;setTimeout(()=>{updateSummary();$('reportDetails')?.scrollIntoView({behavior:'smooth',block:'start'})},40)});
    $('reportFab')?.addEventListener('click',()=>setTimeout(()=>{resetSmart();updateSummary()},0));
    $('filterRow')?.addEventListener('click',()=>setTimeout(renderPolygons,30));
    dialog()?.addEventListener('close',()=>{if(!S.drawingMode&&dialog()?.returnValue!=='keep-draft'){} });
    setTimeout(renderPolygons,250);
    window.WHATSUP_DOG_SMART_REPORT_V2={reset:resetSmart,render:renderPolygons,state:S};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();