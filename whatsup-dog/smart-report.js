(()=>{
  const state={photo:null,photoName:null,ai:null,geometryMode:'point',polygon:null,draftPoints:[],draftLayer:null,smartLayer:null,drawing:false,toolbar:null,model:null,modelLoading:null};
  const $=id=>document.getElementById(id);

  function injectUI(){
    const details=$('reportDetails');
    if(!details||document.getElementById('smartReportTools'))return;
    const wrap=document.createElement('div');
    wrap.id='smartReportTools';
    wrap.className='smart-report-tools';
    wrap.innerHTML=`
      <section class="smart-block">
        <div class="smart-block-title"><b>📷 Foto toevoegen</b><small>optioneel</small></div>
        <div class="photo-actions">
          <label class="photo-btn">📸 Maak foto<input id="reportCamera" type="file" accept="image/*" capture="environment"></label>
          <label class="photo-btn">🖼️ Kies foto<input id="reportPhoto" type="file" accept="image/*"></label>
        </div>
        <div id="photoPreviewWrap" class="photo-preview-wrap"><img id="photoPreview" alt="Voorbeeld van de melding"><button id="removePhoto" class="remove-photo" type="button" aria-label="Foto verwijderen">×</button></div>
        <button id="recognizePhoto" class="ai-photo-btn" type="button" disabled>✨ Herken wat erop staat</button>
        <div id="aiResult" class="ai-result" aria-live="polite"></div>
        <p class="photo-privacy">🔒 Voor opslag wordt de foto opnieuw opgebouwd. Verborgen GPS/EXIF-informatie uit het originele bestand wordt daardoor niet meegestuurd.</p>
      </section>
      <section class="smart-block">
        <div class="smart-block-title"><b>📍 Waar is het?</b><small>punt of gebied</small></div>
        <div class="geometry-actions">
          <button id="geometryPoint" type="button" class="geometry-btn active">📍 Punt op kaart</button>
          <button id="geometryArea" type="button" class="geometry-btn">✏️ Gebied intekenen</button>
        </div>
        <div id="drawStatus" class="draw-status">De melding komt op het midden van de kaart.</div>
      </section>`;
    details.insertBefore(wrap,details.firstChild);

    ['reportCamera','reportPhoto'].forEach(id=>$(id)?.addEventListener('change',onPhotoPicked));
    $('removePhoto')?.addEventListener('click',clearPhoto);
    $('recognizePhoto')?.addEventListener('click',recognizePhoto);
    $('geometryPoint')?.addEventListener('click',()=>setGeometryMode('point'));
    $('geometryArea')?.addEventListener('click',()=>setGeometryMode('area'));
  }

  async function fileToCleanDataUrl(file){
    if(!file||!file.type.startsWith('image/'))throw new Error('not-image');
    if(file.size>12*1024*1024)throw new Error('too-large');
    const src=URL.createObjectURL(file);
    try{
      const img=new Image();
      img.decoding='async';
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=src});
      const max=720;
      const scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
      const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
      let quality=.72,data=canvas.toDataURL('image/jpeg',quality);
      while(data.length>260000&&quality>.42){quality-=.08;data=canvas.toDataURL('image/jpeg',quality)}
      return data;
    }finally{URL.revokeObjectURL(src)}
  }

  async function onPhotoPicked(e){
    const file=e.target.files?.[0];if(!file)return;
    try{
      toast('Foto veilig voorbereiden…');
      state.photo=await fileToCleanDataUrl(file);state.photoName=file.name||'foto.jpg';state.ai=null;
      $('photoPreview').src=state.photo;$('photoPreviewWrap').classList.add('has-photo');$('recognizePhoto').disabled=false;
      $('aiResult').classList.remove('show');$('aiResult').innerHTML='';
      toast('📷 Foto toegevoegd zonder GPS-metadata');
    }catch(err){console.warn(err);toast(err.message==='too-large'?'Foto is te groot. Kies een foto tot 12 MB.':'Deze foto kon niet worden gelezen.')}
    finally{e.target.value=''}
  }
  function clearPhoto(){state.photo=null;state.photoName=null;state.ai=null;$('photoPreview').removeAttribute('src');$('photoPreviewWrap')?.classList.remove('has-photo');if($('recognizePhoto'))$('recognizePhoto').disabled=true;if($('aiResult')){$('aiResult').classList.remove('show');$('aiResult').innerHTML=''}}

  function loadScript(src,test){
    if(test())return Promise.resolve();
    return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=()=>test()?resolve():reject(new Error('load-failed'));s.onerror=()=>reject(new Error('load-failed'));document.head.appendChild(s)})
  }
  async function loadVisionModel(){
    if(state.model)return state.model;
    if(state.modelLoading)return state.modelLoading;
    state.modelLoading=(async()=>{
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js',()=>typeof window.tf!=='undefined');
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js',()=>typeof window.mobilenet!=='undefined');
      state.model=await window.mobilenet.load({version:2,alpha:.5});
      return state.model;
    })();
    try{return await state.modelLoading}finally{state.modelLoading=null}
  }
  function mapPrediction(predictions){
    const text=predictions.map(p=>p.className.toLowerCase()).join(' | ');
    if(/cardoon|thistle/.test(text))return{label:'Mogelijk distelachtige plant',subtype:'Distels',kind:'vegetation'};
    if(/mushroom|agaric|bolete|stinkhorn/.test(text))return{label:'Mogelijk paddenstoel',subtype:null,kind:'vegetation'};
    if(/daisy|sunflower|rapeseed|corn|flower/.test(text))return{label:'Bloeiende plant / vegetatie',subtype:null,kind:'vegetation'};
    if(/grass|hay|reed/.test(text))return{label:'Grasachtige vegetatie',subtype:null,kind:'vegetation'};
    return{label:'Plant of object niet betrouwbaar herkend',subtype:null,kind:null};
  }
  function ensureSubtypeButton(label){
    const grid=$('vegetationKinds');if(!grid)return null;
    let btn=[...grid.querySelectorAll('[data-subtype]')].find(b=>b.dataset.subtype===label);
    if(!btn){btn=document.createElement('button');btn.type='button';btn.className='subtype';btn.dataset.subtype=label;btn.textContent=label;grid.appendChild(btn);btn.addEventListener('click',()=>{selectedVegetation=label;grid.querySelectorAll('.subtype').forEach(x=>x.classList.toggle('selected',x===btn))})}
    return btn;
  }
  async function recognizePhoto(){
    if(!state.photo)return;
    const btn=$('recognizePhoto'),result=$('aiResult');btn.disabled=true;btn.textContent='✨ Even snuffelen…';result.classList.add('show');result.innerHTML='<b>Beeldmodel wordt geladen…</b><span class="ai-confidence">De analyse gebeurt op dit toestel.</span>';
    try{
      const model=await loadVisionModel();
      const img=$('photoPreview');
      const preds=await model.classify(img,3);const mapped=mapPrediction(preds);const best=preds[0]||{probability:0,className:'onbekend'};
      state.ai={label:mapped.label,confidence:best.probability,raw:preds.map(p=>({label:p.className,confidence:p.probability})),model:'MobileNet v2 on-device'};
      if(mapped.kind==='vegetation'&&typeof selectedReportType!=='undefined'){
        selectedReportType='vegetation';
        document.querySelectorAll('.report-type').forEach(x=>x.classList.toggle('selected',x.dataset.reportType==='vegetation'));
        $('vegetationKinds')?.classList.remove('hidden');
      }
      if(mapped.subtype){const subtype=ensureSubtypeButton(mapped.subtype);selectedVegetation=mapped.subtype;document.querySelectorAll('.subtype').forEach(x=>x.classList.toggle('selected',x===subtype))}
      const pct=Math.round(best.probability*100);
      result.innerHTML=`<b>✨ ${escapeHTML(mapped.label)}</b><span class="ai-confidence">Beeldsuggestie ${pct}% · ${escapeHTML(best.className)}</span><span class="ai-warning">Niet gebruiken als bewijs dat een plant veilig of giftig is. Controleer de melding zelf.</span>`;
    }catch(err){console.warn(err);state.ai=null;result.innerHTML='<b>Herkenning lukte niet.</b><span class="ai-confidence">Je kunt de foto en categorie nog steeds gewoon melden.</span>'}
    finally{btn.disabled=false;btn.textContent='✨ Opnieuw herkennen'}
  }

  function setGeometryMode(mode){
    state.geometryMode=mode;
    $('geometryPoint')?.classList.toggle('active',mode==='point');$('geometryArea')?.classList.toggle('active',mode==='area');
    if(mode==='point'){cancelDrawing(false);state.polygon=null;$('drawStatus').textContent='De melding komt op het midden van de kaart.';$('reportLocationText').textContent='Punt op het midden van de kaart'}
    else startDrawing();
  }
  function ensureDraftLayer(){if(!state.draftLayer&&typeof L!=='undefined'&&map)state.draftLayer=L.featureGroup().addTo(map);return state.draftLayer}
  function redrawDraft(){
    const layer=ensureDraftLayer();if(!layer)return;layer.clearLayers();
    if(!state.draftPoints.length)return;
    state.draftPoints.forEach(p=>L.circleMarker(p,{radius:5,color:'#3b2418',fillColor:'#f7aa2b',fillOpacity:1,weight:2}).addTo(layer));
    if(state.draftPoints.length===1)return;
    if(state.draftPoints.length<3)L.polyline(state.draftPoints,{color:'#f7aa2b',weight:4,dashArray:'7 6'}).addTo(layer);
    else L.polygon(state.draftPoints,{color:'#f7aa2b',weight:4,fillColor:'#f7aa2b',fillOpacity:.18,dashArray:'7 6'}).addTo(layer);
    if(state.toolbar)state.toolbar.querySelector('b').textContent=`🐾 ${state.draftPoints.length} punten · tik de rand van het gebied`;
  }
  function startDrawing(){
    if(!map)return;
    state.drawing=true;state.draftPoints=[];state.polygon=null;ensureDraftLayer()?.clearLayers();
    $('reportDialog')?.close();showView('map');
    if(state.toolbar)state.toolbar.remove();
    const bar=document.createElement('div');bar.className='draw-toolbar';bar.innerHTML='<b>🐾 Tik minimaal 3 punten rond het gebied</b><button type="button" class="draw-undo">↶ Terug</button><button type="button" class="draw-cancel">× Stop</button><button type="button" class="draw-done">✓ Klaar</button>';
    document.getElementById('view-map')?.appendChild(bar);state.toolbar=bar;
    bar.querySelector('.draw-undo').onclick=()=>{state.draftPoints.pop();redrawDraft()};
    bar.querySelector('.draw-cancel').onclick=()=>{cancelDrawing();$('reportDialog')?.showModal()};
    bar.querySelector('.draw-done').onclick=finishDrawing;
    map.on('click',onMapDrawClick);toast('Tik rond de plek die je wilt markeren');
  }
  function onMapDrawClick(e){if(!state.drawing)return;state.draftPoints.push([e.latlng.lat,e.latlng.lng]);redrawDraft()}
  function finishDrawing(){
    if(state.draftPoints.length<3){toast('Tik minimaal 3 punten om een gebied te maken');return}
    state.polygon=state.draftPoints.map(p=>[Number(p[0].toFixed(6)),Number(p[1].toFixed(6))]);
    state.drawing=false;map.off('click',onMapDrawClick);state.toolbar?.remove();state.toolbar=null;
    $('drawStatus').textContent=`Gebied met ${state.polygon.length} hoekpunten ingetekend.`;$('reportLocationText').textContent=`Ingetekend gebied · ${state.polygon.length} punten`;
    $('reportDialog')?.showModal();
  }
  function cancelDrawing(clearPolygon=true){if(map)map.off('click',onMapDrawClick);state.drawing=false;state.toolbar?.remove();state.toolbar=null;state.draftPoints=[];state.draftLayer?.clearLayers();if(clearPolygon)state.polygon=null}
  function polygonCenter(points){const bounds=L.latLngBounds(points);const c=bounds.getCenter();return{lat:c.lat,lng:c.lng}}

  function resetSmart(){clearPhoto();cancelDrawing();state.geometryMode='point';state.polygon=null;$('geometryPoint')?.classList.add('active');$('geometryArea')?.classList.remove('active');if($('drawStatus'))$('drawStatus').textContent='De melding komt op het midden van de kaart.'}

  function enhancedSubmit(e){
    e.preventDefault();e.stopImmediatePropagation();
    if(!selectedReportType){toast('Kies eerst wat je hebt gespot');return}
    if(selectedReportType==='vegetation'&&!selectedVegetation){toast('Welke vegetatie heb je gezien? Kies een type of “Anders”.');return}
    if(state.geometryMode==='area'&&!state.polygon){toast('Teken eerst het gebied op de kaart');return}
    const p=profile(),reports=allReports();let point;
    if(state.geometryMode==='area')point=polygonCenter(state.polygon);else{const c=map.getCenter();point={lat:c.lat,lng:c.lng}}
    const text=$('reportText').value.trim()||defaultReportText(selectedReportType,selectedVegetation);
    const report={id:crypto.randomUUID?.()||String(Date.now()),type:selectedReportType,subtype:selectedVegetation,text,lat:point.lat,lng:point.lng,time:'Zojuist',author:p?.name||'Anonieme hond',confirmed:0,geometryType:state.geometryMode==='area'?'polygon':'point',polygon:state.geometryMode==='area'?state.polygon:null,photoDataUrl:state.photo||null,aiSuggestion:state.ai||null,photoPrivacy:'canvas-reencoded-no-original-exif'};
    try{reports.push(report);saveJSON(STORAGE.reports,reports)}catch(err){console.warn(err);toast('Opslag op dit toestel zit vol. Verwijder een foto of oude melding.');return}
    drawReports();renderSmartReports();updateProfileUI();$('reportDialog').close();state.draftLayer?.clearLayers();toast(state.geometryMode==='area'?'🐾 Gebied staat op de kaart.':'🐾 Melding staat op de kaart.');resetSmart();
  }

  function smartStyle(r){if(r.type==='vegetation')return{color:'#2f7a2d',fillColor:'#82b85a'};if(r.type==='danger'||r.type==='lost')return{color:'#c83b34',fillColor:'#e86a60'};if(r.type==='road')return{color:'#c47712',fillColor:'#f7aa2b'};return{color:'#3b6f55',fillColor:'#7fb798'}}
  function ensureSmartLayer(){if(!state.smartLayer&&map)state.smartLayer=L.featureGroup().addTo(map);return state.smartLayer}
  function renderSmartReports(){
    const layer=ensureSmartLayer();if(!layer)return;layer.clearLayers();
    allReports().filter(r=>activeFilter==='all'||activeFilter===r.type).filter(r=>r.photoDataUrl||r.geometryType==='polygon'||r.aiSuggestion).forEach(r=>{
      if(r.geometryType==='polygon'&&Array.isArray(r.polygon)&&r.polygon.length>=3){const s=smartStyle(r);L.polygon(r.polygon,{color:s.color,weight:3,fillColor:s.fillColor,fillOpacity:.24}).on('click',()=>openEnhancedDetail(r)).addTo(layer)}
      else if(r.photoDataUrl||r.aiSuggestion){const t=reportTypes.find(x=>x.id===r.type)||reportTypes[0];const icon=L.divIcon({className:'',html:`<div class="marker-badge marker-${t.marker}" style="outline:3px solid white">${t.icon}</div>`,iconSize:[43,43],iconAnchor:[21,21]});L.marker([r.lat,r.lng],{icon,zIndexOffset:300}).on('click',()=>openEnhancedDetail(r)).addTo(layer)}
    })
  }
  function openEnhancedDetail(r){
    const t=reportTypes.find(x=>x.id===r.type)||reportTypes[0];
    const photo=r.photoDataUrl?`<img class="smart-photo-in-detail" src="${r.photoDataUrl}" alt="Foto bij melding">`:'';
    const area=r.geometryType==='polygon'?`<div class="report-area-tag">✏️ Ingetekend gebied · ${r.polygon?.length||0} punten</div>`:'';
    const ai=r.aiSuggestion?`<div class="ai-detail-note"><b>✨ Beeldsuggestie:</b> ${escapeHTML(r.aiSuggestion.label||'Onbekend')} ${Number.isFinite(r.aiSuggestion.confidence)?`(${Math.round(r.aiSuggestion.confidence*100)}%)`:''}<br>Dit is geen vaststelling dat een plant veilig of giftig is.</div>`:'';
    $('detailContent').innerHTML=`<div class="detail-icon">${t.icon}</div><h2>${escapeHTML(r.subtype||t.label)}</h2><div class="detail-meta">${escapeHTML(r.time)} · gemeld door ${escapeHTML(r.author||'hondenbezitter')}</div>${area}${photo}${ai}<p class="detail-body">${escapeHTML(r.text)}</p><div class="privacy-note">🐾 ${Number(r.confirmed||0)} hondenbezitters bevestigen dit</div><div class="detail-actions"><button type="button" class="primary" id="confirmReport">👍 Nog steeds</button><button type="button" class="primary" id="thankReport">💚 Bedankt</button></div>`;
    $('detailDialog').showModal();$('confirmReport').onclick=()=>{toast('Bevestiging geregistreerd');$('detailDialog').close()};$('thankReport').onclick=()=>{toast('💚 Bedankje gegeven');$('detailDialog').close()}
  }

  function boot(){
    injectUI();
    const vegetation=$('vegetationKinds');if(vegetation&&!vegetation.querySelector('[data-subtype="Distels"]'))ensureSubtypeButton('Distels');
    const form=$('reportForm');if(form)form.addEventListener('submit',enhancedSubmit,true);
    $('reportFab')?.addEventListener('click',()=>setTimeout(resetSmart,0));
    document.getElementById('filterRow')?.addEventListener('click',()=>setTimeout(renderSmartReports,0));
    setTimeout(renderSmartReports,250);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();