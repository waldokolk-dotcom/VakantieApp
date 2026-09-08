// Whatsup dog v1 — gemeentelijke hondenkaartlaag Nijkerk + woonplaatsgestuurde kaartstart.
// Bronnen hondenkaart: actuele honden-uitlaatkaart gemeente Nijkerk (college 3 maart 2026)
// en het geldende Aanwijzingsbesluit honden Nijkerk.
(() => {
  if (typeof L === 'undefined' || typeof map === 'undefined' || !map) return;

  const SOURCE_URL = 'https://www.nijkerk.eu/hondenbeleid';
  const areas = [
    {name:'Marishof', type:'omheind', center:[52.21408,5.49723], size:[32,29]},
    {name:'Van der Flierhof', type:'omheind', center:[52.22522,5.47101], size:[34,28]},
    {name:'Antonie Meilingstraat', type:'omheind', center:[52.22012,5.47407], size:[32,30]},
    {name:'Bramenhof', type:'omheind', center:[52.21931,5.49910], size:[31,30]},
    {name:'Eikepage', type:'losloop', center:[52.21308,5.46143], size:[48,30]},
    {name:'Doornsteeg', type:'losloop', center:[52.22435,5.46266], size:[55,32]},
    {name:'Corlaerpark', type:'losloop', polygon:[[52.2107,5.4727],[52.2125,5.4725],[52.2131,5.4751],[52.2121,5.4772],[52.2105,5.4761]]},
    {name:'Stadspark Nijkerk', type:'losloop', polygon:[[52.2203,5.4851],[52.2214,5.4850],[52.2217,5.4870],[52.2208,5.4882],[52.2200,5.4872]]},
    {name:'Dr. F.W. Klaarenbeeksingel, Hoevelaken', type:'omheind', center:[52.17184,5.47101], size:[32,29]}
  ];

  const metersToBounds = ([lat,lng],[width,height]) => {
    const dLat=(height/2)/111320;
    const dLng=(width/2)/(111320*Math.cos(lat*Math.PI/180));
    return [[lat-dLat,lng-dLng],[lat+dLat,lng+dLng]];
  };

  // Verwijder de oude demo-geometrie uit v1.
  if (typeof offleashLayer !== 'undefined' && offleashLayer) offleashLayer.clearLayers();
  if (typeof onleashLayer !== 'undefined' && onleashLayer) {
    onleashLayer.clearLayers();
    if (map.hasLayer(onleashLayer)) map.removeLayer(onleashLayer);
  }

  areas.forEach(area => {
    const fenced=area.type==='omheind';
    const style={
      color:fenced?'#005d92':'#008fd0',
      weight:fenced?4:3,
      fillColor:'#12aee9',
      fillOpacity:fenced?.42:.28,
      dashArray:fenced?null:'8 5'
    };
    const shape=area.polygon ? L.polygon(area.polygon,style) : L.rectangle(metersToBounds(area.center,area.size),style);
    shape.bindPopup(`<b>🐕 ${area.name}</b><br>${fenced?'Omheind hondenlosloopgebied':'Hondenlosloopgebied'}<br><small>Locatie opgenomen op de actuele honden-uitlaatkaart van gemeente Nijkerk. Opruimplicht geldt ook in losloopgebieden.</small><br><a href="${SOURCE_URL}" target="_blank" rel="noopener">Officiële gemeentekaart ↗</a>`);
    shape.addTo(offleashLayer);
  });

  // Zonder ingestelde woonplaats blijft Nijkerk de logische demonstratiestart.
  map.setView([52.2182,5.4835],14);

  // Zet de voorbeeldmeldingen ook in het zichtbare Nijkerkse kaartbeeld.
  if (typeof seedReports !== 'undefined' && Array.isArray(seedReports)) {
    seedReports.splice(0,seedReports.length,
      {id:'seed1',type:'vegetation',subtype:'Grasaren',text:'Veel grasaren langs de rand van het pad.',lat:52.2167,lng:5.4867,time:'Vandaag 10:20',author:'Pip',confirmed:6},
      {id:'seed2',type:'danger',text:'Kleine glasscherven naast het wandelpad.',lat:52.2208,lng:5.4808,time:'Vandaag 09:45',author:'Bowie',confirmed:3},
      {id:'seed3',type:'fun',text:'Fijne schaduwplek met water in de buurt.',lat:52.2138,lng:5.4926,time:'Gisteren',author:'Luna',confirmed:9}
    );
    if (typeof drawReports === 'function') drawReports();
  }

  // Laat de legenda overeenkomen met de officiële gemeentelijke kleur blauw.
  const offLabel=document.querySelector('[data-layer="offleash"]')?.closest('label');
  if (offLabel) {
    const swatch=offLabel.querySelector('.legend-swatch');
    if (swatch) { swatch.style.background='rgba(18,174,233,.35)'; swatch.style.border='2px solid #005d92'; }
    const nodes=[...offLabel.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE);
    if (nodes.length) nodes[nodes.length-1].textContent=' Vastgestelde losloopgebieden';
  }
  const onLabel=document.querySelector('[data-layer="onleash"]')?.closest('label');
  if (onLabel) onLabel.style.display='none';

  const losloopChip=document.querySelector('[data-filter="offleash"]');
  if (losloopChip) losloopChip.title='Toon de vastgestelde hondenlosloopgebieden';

  // --- Woonplaats van de hond: alleen plaatsnaam, geen huisadres of live GPS. ---
  const dialog=document.getElementById('onboardingDialog');
  const form=document.getElementById('onboardingForm');
  const nameField=document.getElementById('onboardingName')?.closest('.field');
  const privacyNote=form?.querySelector('.privacy-note');
  const saveButton=document.getElementById('saveProfile');

  if (!dialog || !form || !nameField || !saveButton) return;

  const homeField=document.createElement('label');
  homeField.className='field';
  homeField.innerHTML='<span>Waar woont je hond?</span><input id="onboardingHome" maxlength="80" autocomplete="address-level2" placeholder="Bijv. Nijkerk" required><small style="color:#77695e;line-height:1.35">Alleen woonplaats. Geen straat, huisnummer of exacte GPS-locatie.</small>';
  nameField.insertAdjacentElement('afterend',homeField);

  const homeInput=document.getElementById('onboardingHome');
  if (privacyNote) privacyNote.textContent='🔒 We bewaren in deze demo alleen naam/avatar en de woonplaats als kaartvoorkeur op dit toestel. Geen huisadres en geen openbare live locatie.';

  const current=typeof profile==='function' ? profile() : null;
  if (current?.homePlace) homeInput.value=current.homePlace;

  const homeLabelFromResult=(result,fallback)=>{
    const a=result.address||{};
    return a.city||a.town||a.village||a.municipality||a.county||fallback;
  };

  async function geocodePlace(place) {
    const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&accept-language=nl&q='+encodeURIComponent(place);
    const response=await fetch(url,{headers:{Accept:'application/json'}});
    if (!response.ok) throw new Error('geocoding-failed');
    const results=await response.json();
    if (!Array.isArray(results) || !results.length) return null;
    const first=results[0];
    const lat=Number(first.lat),lng=Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {lat,lng,label:homeLabelFromResult(first,place)};
  }

  function applyHomeView(p) {
    const lat=Number(p?.homeLat),lng=Number(p?.homeLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    map.setView([lat,lng],14);
    const subtitle=document.getElementById('profileSubtitle');
    if (subtitle && p.homePlace) subtitle.textContent=`Woont in ${p.homePlace} · klaar om te snuffelen`;
    return true;
  }

  // Een eerder ingesteld thuisgebied wint altijd van de Nijkerk-demostart.
  applyHomeView(current);

  // Bestaande profielen uit v1 zonder woonplaats krijgen de vraag één keer alsnog.
  if (current && (!current.homePlace || !Number.isFinite(Number(current.homeLat)) || !Number.isFinite(Number(current.homeLng)))) {
    setTimeout(()=>{
      if (!dialog.open && typeof openProfileDialog==='function') openProfileDialog();
      homeInput.focus();
    },320);
  }

  // Capture-fase: deze uitgebreidere opslag vervangt de oude lokale submit-handler.
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    event.stopImmediatePropagation();

    const name=document.getElementById('onboardingName').value.trim();
    const place=homeInput.value.trim();
    if (!name) { toast('Vul eerst een naam in 🐾'); return; }
    if (!place) { toast('Vul de woonplaats van je hond in 🐕'); homeInput.focus(); return; }

    const oldText=saveButton.textContent;
    saveButton.disabled=true;
    saveButton.textContent='🐾 Even snuffelen naar je woonplaats…';

    try {
      const found=await geocodePlace(place);
      if (!found) {
        toast('Die plaats kon ik niet vinden. Probeer bijvoorbeeld “Nijkerk, Gelderland”.');
        homeInput.focus();
        return;
      }

      const before=typeof profile==='function' ? profile() : null;
      const next={
        ...(before||{}),
        name,
        avatar:typeof selectedAvatar!=='undefined' ? selectedAvatar : (before?.avatar||'🐶'),
        homePlace:found.label,
        homeLat:found.lat,
        homeLng:found.lng,
        createdAt:before?.createdAt||new Date().toISOString()
      };
      saveJSON(STORAGE.profile,next);
      updateProfileUI();
      applyHomeView(next);
      dialog.close();
      toast(`Welkom, ${name}! Kaart geopend rond ${found.label} 🐾`);
    } catch (error) {
      console.warn('Woonplaats kon niet worden opgezocht',error);
      toast('Woonplaats opzoeken lukt nu niet. Controleer je internetverbinding en probeer opnieuw.');
    } finally {
      saveButton.disabled=false;
      saveButton.textContent=oldText;
    }
  },true);
})();
