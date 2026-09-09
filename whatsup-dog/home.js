(() => {
  const hadProfileAtLoad=Boolean(profile()?.homePlace);
  const $=id=>document.getElementById(id);

  function distanceKm(aLat,aLng,bLat,bLng){
    const R=6371,toRad=v=>v*Math.PI/180;
    const dLat=toRad(bLat-aLat),dLng=toRad(bLng-aLng);
    const x=Math.sin(dLat/2)**2+Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;
    return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
  }

  function homePoint(){
    const p=profile();
    const lat=Number(p?.homeLat),lng=Number(p?.homeLng);
    return Number.isFinite(lat)&&Number.isFinite(lng)?[lat,lng]:[52.2182,5.4835];
  }

  function updateHomeProfile(){
    const p=profile();
    $('homeAvatar').textContent=p?.avatar||'🐶';
    $('homeHello').textContent=p?.name?`Hoi ${p.name} 🐾`:'Welkom bij Whatsup dog';
    $('homeTitle').textContent='Wat gaan jullie doen?';
    $('homeSubtitle').textContent=p?.homePlace?`Dit speelt er rond ${p.homePlace}. Kies wat jullie nodig hebben.`:'Een fijne wandeling begint met weten wat er in de buurt speelt.';
  }

  function updateNeighbourhood(){
    const [lat,lng]=homePoint();
    const nearby=allReports().filter(r=>Number.isFinite(Number(r.lat))&&Number.isFinite(Number(r.lng))&&distanceKm(lat,lng,Number(r.lat),Number(r.lng))<=5);
    const risk=nearby.filter(r=>['danger','vegetation','road','lost'].includes(r.type));
    if(risk.length){
      $('homeStatusIcon').textContent='!';
      $('homeStatusIcon').style.background='#fee3df';
      $('homeStatusIcon').style.color='#c83b34';
      $('homeStatusTitle').textContent=`${risk.length} ${risk.length===1?'melding':'meldingen'} om op te letten`;
      $('homeStatusText').textContent='Bekijk de kaart voordat jullie op pad gaan.';
    }else{
      $('homeStatusIcon').textContent='✓';
      $('homeStatusIcon').style.background='#e8f3df';
      $('homeStatusIcon').style.color='#2f7a2d';
      $('homeStatusTitle').textContent='Geen waarschuwingen vlakbij';
      $('homeStatusText').textContent='Voor zover nu gemeld lijkt het rustig in jullie buurt.';
    }
  }

  function areaName(area,index){
    const note=(area.name||'').trim();
    if(note&&note.toLowerCase()!=='null')return note;
    return `Losloopgebied ${index+1}`;
  }

  function renderAreas(areas){
    if(!Array.isArray(areas)||!areas.length){
      $('homeAreas').innerHTML='<div class="gis-error"><b>De Nijkerkse kaartlaag is even niet beschikbaar.</b><br>We tonen dan bewust geen geschatte vlakken. De officiële gemeentelijke PDF blijft de bron.</div>';
      $('homeAreaSource').innerHTML='Bron: <a href="https://www.nijkerk.eu/hondenbeleid" target="_blank" rel="noopener">officiële honden-uitlaatkaart gemeente Nijkerk</a>.';
      return;
    }
    const [lat,lng]=homePoint();
    const ranked=areas.map((a,i)=>({...a,_index:i,_distance:distanceKm(lat,lng,a.center[0],a.center[1])})).sort((a,b)=>a._distance-b._distance).slice(0,3);
    $('homeAreas').innerHTML=ranked.map(a=>`<button class="home-area" data-area-id="${a.objectId??a._index}"><span class="home-area-icon">🐕</span><span><b>${escapeHTML(areaName(a,a._index))}</b><p>Vastgesteld losloopgebied · uit officiële kaart getraceerd</p></span><span class="home-area-distance">${a._distance<1?`${Math.round(a._distance*1000)} m`:`${a._distance.toFixed(1)} km`} ›</span></button>`).join('');
    $('homeAreas').querySelectorAll('[data-area-id]').forEach((button,i)=>button.addEventListener('click',()=>openDogAreaDetail(ranked[i])));
    $('homeAreaSource').textContent=`Gedigitaliseerd uit officiële honden-uitlaatkaart gemeente Nijkerk · ${areas.length} losloopvlakken · besluit 3 maart 2026.`;
  }

  function refresh(){
    updateHomeProfile();
    updateNeighbourhood();
    if(Array.isArray(window.whatsupDogOfficialAreas))renderAreas(window.whatsupDogOfficialAreas);
  }

  function showMapAtHome(){
    showView('map');
    const [lat,lng]=homePoint();
    setTimeout(()=>{map?.invalidateSize();map?.setView([lat,lng],15)},80);
  }

  $('homeWalk')?.addEventListener('click',showMapAtHome);
  $('homeReport')?.addEventListener('click',()=>{showMapAtHome();setTimeout(()=>$('reportFab')?.click(),120)});
  $('homeOffleash')?.addEventListener('click',()=>{showView('map');setTimeout(()=>document.querySelector('[data-filter="offleash"]')?.click(),100)});
  $('homeAllAreas')?.addEventListener('click',()=>{showView('map');setTimeout(()=>document.querySelector('[data-filter="offleash"]')?.click(),100)});
  $('homeVegetation')?.addEventListener('click',()=>{showMapAtHome();setTimeout(()=>{$('reportFab')?.click();setTimeout(()=>document.querySelector('[data-report-type="vegetation"]')?.click(),70)},100)});

  const onboarding=$('onboardingDialog');
  if(onboarding&&!hadProfileAtLoad){
    onboarding.addEventListener('close',()=>{if(profile()?.homePlace)setTimeout(()=>showView('home'),0)},{once:true});
  }
  onboarding?.addEventListener('close',()=>setTimeout(refresh,0));
  $('reportDialog')?.addEventListener('close',()=>setTimeout(refresh,0));
  document.querySelectorAll('[data-view="home"]').forEach(button=>button.addEventListener('click',()=>setTimeout(refresh,0)));

  document.addEventListener('dogareasloaded',e=>renderAreas(e.detail?.areas||window.whatsupDogOfficialAreas||[]));
  if(Array.isArray(window.whatsupDogOfficialAreas))renderAreas(window.whatsupDogOfficialAreas);

  window.refreshWhatsupHome=refresh;
  refresh();
})();