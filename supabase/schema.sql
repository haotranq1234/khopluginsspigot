-- Kho Plugin: database schema for Supabase
-- Run this once in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create table if not exists public.plugins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform text not null check (platform in ('Spigot', 'Paper', 'BungeeCord')),
  price integer not null default 0 check (price >= 0),
  tag text not null default 'free' check (tag in ('free', 'premium')),
  status text not null default 'active' check (status in ('active', 'draft')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plugin_versions (
  id uuid primary key default gen_random_uuid(),
  plugin_id uuid not null references public.plugins(id) on delete cascade,
  version text not null,
  download_path text,
  changelog text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (plugin_id, version)
);

create index if not exists plugins_created_at_idx on public.plugins (created_at desc);
create index if not exists plugin_versions_plugin_id_idx on public.plugin_versions (plugin_id);

alter table public.profiles enable row level security;
alter table public.plugins enable row level security;
alter table public.plugin_versions enable row level security;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "Authenticated users can read plugins" on public.plugins;
create policy "Authenticated users can read plugins" on public.plugins
  for select to authenticated using (true);

drop policy if exists "Admins can insert plugins" on public.plugins;
create policy "Admins can insert plugins" on public.plugins
  for insert to authenticated with check (public.is_admin());

drop policy if exists "Admins can update plugins" on public.plugins;
create policy "Admins can update plugins" on public.plugins
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete plugins" on public.plugins;
create policy "Admins can delete plugins" on public.plugins
  for delete to authenticated using (public.is_admin());

drop policy if exists "Authenticated users can read plugin versions" on public.plugin_versions;
create policy "Authenticated users can read plugin versions" on public.plugin_versions
  for select to authenticated using (true);

drop policy if exists "Admins can insert plugin versions" on public.plugin_versions;
create policy "Admins can insert plugin versions" on public.plugin_versions
  for insert to authenticated with check (public.is_admin());

drop policy if exists "Admins can update plugin versions" on public.plugin_versions;
create policy "Admins can update plugin versions" on public.plugin_versions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete plugin versions" on public.plugin_versions;
create policy "Admins can delete plugin versions" on public.plugin_versions
  for delete to authenticated using (public.is_admin());

-- Optional storage bucket for .jar files.
insert into storage.buckets (id, name, public)
values ('plugin-files', 'plugin-files', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can download plugin files" on storage.objects;
create policy "Authenticated users can download plugin files" on storage.objects
  for select to authenticated using (bucket_id = 'plugin-files');

drop policy if exists "Admins can upload plugin files" on storage.objects;
create policy "Admins can upload plugin files" on storage.objects
  for insert to authenticated with check (bucket_id = 'plugin-files' and public.is_admin());

drop policy if exists "Admins can update plugin files" on storage.objects;
create policy "Admins can update plugin files" on storage.objects
  for update to authenticated using (bucket_id = 'plugin-files' and public.is_admin()) with check (bucket_id = 'plugin-files' and public.is_admin());

drop policy if exists "Admins can delete plugin files" on storage.objects;
create policy "Admins can delete plugin files" on storage.objects
  for delete to authenticated using (bucket_id = 'plugin-files' and public.is_admin());

-- After creating your first account, promote it to admin by replacing the email:
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'your-email@example.com');
