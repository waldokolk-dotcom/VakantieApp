// Whatsup dog community backend configuration.
// Only the Supabase project URL and publishable/anon key belong here.
// Never place privileged server credentials in browser code.
window.WHATSUP_DOG_BACKEND={
  provider:'supabase',
  enabled:false,
  url:'',
  publishableKey:'',
  photoBucket:'report-photos',
  maxSharedReports:200,
  signedPhotoSeconds:3600
};
