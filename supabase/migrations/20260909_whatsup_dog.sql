-- Whatsup dog shared community backend
-- Safe to run in a fresh Supabase project. Browser clients use anonymous Auth users.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar text not null default '🐶' check (char_length(avatar) <= 16),
  home_place text check (home_place is null or char_length(home_place) <= 80),
  home_lat double precision check (home_lat is null or home_lat between -90 and 90),
  home_lng double precision check (home_lng is null or home_lng between -180 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 40),
  author_avatar text not null default '🐶' check (char_length(author_avatar) <= 16),
  type text not null check (type in ('danger','vegetation','dirty','road','fun','walk','spotted','lost')),
  subtype text check (subtype is null or char_length(subtype) <= 80),
  text text not null default '' check (char_length(text) <= 220),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  geometry_type text not null default 'point' check (geometry_type in ('point','polygon')),
  polygon jsonb,
  photo_path text check (photo_path is null or char_length(photo_path) <= 300),
  ai_suggestion jsonb,
  confirmed_count integer not null default 0 check (confirmed_count >= 0),
  status text not null default 'active' check (status in ('active','hidden','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_polygon_shape check (
    (geometry_type='point' and polygon is null)
    or
    (geometry_type='polygon' and jsonb_typeof(polygon)='array' and jsonb_array_length(polygon) between 3 and 120)
  )
);

create index if not exists reports_created_at_idx on public.reports(created_at desc);
create index if not exists reports_status_idx on public.reports(status);
create index if not exists reports_location_idx on public.reports(lat,lng);
create index if not exists reports_user_idx on public.reports(user_id);

alter table public.profiles enable row level security;
alter table public.reports enable row level security;

revoke all on public.profiles from anon;
revoke all on public.reports from anon;
grant select,insert,update on public.profiles to authenticated;
grant select,insert,update,delete on public.reports to authenticated;

drop policy if exists "profiles readable by signed in users" on public.profiles;
create policy "profiles readable by signed in users" on public.profiles
for select to authenticated using (true);

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile" on public.profiles
for insert to authenticated with check ((select auth.uid())=id);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);

drop policy if exists "active reports readable" on public.reports;
create policy "active reports readable" on public.reports
for select to authenticated using (status='active');

drop policy if exists "users insert own reports" on public.reports;
create policy "users insert own reports" on public.reports
for insert to authenticated with check ((select auth.uid())=user_id and status='active');

drop policy if exists "users update own reports" on public.reports;
create policy "users update own reports" on public.reports
for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

drop policy if exists "users delete own reports" on public.reports;
create policy "users delete own reports" on public.reports
for delete to authenticated using ((select auth.uid())=user_id);

-- Private report-photo bucket. The first path segment must equal auth.uid().
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('report-photos','report-photos',false,2000000,array['image/jpeg'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "signed in users read report photos" on storage.objects;
create policy "signed in users read report photos" on storage.objects
for select to authenticated using (bucket_id='report-photos');

drop policy if exists "users upload own report photos" on storage.objects;
create policy "users upload own report photos" on storage.objects
for insert to authenticated with check (
  bucket_id='report-photos'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

drop policy if exists "users update own report photos" on storage.objects;
create policy "users update own report photos" on storage.objects
for update to authenticated using (
  bucket_id='report-photos' and owner_id=(select auth.uid())::text
) with check (
  bucket_id='report-photos' and owner_id=(select auth.uid())::text
);

drop policy if exists "users delete own report photos" on storage.objects;
create policy "users delete own report photos" on storage.objects
for delete to authenticated using (
  bucket_id='report-photos' and owner_id=(select auth.uid())::text
);

-- Realtime changes for the map. Avoid duplicate publication entries on reruns.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='reports'
  ) then
    execute 'alter publication supabase_realtime add table public.reports';
  end if;
end $$;

alter table public.reports replica identity full;
