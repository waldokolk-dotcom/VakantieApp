// Whatsup dog — gedigitaliseerde hondenkaart gemeente Nijkerk.
// Bronvormen zijn automatisch kleurgetraceerd uit de officiële 2026-PDF van de gemeente.
// Dit is een digitale afgeleide, geen door de gemeente geleverde bron-GIS.
(async()=>{
  // Load the smart-report module after the core app, without adding a build system.
  if(!document.querySelector('link[data-wd-smart-report]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href='./smart-report.css?v=3';link.dataset.wdSmartReport='1';document.head.appendChild(link);
  }
  if(!document.querySelector('script[data-wd-smart-report]')){
    const script=document.createElement('script');script.src='./smart-report-v3.js?v=3';script.async=false;script.dataset.wdSmartReport='1';document.body.appendChild(script);
  }

  // Community backend is optional and offline-first. Config is loaded before the client.
  const loadCommunity=()=>{
    if(document.querySelector('script[data-wd-community]'))return;
    const script=document.createElement('script');script.src='./community-backend.js?v=1';script.async=false;script.dataset.wdCommunity='1';document.body.appendChild(script);
  };
  if(window.WHATSUP_DOG_BACKEND)loadCommunity();
  else if(!document.querySelector('script[data-wd-backend-config]')){
    const config=document.createElement('script');config.src='./backend-config.js?v=1';config.async=false;config.dataset.wdBackendConfig='1';config.onload=loadCommunity;document.body.appendChild(config);
  }

  if(typeof L==='undefined'||typeof map==='undefined'||!map||typeof offleashLayer==='undefined'||!offleashLayer)return;

  const SOURCE_PAGE='https://www.nijkerk.eu/hondenbeleid';
  const OFFICIAL_NIJKERK_MAP='https://cuatro.sim-cdn.nl/nijkerk/uploads/2.2%20Hondenuitlaatkaart%20Nijkerk%20jan%202026.pdf?cb=-utJx3kH';
  const GEOJSON_URL='./data/nijkerk-losloopgebieden.geojson?v=20260909-2';
  const style={color:'#0879e6',weight:3,fillColor:'#47b9f4',fillOpacity:.36};
  const hoverStyle={color:'#0069c7',weight:4,fillColor:'#40b5f2',fillOpacity:.58};

  function moveLayerSwitch(){
    const toggle=document.getElementById('offleashToggle');
    const toggleLabel=toggle?.closest('label.toggle');
    const mapView=document.getElementById('view-map');
    if(!toggle||!toggleLabel||!mapView||document.querySelector('.offleash-layer-control'))return;

    const control=document.createElement('div');
    control.className='offleash-layer-control';
    control.setAttribute('role','group');
    control.setAttribute('aria-label','Kaartlaag losloopgebieden');

    const title=document.createElement('span');
    title.className='offleash-layer-control-label';
    title.innerHTML='<b>🐕 Losloop</b><small>kaartlaag</small>';
    control.appendChild(title);
    control.appendChild(toggleLabel);
    mapView.appendChild(control);

    const css=document.createElement('style');
    css.textContent=`
      .offleash-layer-control{position:absolute;z-index:525;right:14px;top:139px;display:flex;align-items:center;gap:10px;background:rgba(255,253,248,.97);border:1px solid rgba(59,36,24,.10);border-radius:18px;padding:8px 10px 8px 12px;box-shadow:0 7px 20px rgba(44,34,25,.14);backdrop-filter:blur(8px)}
      .offleash-layer-control-label{display:grid;line-height:1.05;color:#3b2418;white-space:nowrap}
      .offleash-layer-control-label b{font-size:13px;font-weight:1000}
      .offleash-layer-control-label small{font-size:9px;color:#71655c;margin-top:3px}
      .offleash-layer-control .toggle span{width:41px;height:25px}
      .offleash-layer-control .toggle span:after{width:19px;height:19px}
      .offleash-layer-control .toggle input:checked+span:after{left:19px}
      .map-bottom-card .layer-row{padding-right:2px}
      @media(max-width:380px){.offleash-layer-control{right:10px;top:137px;padding:7px 8px}.offleash-layer-control-label small{display:none}}
    `;
    document.head.appendChild(css);
  }

  moveLayerSwitch();
  offleashLayer.clearLayers();
  window.whatsupDogOfficialAreas=[];
  window.WHATSUP_DOG_AREAS=[];
  window.WHATSUP_DOG_OFFICIAL_SOURCE={page:SOURCE_PAGE,map:OFFICIAL_NIJKERK_MAP,place:'Nijkerk',status:'digitised-from-official-pdf'};

  const p=typeof profile==='function'?profile():null;
  const hasHome=p&&Number.isFinite(Number(p.homeLat))&&Number.isFinite(Number(p.homeLng));
  if(hasHome)map.setView([Number(p.homeLat),Number(p.homeLng)],14);
  else map.setView([52.2182,5.4835],14);

  const layerTitle=document.querySelector('.layer-copy b');
  const layerSub=document.querySelector('.layer-copy small');
  if(layerTitle)layerTitle.textContent='Hondenkaart Nijkerk';
  if(layerSub)layerSub.textContent='Even snuffelen in de officiële kaart…';

  const officialPill=document.querySelector('.official-pill');
  if(officialPill)officialPill.textContent='🐕 Vastgesteld losloopgebied';
  const featureBoxes=document.querySelectorAll('.feature-grid > div');
  if(featureBoxes[0])featureBoxes[0].innerHTML='🗺️<small>Uit officiële<br>kaart getraceerd</small>';
  if(featureBoxes[1])featureBoxes[1].innerHTML='📅<small>Besluit<br>3 maart 2026</small>';
  if(featureBoxes[2])featureBoxes[2].innerHTML='🐾<small>Loslopen<br>toegestaan</small>';
  if(featureBoxes[3])featureBoxes[3].innerHTML='🏛️<small>Gemeente<br>Nijkerk</small>';

  try{
    const response=await fetch(GEOJSON_URL,{cache:'no-store',headers:{Accept:'application/geo+json,application/json'}});
    if(!response.ok)throw new Error(`GeoJSON ${response.status}`);
    const data=await response.json();
    if(data?.type!=='FeatureCollection'||!Array.isArray(data.features))throw new Error('Ongeldige GeoJSON');

    const areas=[];
    const geo=L.geoJSON(data,{
      style:()=>style,
      onEachFeature:(feature,leafletLayer)=>{
        const props=feature.properties||{};
        const bounds=leafletLayer.getBounds?.();
        if(!bounds?.isValid?.())return;
        const c=bounds.getCenter();
        const area={objectId:props.id,id:props.id,name:props.name||'Losloopgebied',type:'losloop',center:[c.lat,c.lng],properties:props,geometry:feature.geometry,source:OFFICIAL_NIJKERK_MAP,derived:true};
        areas.push(area);

        leafletLayer.on('mouseover',()=>leafletLayer.setStyle?.(hoverStyle));
        leafletLayer.on('mouseout',()=>leafletLayer.setStyle?.(style));
        leafletLayer.on('click',()=>{if(typeof window.openDogAreaDetail==='function')window.openDogAreaDetail(area)});
        const named=props.name_basis&&props.name&&!String(props.name).startsWith('Losloopgebied ');
        const label=named?`🐕 ${props.name}`:'🐕 Losloopgebied';
        leafletLayer.bindTooltip(label,{sticky:true,direction:'top',className:'municipal-area-label',opacity:.98});
      }
    });
    geo.eachLayer(layer=>layer.addTo(offleashLayer));

    window.whatsupDogOfficialAreas=areas;
    window.WHATSUP_DOG_AREAS=areas;
    if(layerTitle)layerTitle.textContent='Hondenkaart Nijkerk';
    if(layerSub)layerSub.textContent=`${areas.length} losloopgebieden · officiële kaart 2026`;

    document.dispatchEvent(new CustomEvent('dogareasloaded',{detail:{areas,source:OFFICIAL_NIJKERK_MAP,sourceType:'official-pdf-derived-geojson',place:'Nijkerk',derived:true}}));
  }catch(error){
    console.warn('Gedigitaliseerde Nijkerk-hondenkaart kon niet laden',error);
    offleashLayer.clearLayers();
    if(layerTitle)layerTitle.textContent='Hondenkaart Nijkerk';
    if(layerSub)layerSub.textContent='Kaartlaag kon niet laden · geen geschatte vlakken getoond';
    document.dispatchEvent(new CustomEvent('dogareasloaded',{detail:{areas:[],source:OFFICIAL_NIJKERK_MAP,error:String(error)}}));
    if(typeof toast==='function')toast('Losloopgebieden konden niet laden. We tonen geen geschatte gebieden.');
  }
})();