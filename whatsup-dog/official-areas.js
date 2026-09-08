// Whatsup dog — hondenkaart gemeente Nijkerk.
// Belangrijk: gebruik uitsluitend bronnen die aantoonbaar van gemeente Nijkerk zijn.
(() => {
  if(typeof map==='undefined'||!map||typeof offleashLayer==='undefined'||!offleashLayer)return;

  const SOURCE_PAGE='https://www.nijkerk.eu/hondenbeleid';
  const OFFICIAL_NIJKERK_MAP='https://cuatro.sim-cdn.nl/nijkerk/uploads/2.2%20Hondenuitlaatkaart%20Nijkerk%20jan%202026.pdf?cb=-utJx3kH';

  // De eerder gekoppelde ArcGIS FeatureServer bleek geografisch bij
  // Rijswijk/Pijnacker-Nootdorp te horen en is daarom volledig verwijderd.
  // We tekenen geen geschatte polygonen alsof die officieel zijn.
  offleashLayer.clearLayers();
  window.whatsupDogOfficialAreas=[];
  window.WHATSUP_DOG_AREAS=[];
  window.WHATSUP_DOG_OFFICIAL_SOURCE={page:SOURCE_PAGE,map:OFFICIAL_NIJKERK_MAP,place:'Nijkerk'};

  const p=typeof profile==='function'?profile():null;
  if(p&&Number.isFinite(Number(p.homeLat))&&Number.isFinite(Number(p.homeLng))){
    map.setView([Number(p.homeLat),Number(p.homeLng)],14);
  }else{
    map.setView([52.2182,5.4835],14);
  }

  document.dispatchEvent(new CustomEvent('dogareasloaded',{detail:{
    areas:[],
    source:OFFICIAL_NIJKERK_MAP,
    sourceType:'official-pdf',
    place:'Nijkerk',
    pendingVectorisation:true
  }}));
})();