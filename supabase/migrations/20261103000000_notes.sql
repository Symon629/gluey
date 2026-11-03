-- Notes for each signed-in user. Run this in the Supabase SQL editor
-- (or with `supabase db push` if you use the Supabase CLI).

create table if not exists public.notes (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null default 'Untitled',
  content     text not null default '',
  -- Sub-notes. Deleting a note deletes everything nested inside it.
  parent_id   text references public.notes (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists notes_user_updated_idx on public.notes (user_id, updated_at desc);
create index if not exists notes_parent_idx on public.notes (parent_id);

-- Row level security: the app ships with the public (publishable) key, so these
-- policies are what stop one user from reading or changing another user's notes.
alter table public.notes enable row level security;

create policy "Users read their own notes" on public.notes
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users add their own notes" on public.notes
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Users edit their own notes" on public.notes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users delete their own notes" on public.notes
  for delete to authenticated using ((select auth.uid()) = user_id);
