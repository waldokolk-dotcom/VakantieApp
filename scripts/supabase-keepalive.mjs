const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const key = String(process.env.SUPABASE_PUBLISHABLE_KEY || "");

if (!url || !key) {
  console.error("SUPABASE_URL en SUPABASE_PUBLISHABLE_KEY zijn verplicht.");
  process.exit(1);
}

const endpoint = `${url}/rest/v1/app_health?select=id&limit=1`;
const response = await fetch(endpoint, {
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "User-Agent": "VakantieApp-continuity-check/1.0",
  },
});

const body = await response.text();

if (!response.ok) {
  console.error(`Supabase-controle mislukt (${response.status}): ${body.slice(0, 500)}`);
  process.exit(1);
}

console.log(`Supabase actief: ${response.status}; app_health bereikbaar.`);
