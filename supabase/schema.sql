-- Daybook database. Paste this whole file into Supabase > SQL Editor and press Run.
-- Safe to run more than once.

create table if not exists public.items (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  id         text        not null,
  type       text        not null check (type in ('event','list','settings')),
  data       jsonb       not null default '{}'::jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists items_user_updated on public.items (user_id, updated_at);

-- The server stamps every change, so devices can ask "what changed since…"
create or replace function public.daybook_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists items_touch on public.items;
create trigger items_touch before insert or update on public.items
for each row execute function public.daybook_touch();

-- Each signed-in person can only ever see and change their own rows.
alter table public.items enable row level security;

drop policy if exists "items_select_own" on public.items;
drop policy if exists "items_insert_own" on public.items;
drop policy if exists "items_update_own" on public.items;
drop policy if exists "items_delete_own" on public.items;
create policy "items_select_own" on public.items for select to authenticated using (auth.uid() = user_id);
create policy "items_insert_own" on public.items for insert to authenticated with check (auth.uid() = user_id);
create policy "items_update_own" on public.items for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "items_delete_own" on public.items for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.items to authenticated;
revoke all on public.items from anon;

-- Live updates between devices.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items'
  ) then
    alter publication supabase_realtime add table public.items;
  end if;
end $$;
