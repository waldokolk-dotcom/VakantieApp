const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('continuiteitsmigratie bevat alle VakantieApp-onderdelen', () => {
  const sql = read('supabase/migrations/20260917_vakantie_app_continuity.sql');
  for (const table of ['packing', 'costs', 'memories', 'photos', 'app_health']) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\b`, 'i'));
  }
  assert.match(sql, /values \('vakantie-media', 'vakantie-media', false\)/i);
  assert.match(sql, /enable row level security/i);
});

test('keepalive gebruikt uitsluitend een beperkte bestaande tabel', () => {
  const script = read('scripts/supabase-keepalive.mjs');
  assert.match(script, /memories\?select=id&limit=1/);
  assert.doesNotMatch(script, /service[_-]?role/i);
  assert.doesNotMatch(script, /password/i);
});

test('dagelijkse workflow gebruikt geen krachtig Supabase-geheim', () => {
  const workflow = read('.github/workflows/supabase-keepalive.yml');
  assert.match(workflow, /cron: '17 5 \* \* \*'/);
  assert.match(workflow, /node scripts\/supabase-keepalive\.mjs/);
  assert.doesNotMatch(workflow, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(workflow, /SUPABASE_DATABASE_PASSWORD/);
});
