-- VakantieApp: reproduceerbare basis voor database, RLS en private media-opslag.
-- Idempotent: veilig opnieuw uit te voeren bij herstel of een nieuw Supabase-project.

create table if not exists public.packing (
  id text primary key,
  name text not null,
  category text not null default 'Overig',
  owner text,
  quantity integer not null default 1 check (quantity > 0),
  status text not null default 'todo' check (status in ('todo', 'ready', 'packed')),
  due_date date,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.costs (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null,
  stop_id text,
  amount_cents bigint not null check (amount_cents >= 0),
  category text not null default 'other',
  date date not null default current_date,
  description text,
  created_by text,
  location text,
  kwh numeric(12,3),
  paid_by text,
  payment_method text,
  receipt_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null,
  stop_id text,
  mood text,
  text text not null default '',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid references public.memories(id) on delete cascade,
  trip_id text not null,
  stop_id text,
  storage_path text not null unique,
  file_name text,
  mime_type text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists costs_trip_date_idx on public.costs (trip_id, date desc);
create index if not exists memories_trip_created_idx on public.memories (trip_id, created_at desc);
create index if not exists memories_trip_mood_idx on public.memories (trip_id, mood);
create index if not exists photos_trip_memory_idx on public.photos (trip_id, memory_id);

alter table public.packing enable row level security;
alter table public.costs enable row level security;
alter table public.memories enable row level security;
alter table public.photos enable row level security;

drop policy if exists "vakantie_authenticated_packing" on public.packing;
create policy "vakantie_authenticated_packing" on public.packing
  for all to authenticated using (true) with check (true);

drop policy if exists "vakantie_authenticated_costs" on public.costs;
create policy "vakantie_authenticated_costs" on public.costs
  for all to authenticated using (true) with check (true);

drop policy if exists "vakantie_authenticated_memories" on public.memories;
create policy "vakantie_authenticated_memories" on public.memories
  for all to authenticated using (true) with check (true);

drop policy if exists "vakantie_authenticated_photos" on public.photos;
create policy "vakantie_authenticated_photos" on public.photos
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.packing, public.costs, public.memories, public.photos to authenticated;

insert into storage.buckets (id, name, public)
values ('vakantie-media', 'vakantie-media', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "vakantie_authenticated_media_select" on storage.objects;
create policy "vakantie_authenticated_media_select" on storage.objects
  for select to authenticated using (bucket_id = 'vakantie-media');

drop policy if exists "vakantie_authenticated_media_insert" on storage.objects;
create policy "vakantie_authenticated_media_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'vakantie-media');

drop policy if exists "vakantie_authenticated_media_update" on storage.objects;
create policy "vakantie_authenticated_media_update" on storage.objects
  for update to authenticated using (bucket_id = 'vakantie-media') with check (bucket_id = 'vakantie-media');

drop policy if exists "vakantie_authenticated_media_delete" on storage.objects;
create policy "vakantie_authenticated_media_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'vakantie-media');

-- Een onschuldige, publiek leesbare rij voor de dagelijkse continuiteitscheck.
-- De job kan hierdoor een echte databasequery doen zonder gebruiker of geheim.
create table if not exists public.app_health (
  id smallint primary key default 1 check (id = 1),
  purpose text not null default 'VakantieApp continuity check',
  created_at timestamptz not null default now()
);

insert into public.app_health (id)
values (1)
on conflict (id) do nothing;

alter table public.app_health enable row level security;
drop policy if exists "vakantie_health_read" on public.app_health;
create policy "vakantie_health_read" on public.app_health
  for select to anon, authenticated using (id = 1);
grant select on public.app_health to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'packing'
  ) then
    alter publication supabase_realtime add table public.packing;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'costs'
  ) then
    alter publication supabase_realtime add table public.costs;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'memories'
  ) then
    alter publication supabase_realtime add table public.memories;
  end if;
end $$;
