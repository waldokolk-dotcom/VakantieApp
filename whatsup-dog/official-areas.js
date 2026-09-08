// Whatsup dog — officiële hondenkaartlaag gemeente Nijkerk.
// Geen handgetekende polygonen: geometrie komt rechtstreeks uit de publieke ArcGIS FeatureServer.
(() => {
  if(typeof L==='undefined'||typeof map==='undefined'||!map||!offleashLayer)return;

  const SERVICE='https://services-eu1.arcgis.com/LULNl2XDE84l3C2w/ArcGIS/rest/services/Hondenkaart/FeatureServer/0';
  const QUERY=`${SERVICE}/query?where=1%3D1&outFields=OBJECTID%2COPMERKING%2CCODE&returnGeometry=true&outSR=4326&f=geojson`;
  const SOURCE_PAGE='https://www.nijkerk.eu/hondenbeleid';

  const styleFor=code=>code==='Hondenspeeltuin'
    ?{color:'#7435b7',weight:4,fillColor:'#c799ef',fillOpacity:.48}
    :{color:'#0879e6',weight:4,fillColor:'#55bfff',fillOpacity:.48};

  function safeName(properties,index){
    const note=String(properties?.OPMERKING||'').trim();
    if(note&&note.toLowerCase()!=='null')return note;
    return properties?.CODE==='Hondenspeeltuin'?'Hondenspeeltuin':`Losloopgebied ${index+1}`;
  }

  async function loadOfficialAreas(){
    offleashLayer.clearLayers();
    try{
      const response=await fetch(QUERY,{headers:{Accept:'application/geo+json,application/json'}});
      if(!response.ok)throw new Error(`ArcGIS ${response.status}`);
      const data=await response.json();
      if(!data||!Array.isArray(data.features))throw new Error('Geen GeoJSON-features ontvangen');

      const dogFeatures=data.features.filter(feature=>['Losloop','Hondenspeeltuin'].includes(feature?.properties?.CODE));
      const areas=[];

      dogFeatures.forEach((feature,index)=>{
        const code=feature.properties?.CODE||'Losloop';
        const geo=L.geoJSON(feature,{style:styleFor(code)});
        const bounds=geo.getBounds();
        if(!bounds.isValid())return;
        const center=bounds.getCenter();
        const area={
          objectId:feature.properties?.OBJECTID??index,
          name:safeName(feature.properties,index),
          type:code==='Hondenspeeltuin'?'hondenspeeltuin':'losloop',
          code,
          center:[center.lat,center.lng],
          properties:feature.properties,
          geometry:feature.geometry,
          source:SERVICE
        };
        areas.push(area);
        geo.bindTooltip(`${code==='Hondenspeeltuin'?'🎾':'🐕'} ${area.name}`,{permanent:true,direction:'center',className:code==='Hondenspeeltuin'?'municipal-area-label municipal-dogpark-label':'municipal-area-label',opacity:.98});
        geo.bindPopup(`<b>${code==='Hondenspeeltuin'?'🎾':'🐕'} ${escapeHTML(area.name)}</b><br>${code==='Hondenspeeltuin'?'Hondenspeeltuin':'Officieel losloopgebied'}<br><span class="official-geometry-note">Exacte begrenzing rechtstreeks uit de GIS-laag van gemeente Nijkerk.</span><br><a href="${SOURCE_PAGE}" target="_blank" rel="noopener">Gemeentelijke hondenkaart ↗</a>`);
        geo.on('click',()=>{if(typeof window.openDogAreaDetail==='function')window.openDogAreaDetail(area)});
        geo.addTo(offleashLayer);
      });

      window.whatsupDogOfficialAreas=areas;
      window.WHATSUP_DOG_AREAS=areas;
      document.dispatchEvent(new CustomEvent('dogareasloaded',{detail:{areas,source:SERVICE}}));
      const p=typeof profile==='function'?profile():null;
      if(p&&Number.isFinite(Number(p.homeLat))&&Number.isFinite(Number(p.homeLng)))map.setView([Number(p.homeLat),Number(p.homeLng)],14);
      else map.setView([52.2182,5.4835],14);
    }catch(error){
      console.warn('Officiële hondenkaart kon niet worden geladen',error);
      window.whatsupDogOfficialAreas=[];
      document.dispatchEvent(new CustomEvent('dogareasloaded',{detail:{areas:[],error:String(error)}}));
      if(typeof toast==='function')toast('De officiële hondenkaart kon niet laden. We tekenen geen geschatte gebieden.');
    }
  }

  loadOfficialAreas();
})();