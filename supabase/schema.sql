-- Mirrors supabase/migrations/001_init.sql for teams that run SQL manually.
-- Briefr Milestone 10: real accounts, user-scoped data, and RLS.
-- Run this in the Supabase SQL editor (or with `supabase db push`).
-- Secrets are intentionally absent: BYOK LLM keys and calendar tokens stay in localStorage.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  location text not null default '',
  wardrobe_prefs jsonb not null default '{}'::jsonb,
  tone text not null default 'Quick Bullets',
  political_lens text not null default 'neutral'
    check (political_lens in ('neutral', 'conservative', 'liberal', 'libertarian', 'independent', 'unfiltered')),
  coverage_mode text not null default 'balanced'
    check (coverage_mode in ('aligned', 'balanced')),
  news_packs jsonb not null default '[]'::jsonb,
  custom_feeds jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  config jsonb not null default '{}'::jsonb,
  feed_url text,
  database_id text,
  sync_status text not null default 'active',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_sources_user_id_idx on public.calendar_sources(user_id);

create table if not exists public.triage_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  category text not null check (category in ('needs_action', 'fyi', 'noise')),
  sender text not null default '',
  summary text not null default '',
  suggested_action text not null default '',
  urgency text not null default '',
  schedule_note text not null default '',
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists triage_items_user_day_idx on public.triage_items(user_id, day);

-- Every table is private to its owner.
alter table public.user_profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.calendar_sources enable row level security;
alter table public.triage_items enable row level security;

-- user_profiles policies
drop policy if exists "profiles_select_own" on public.user_profiles;
create policy "profiles_select_own" on public.user_profiles for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "profiles_insert_own" on public.user_profiles;
create policy "profiles_insert_own" on public.user_profiles for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "profiles_update_own" on public.user_profiles;
create policy "profiles_update_own" on public.user_profiles for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "profiles_delete_own" on public.user_profiles;
create policy "profiles_delete_own" on public.user_profiles for delete to authenticated
  using (auth.uid() = user_id);

-- user_preferences policies
drop policy if exists "preferences_select_own" on public.user_preferences;
create policy "preferences_select_own" on public.user_preferences for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "preferences_insert_own" on public.user_preferences;
create policy "preferences_insert_own" on public.user_preferences for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "preferences_update_own" on public.user_preferences;
create policy "preferences_update_own" on public.user_preferences for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "preferences_delete_own" on public.user_preferences;
create policy "preferences_delete_own" on public.user_preferences for delete to authenticated
  using (auth.uid() = user_id);

-- calendar_sources policies
drop policy if exists "calendars_select_own" on public.calendar_sources;
create policy "calendars_select_own" on public.calendar_sources for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "calendars_insert_own" on public.calendar_sources;
create policy "calendars_insert_own" on public.calendar_sources for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "calendars_update_own" on public.calendar_sources;
create policy "calendars_update_own" on public.calendar_sources for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "calendars_delete_own" on public.calendar_sources;
create policy "calendars_delete_own" on public.calendar_sources for delete to authenticated
  using (auth.uid() = user_id);

-- triage_items policies
drop policy if exists "triage_select_own" on public.triage_items;
create policy "triage_select_own" on public.triage_items for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "triage_insert_own" on public.triage_items;
create policy "triage_insert_own" on public.triage_items for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "triage_update_own" on public.triage_items;
create policy "triage_update_own" on public.triage_items for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "triage_delete_own" on public.triage_items;
create policy "triage_delete_own" on public.triage_items for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.user_profiles to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, update, delete on public.calendar_sources to authenticated;
grant select, insert, update, delete on public.triage_items to authenticated;

-- Keep updated_at honest.
create or replace function public.briefr_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_updated_at on public.user_profiles;
create trigger user_profiles_updated_at before update on public.user_profiles
  for each row execute function public.briefr_set_updated_at();
drop trigger if exists user_preferences_updated_at on public.user_preferences;
create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function public.briefr_set_updated_at();
drop trigger if exists calendar_sources_updated_at on public.calendar_sources;
create trigger calendar_sources_updated_at before update on public.calendar_sources
  for each row execute function public.briefr_set_updated_at();
drop trigger if exists triage_items_updated_at on public.triage_items;
create trigger triage_items_updated_at before update on public.triage_items
  for each row execute function public.briefr_set_updated_at();

-- New auth users get a profile and a preference row automatically.
create or replace function public.briefr_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), coalesce(new.email, ''))
  on conflict (user_id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.briefr_handle_new_user();

-- Lets a signed-in user delete every owned row and their auth user without a service key.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.triage_items where user_id = auth.uid();
  delete from public.calendar_sources where user_id = auth.uid();
  delete from public.user_preferences where user_id = auth.uid();
  delete from public.user_profiles where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
