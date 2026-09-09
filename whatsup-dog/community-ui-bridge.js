(()=>{
  function redrawSharedShapes(){
    try{window.WHATSUP_DOG_SMART_REPORT_V3?.render?.()}catch(err){console.warn('Gedeelde vlakken konden niet worden hertekend',err)}
  }
  document.addEventListener('wd:shared-reports-updated',redrawSharedShapes);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(redrawSharedShapes,350),{once:true});
})();
