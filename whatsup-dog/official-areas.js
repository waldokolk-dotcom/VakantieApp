// Whatsup dog — gedigitaliseerde hondenkaart gemeente Nijkerk.
// Bronvormen zijn automatisch kleurgetraceerd uit de officiële 2026-PDF van de gemeente.
// Dit is een digitale afgeleide, geen door de gemeente geleverde bron-GIS.
(async()=>{
  if(typeof L==='undefined'||typeof map==='undefined'||!map||typeof offleashLayer==='undefined'||!offleashLayer)return;

  const SOURCE_PAGE='https://www.nijkerk.eu/hondenbeleid';
  const OFFICIAL_NIJKERK_MAP='https://cuatro.sim-cdn.nl/nijkerk/uploads/2.2%20Hondenuitlaatkaart%20Nijkerk%20jan%202026.pdf?cb=-utJx3kH';
  const GEOJSON_URL='./data/nijkerk-losloopgebieden.geojson?v=20260909-2';
  const style={color:'#0879e6',weight:3,fillColor:'#47b9f4',fillOpacity:.36};
  const hoverStyle={color:'#0069c7',weight:4,fillColor:'#40b5f2',fillOpacity:.58};

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
  if(layerTitle)layerTitle.textContent='Losloopgebieden Nijkerk';
  if(layerSub)layerSub.textContent='Even snuffelen in de officiële kaart…';

  // De aanwijzing op de gemeentekaart is officieel; de digitale geometrie is onze afgeleide.
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
        const area={
          objectId:props.id,
          id:props.id,
          name:props.name||'Losloopgebied',
          type:'losloop',
          center:[c.lat,c.lng],
          properties:props,
          geometry:feature.geometry,
          source:OFFICIAL_NIJKERK_MAP,
          derived:true
        };
        areas.push(area);

        leafletLayer.on('mouseover',()=>leafletLayer.setStyle?.(hoverStyle));
        leafletLayer.on('mouseout',()=>leafletLayer.setStyle?.(style));
        leafletLayer.on('click',()=>{
          if(typeof window.openDogAreaDetail==='function')window.openDogAreaDetail(area);
        });
        const named=props.name_basis&&props.name&&!String(props.name).startsWith('Losloopgebied ');
        const label=named?`🐕 ${props.name}`:'🐕 Losloopgebied';
        leafletLayer.bindTooltip(label,{sticky:true,direction:'top',className:'municipal-area-label',opacity:.98});
      }
    });
    geo.eachLayer(layer=>layer.addTo(offleashLayer));

    window.whatsupDogOfficialAreas=areas;
    window.WHATSUP_DOG_AREAS=areas;
    if(layerTitle)layerTitle.textContent='Losloopgebieden Nijkerk';
    if(layerSub)layerSub.textContent=`${areas.length} gebieden · gedigitaliseerd uit officiële kaart 2026`;

    document.dispatchEvent(new CustomEvent('dogareasloaded',{detail:{
      areas,
      source:OFFICIAL_NIJKERK_MAP,
      sourceType:'official-pdf-derived-geojson',
      place:'Nijkerk',
      derived:true
    }}));
  }catch(error){
    console.warn('Gedigitaliseerde Nijkerk-hondenkaart kon niet laden',error);
    offleashLayer.clearLayers();
    if(layerTitle)layerTitle.textContent='Losloopgebieden Nijkerk';
    if(layerSub)layerSub.textContent='Kaartlaag kon niet laden · geen geschatte vlakken getoond';
    document.dispatchEvent(new CustomEvent('dogareasloaded',{detail:{areas:[],source:OFFICIAL_NIJKERK_MAP,error:String(error)}}));
    if(typeof toast==='function')toast('Losloopgebieden konden niet laden. We tonen geen geschatte gebieden.');
  }
})();