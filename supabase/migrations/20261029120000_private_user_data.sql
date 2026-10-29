/*
  Kinly — private, per-user data tables.

  Every row belongs to one signed-in user (user_id = auth.uid()). Row Level Security lets each
  person read and change only their own rows; visitors who are not signed in (the anon role)
  get no access at all. Rows are deleted automatically when the user's account is deleted.

  Text ids are kept so that existing browser data (ids such as "dinner-at-lupa" or random
  UUID strings) can later be copied across without renaming anything.

  Nothing in the app reads or writes these tables yet. Apply this, run
  supabase/tests/rls_check.sql, and only then build syncing.
*/

-- Keeps updated_at current on every change.
create or replace function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 80),
  pronouns text not null default '' check (char_length(pronouns) <= 40),
  recharge text not null default '' check (recharge in ('', 'alone', 'one-on-one', 'small-group')),
  free_evenings smallint[] not null default '{}' check (free_evenings <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  quiet_days smallint[] not null default '{}' check (quiet_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  intention text not null default '' check (char_length(intention) <= 200),
  weekly_goal smallint not null default 0 check (weekly_goal between 0 and 10),
  deeper_answers boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.people (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 100),
  name text not null check (char_length(name) between 1 and 120),
  initials text not null default '' check (char_length(initials) <= 4),
  relationship text not null default '' check (char_length(relationship) <= 120),
  detail text not null default '' check (char_length(detail) <= 600),
  note text not null default '' check (char_length(note) <= 2000),
  color text not null default '#526579' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.plans (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 100),
  title text not null check (char_length(title) between 1 and 200),
  plan_date date not null,
  plan_time time not null,
  person_id text,
  category text not null default 'Personal' check (char_length(category) <= 40),
  context text not null default '' check (char_length(context) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  -- Deleting a person keeps the plan and clears the link, as the app does today.
  foreign key (user_id, person_id) references public.people (user_id, id) on delete set null (person_id)
);

create table public.goals (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 100),
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  category text not null default 'Relationships' check (char_length(category) <= 40),
  status text not null default 'active' check (status in ('active', 'completed')),
  month_start date not null default date_trunc('month', current_date)::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.reflections (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 100),
  text text not null check (char_length(text) between 1 and 10000),
  person_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, person_id) references public.people (user_id, id) on delete set null (person_id)
);

create table public.checkins (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  energy text check (energy in ('low', 'okay', 'good')),
  social text check (social in ('company', 'quiet')),
  free_tonight boolean,
  mood text not null default '' check (char_length(mood) <= 40),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create index plans_user_date_idx on public.plans (user_id, plan_date);
create index plans_user_person_idx on public.plans (user_id, person_id);
create index reflections_user_person_idx on public.reflections (user_id, person_id);
create index goals_user_status_idx on public.goals (user_id, status);

-- updated_at triggers, Row Level Security and owner-only policies for every table.
do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'people', 'plans', 'goals', 'reflections', 'checkins'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, public', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy "Owners can read their rows" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "Owners can add their rows" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "Owners can change their rows" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "Owners can delete their rows" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;
