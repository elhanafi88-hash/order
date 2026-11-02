-- METAPLEX STEEL: run this once in Supabase → SQL Editor → New query → Run

-- 1) Data table (one row per record: orders, mats, prod, galv, qc, deliv, docs, settings)
create table if not exists public.docs (
  col text not null,
  id  text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (col, id)
);

-- 2) Staff list: only these emails can edit
create table if not exists public.staff (email text primary key);
alter table public.staff enable row level security;   -- nobody reads/edits it from the site

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

-- 3) Rules: everyone reads, staff writes
alter table public.docs enable row level security;
drop policy if exists "public read" on public.docs;
drop policy if exists "staff insert" on public.docs;
drop policy if exists "staff update" on public.docs;
drop policy if exists "staff delete" on public.docs;
create policy "public read"  on public.docs for select using (true);
create policy "staff insert" on public.docs for insert to authenticated with check (public.is_staff());
create policy "staff update" on public.docs for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff delete" on public.docs for delete to authenticated using (public.is_staff());

-- 4) Live updates
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 5) Private file storage (order PDFs, photos): staff only
insert into storage.buckets (id, name, public) values ('files','files', false)
on conflict (id) do nothing;
drop policy if exists "staff files read" on storage.objects;
drop policy if exists "staff files write" on storage.objects;
drop policy if exists "staff files delete" on storage.objects;
create policy "staff files read"   on storage.objects for select to authenticated using (bucket_id = 'files' and public.is_staff());
create policy "staff files write"  on storage.objects for insert to authenticated with check (bucket_id = 'files' and public.is_staff());
create policy "staff files delete" on storage.objects for delete to authenticated using (bucket_id = 'files' and public.is_staff());
