// Whatsup dog — gemeentelijke hondenkaartlaag Nijkerk.
// Bron: actuele honden-uitlaatkaart gemeente Nijkerk (college 3 maart 2026).
(() => {
  if (typeof L === 'undefined' || typeof map === 'undefined' || !map || !offleashLayer) return;

  const areas = [
    {name:'Marishof',type:'omheind',center:[52.21408,5.49723],size:[32,29]},
    {name:'Van der Flierhof',type:'omheind',center:[52.22522,5.47101],size:[34,28]},
    {name:'Antonie Meilingstraat',type:'omheind',center:[52.22012,5.47407],size:[32,30]},
    {name:'Bramenhof',type:'omheind',center:[52.21931,5.49910],size:[31,30]},
    {name:'Eikepage',type:'losloop',center:[52.21308,5.46143],size:[48,30]},
    {name:'Doornsteeg',type:'losloop',center:[52.22435,5.46266],size:[55,32]},
    {name:'Corlaerpark',type:'losloop',polygon:[[52.2107,5.4727],[52.2125,5.4725],[52.2131,5.4751],[52.2121,5.4772],[52.2105,5.4761]]},
    {name:'Stadspark Nijkerk',type:'losloop',polygon:[[52.2203,5.4851],[52.2214,5.4850],[52.2217,5.4870],[52.2208,5.4882],[52.2200,5.4872]]},
    {name:'Dr. F.W. Klaarenbeeksingel, Hoevelaken',type:'omheind',center:[52.17184,5.47101],size:[32,29]}
  ];
  window.WHATSUP_DOG_AREAS=areas;

  const metersToBounds=([lat,lng],[width,height])=>{const dLat=(height/2)/111320;const dLng=(width/2)/(111320*Math.cos(lat*Math.PI/180));return[[lat-dLat,lng-dLng],[lat+dLat,lng+dLng]]};
  offleashLayer.clearLayers();

  areas.forEach(area=>{
    const fenced=area.type==='omheind';
    const style={color:'#0879e6',weight:fenced?4.5:4,fillColor:'#55bfff',fillOpacity:fenced?.58:.48,dashArray:fenced?null:'7 4'};
    const shape=area.polygon?L.polygon(area.polygon,style):L.rectangle(metersToBounds(area.center,area.size),style);
    shape.bindTooltip(`🐕 ${area.name}`,{permanent:true,direction:'center',className:'dog-area-label',opacity:.98});
    shape.on('click',()=>{if(typeof window.openDogAreaDetail==='function')window.openDogAreaDetail(area)});
    shape.addTo(offleashLayer);
  });

  const p=typeof profile==='function'?profile():null;
  if(p&&Number.isFinite(Number(p.homeLat))&&Number.isFinite(Number(p.homeLng)))map.setView([Number(p.homeLat),Number(p.homeLng)],14);
  else map.setView([52.2182,5.4835],14);
})();