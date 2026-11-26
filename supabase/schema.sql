-- Briefr cloud preferences. Run this in the Supabase SQL editor.
-- Only non-secret preferences and public calendar identifiers are stored here.
-- BYOK API keys and calendar tokens stay in the browser.

create table if not exists public.briefr_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.briefr_preferences enable row level security;

drop policy if exists "Read own preferences" on public.briefr_preferences;
create policy "Read own preferences"
  on public.briefr_preferences for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Insert own preferences" on public.briefr_preferences;
create policy "Insert own preferences"
  on public.briefr_preferences for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Update own preferences" on public.briefr_preferences;
create policy "Update own preferences"
  on public.briefr_preferences for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Delete own preferences" on public.briefr_preferences;
create policy "Delete own preferences"
  on public.briefr_preferences for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.briefr_preferences to authenticated;

-- Lets a signed-in user delete their own auth account without a service-role key.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.briefr_preferences where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
