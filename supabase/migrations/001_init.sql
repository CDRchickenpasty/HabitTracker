-- Habit Tracker v2 — optional cloud sync schema
-- Run in the Supabase SQL editor (or via supabase db push).

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  version int not null default 2,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  client_id text
);

create table if not exists public.focus_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  completed_at timestamptz not null,
  local_date date not null,
  planned_minutes int not null check (planned_minutes > 0),
  todo_text text,
  unique (user_id, id)
);

create index if not exists focus_sessions_user_date_idx
  on public.focus_sessions (user_id, local_date desc);

alter table public.profiles enable row level security;
alter table public.app_state enable row level security;
alter table public.focus_sessions enable row level security;

create policy "profiles_own"
  on public.profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "app_state_own"
  on public.app_state for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "focus_sessions_own"
  on public.focus_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;

  -- Auto-confirm so mailer can send magic-link style OTPs (default Supabase
  -- confirmation links are often prefetched/spam-filtered).
  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now())
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger-only: do not expose via PostgREST RPC
revoke execute on function public.handle_new_user() from anon, authenticated, public;
