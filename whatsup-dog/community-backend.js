(()=>{
  const CFG=window.WHATSUP_DOG_BACKEND||{};
  const REPORTS_KEY='wd_reports_v1';
  const PROFILE_KEY='wd_profile_v1';
  const QUEUE_KEY='wd_shared_report_queue_v1';
  const SUPABASE_JS='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  const state={client:null,user:null,channel:null,ready:false,refreshTimer:null,monitor:null,knownIds:new Set(),processing:false};

  const parse=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
  const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
  const reports=()=>parse(REPORTS_KEY,[]);
  const profile=()=>parse(PROFILE_KEY,null);
  const queue=()=>parse(QUEUE_KEY,[]);
  const configured=()=>CFG.enabled===true&&/^https:\/\//.test(CFG.url||'')&&String(CFG.publishableKey||'').length>20;

  function setStatus(label,title){
    const status=document.getElementById('profileStatus');if(status){status.textContent=label;status.title=title||label}
    document.documentElement.dataset.community=label.toLowerCase().replace(/\s+/g,'-');
    document.dispatchEvent(new CustomEvent('wd:community-status',{detail:{label,title}}));
  }

  function loadScript(src,test){
    if(test())return Promise.resolve();
    return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=()=>test()?resolve():reject(new Error('supabase-global-missing'));s.onerror=()=>reject(new Error('supabase-load-failed'));document.head.appendChild(s)});
  }

  function addQueue(id){const q=queue();if(!q.includes(id)){q.push(id);write(QUEUE_KEY,q)}}
  function removeQueue(id){write(QUEUE_KEY,queue().filter(x=>x!==id))}
  function markRemote(id,userId){const rows=reports(),i=rows.findIndex(r=>r.id===id);if(i<0)return;rows[i]={...rows[i],_remote:true,userId:userId||rows[i].userId||null};write(REPORTS_KEY,rows)}

  function redraw(){
    try{if(typeof drawReports==='function')drawReports()}catch{}
    try{if(typeof window.refreshWhatsupHome==='function')window.refreshWhatsupHome()}catch{}
    document.dispatchEvent(new CustomEvent('wd:shared-reports-updated'));
  }

  async function ensureUser(){
    const {data:sessionData,error:sessionError}=await state.client.auth.getSession();
    if(sessionError)throw sessionError;
    let session=sessionData?.session||null;
    if(!session){
      const p=profile();
      const {data,error}=await state.client.auth.signInAnonymously({options:{data:{display_name:p?.name||'Hondenbezitter',avatar:p?.avatar||'🐶'}}});
      if(error)throw error;session=data?.session||null;
    }
    state.user=session?.user||null;
    if(!state.user)throw new Error('anonymous-auth-no-user');
    return state.user;
  }

  async function syncProfile(){
    if(!state.user)return;
    const p=profile();if(!p?.name)return;
    const row={id:state.user.id,display_name:String(p.name).slice(0,40),avatar:String(p.avatar||'🐶').slice(0,16),home_place:String(p.homePlace||'').slice(0,80)||null,home_lat:Number.isFinite(Number(p.homeLat))?Number(p.homeLat):null,home_lng:Number.isFinite(Number(p.homeLng))?Number(p.homeLng):null,updated_at:new Date().toISOString()};
    const {error}=await state.client.from('profiles').upsert(row,{onConflict:'id'});if(error)throw error;
  }

  async function dataUrlToBlob(dataUrl){const response=await fetch(dataUrl);if(!response.ok)throw new Error('photo-blob-failed');return response.blob()}
  async function uploadPhoto(report){
    if(!report.photoDataUrl?.startsWith('data:image/'))return report.photoPath||null;
    const path=`${state.user.id}/${report.id}.jpg`;
    const blob=await dataUrlToBlob(report.photoDataUrl);
    const {error}=await state.client.storage.from(CFG.photoBucket||'report-photos').upload(path,blob,{contentType:'image/jpeg',upsert:true,cacheControl:'3600'});
    if(error)throw error;return path;
  }

  function cleanPolygon(value){
    if(!Array.isArray(value))return null;
    const pts=value.map(p=>Array.isArray(p)&&p.length>=2?[Number(p[0]),Number(p[1])]:null).filter(p=>p&&Number.isFinite(p[0])&&Number.isFinite(p[1]));
    return pts.length>=3?pts.slice(0,120):null;
  }

  async function shareOne(report){
    if(!state.ready||!state.user||report?._remote)return;
    const photoPath=await uploadPhoto(report);
    const p=profile();const polygon=cleanPolygon(report.polygon);
    const row={
      id:report.id,user_id:state.user.id,author_name:String(p?.name||report.author||'Hondenbezitter').slice(0,40),author_avatar:String(p?.avatar||'🐶').slice(0,16),
      type:String(report.type||'danger').slice(0,32),subtype:report.subtype?String(report.subtype).slice(0,80):null,text:String(report.text||'').slice(0,220),
      lat:Number(report.lat),lng:Number(report.lng),geometry_type:polygon?'polygon':'point',polygon:polygon,
      photo_path:photoPath,ai_suggestion:report.aiSuggestion&&typeof report.aiSuggestion==='object'?report.aiSuggestion:null,status:'active'
    };
    if(!Number.isFinite(row.lat)||!Number.isFinite(row.lng))throw new Error('invalid-report-location');
    const {error}=await state.client.from('reports').upsert(row,{onConflict:'id'});if(error)throw error;
    markRemote(report.id,state.user.id);removeQueue(report.id);
    if(typeof toast==='function')toast('🐾 Melding gedeeld met andere hondenbezitters');
  }

  async function processQueue(){
    if(!state.ready||state.processing||!navigator.onLine)return;state.processing=true;
    try{
      for(const id of queue()){
        const report=reports().find(r=>r.id===id);if(!report){removeQueue(id);continue}
        try{await shareOne(report)}catch(err){console.warn('Whatsup dog delen uitgesteld',err);setStatus('Wacht op sync','Melding staat lokaal veilig en wordt later opnieuw gedeeld');break}
      }
    }finally{state.processing=false}
  }

  function relativeTime(iso){
    const ms=Date.now()-new Date(iso).getTime();if(!Number.isFinite(ms)||ms<0)return 'Zojuist';const m=Math.floor(ms/60000);if(m<1)return 'Zojuist';if(m<60)return `${m} min`;const h=Math.floor(m/60);if(h<24)return `${h} uur`;const d=Math.floor(h/24);return d===1?'Gisteren':`${d} dagen`;
  }

  async function signedPhoto(path){
    if(!path)return null;const {data,error}=await state.client.storage.from(CFG.photoBucket||'report-photos').createSignedUrl(path,Number(CFG.signedPhotoSeconds)||3600);if(error){console.warn('Foto-url kon niet worden gemaakt',error);return null}return data?.signedUrl||null;
  }

  async function refreshSharedReports(){
    if(!state.ready)return;
    const {data,error}=await state.client.from('reports').select('id,user_id,author_name,author_avatar,type,subtype,text,lat,lng,geometry_type,polygon,photo_path,ai_suggestion,confirmed_count,created_at').eq('status','active').order('created_at',{ascending:false}).limit(Number(CFG.maxSharedReports)||200);
    if(error)throw error;
    const remote=[];
    for(const row of data||[]){
      const photoUrl=await signedPhoto(row.photo_path);
      remote.push({id:row.id,type:row.type,subtype:row.subtype,text:row.text,lat:Number(row.lat),lng:Number(row.lng),time:relativeTime(row.created_at),author:row.author_name||'Hondenbezitter',authorAvatar:row.author_avatar||'🐶',confirmed:Number(row.confirmed_count||0),geometryType:row.geometry_type||'point',polygon:Array.isArray(row.polygon)?row.polygon:null,photoDataUrl:photoUrl,photoPath:row.photo_path||null,aiSuggestion:row.ai_suggestion||null,_remote:true,userId:row.user_id,createdAt:row.created_at});
    }
    const remoteIds=new Set(remote.map(r=>r.id));
    const local=reports().filter(r=>!r._remote&&!remoteIds.has(r.id));
    write(REPORTS_KEY,[...local,...remote]);
    for(const r of remote)state.knownIds.add(r.id);
    redraw();setStatus('Community aan','Gedeelde meldingen worden live bijgewerkt');
  }

  function scheduleRefresh(delay=350){clearTimeout(state.refreshTimer);state.refreshTimer=setTimeout(()=>refreshSharedReports().catch(err=>{console.warn('Community refresh mislukt',err);setStatus('Offline','Gedeelde meldingen konden niet worden bijgewerkt')}),delay)}

  function subscribe(){
    state.channel=state.client.channel('whatsup-dog-reports').on('postgres_changes',{event:'*',schema:'public',table:'reports'},()=>scheduleRefresh()).subscribe();
  }

  function watchLocalReports(){
    state.knownIds=new Set(reports().map(r=>r.id));
    state.monitor=setInterval(()=>{
      const rows=reports();
      for(const r of rows){
        if(!r?.id||state.knownIds.has(r.id))continue;
        state.knownIds.add(r.id);
        if(!r._remote){addQueue(r.id);processQueue()}
      }
    },700);
    window.addEventListener('online',()=>{setStatus('Synchroniseren','Internet teruggevonden');processQueue();scheduleRefresh(0)});
    document.getElementById('onboardingDialog')?.addEventListener('close',()=>syncProfile().catch(console.warn));
  }

  async function boot(){
    if(!configured()){
      window.WhatsupDogCommunity={configured:false,status:'local-only'};setStatus('Lokaal','De gedeelde backend is nog niet gekoppeld');return;
    }
    try{
      setStatus('Verbinden','Veilige communityverbinding opzetten…');
      await loadScript(SUPABASE_JS,()=>Boolean(window.supabase?.createClient));
      state.client=window.supabase.createClient(CFG.url,CFG.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
      await ensureUser();await syncProfile();state.ready=true;
      window.WhatsupDogCommunity={configured:true,get client(){return state.client},get user(){return state.user},refresh:refreshSharedReports,processQueue};
      watchLocalReports();await refreshSharedReports();subscribe();await processQueue();
      setInterval(()=>scheduleRefresh(0),15*60*1000);
    }catch(err){console.warn('Whatsup dog community backend niet actief',err);state.ready=false;window.WhatsupDogCommunity={configured:true,status:'error',error:String(err?.message||err)};setStatus('Lokaal','Communityverbinding niet beschikbaar; meldingen blijven op dit toestel werken')}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
