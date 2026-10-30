/*
  Kinly — plans, subscriptions and AI credits.

  Every account gets a subscription row, Free by default, created by a trigger when the account
  is created (existing accounts are backfilled below). People can read their own subscription,
  events and AI usage, but cannot change any of it: plan changes come only from the server
  (a future Razorpay webhook using a server-side key) or the database owner.

  AI credits are metered by two functions that the server calls with the person's own session:
    ai_begin  — checks the plan and remaining credits and records a pending request. It locks the
                person's subscription row, so simultaneous requests are counted one at a time.
    ai_finish — marks that request succeeded (credits count) or failed (credits never count).
  ai_finish needs a one-time secret that only the server knows, so nobody can mark a request
  failed after receiving the answer. Pending requests count towards the limit for 5 minutes, so
  firing many at once can't overspend; if the server never finishes one, it stops counting.

  Plus allowance: 20 credits per credit month. Credit months start on the subscription's
  current_period_start and repeat monthly, so monthly and annual plans both reset monthly.
*/

alter table public.people add column archived boolean not null default false;

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'plus')),
  status text not null default 'active' check (status in ('active', 'trial', 'pending', 'cancelled', 'expired')),
  billing_interval text check (billing_interval in ('month', 'year')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  provider text check (provider in ('razorpay', 'manual')),
  provider_subscription_id text check (char_length(provider_subscription_id) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A paid plan always knows its billing period; Free never has one.
  check (
    (plan = 'free' and billing_interval is null and current_period_start is null and current_period_end is null)
    or (plan = 'plus' and billing_interval is not null and current_period_start is not null and current_period_end > current_period_start)
  )
);

create table public.subscription_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null check (char_length(event_type) <= 60),
  plan text check (plan in ('free', 'plus')),
  status text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (feature in ('reflection', 'conversation_prep', 'decision_analysis', 'relationship_analysis', 'weekly_review')),
  credits_used smallint not null check (credits_used between 1 and 10),
  request_status text not null default 'pending' check (request_status in ('pending', 'succeeded', 'failed')),
  token_hash text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index subscription_events_user_idx on public.subscription_events (user_id, created_at desc);
create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);

create trigger set_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();

-- Read-only for owners. No insert, update or delete grants: the browser can't change plans or usage.
alter table public.subscriptions enable row level security;
alter table public.subscription_events enable row level security;
alter table public.ai_usage enable row level security;
revoke all on public.subscriptions, public.subscription_events, public.ai_usage from anon, public, authenticated;
grant select on public.subscriptions, public.subscription_events to authenticated;
-- token_hash is left out, so the one-time secret's hash is never readable.
grant select (id, user_id, feature, credits_used, request_status, created_at, completed_at) on public.ai_usage to authenticated;
create policy "Owners can read their subscription" on public.subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners can read their subscription events" on public.subscription_events for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners can read their AI usage" on public.ai_usage for select to authenticated using ((select auth.uid()) = user_id);

-- New accounts start on Free with an empty profile.
create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.subscription_events (user_id, event_type, plan, status) values (new.id, 'assigned_free', 'free', 'active');
  insert into public.profiles (user_id, name)
    values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 80))
    on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

insert into public.subscriptions (user_id) select id from auth.users on conflict (user_id) do nothing;
insert into public.subscription_events (user_id, event_type, plan, status)
  select id, 'assigned_free', 'free', 'active' from auth.users u
  where not exists (select 1 from public.subscription_events e where e.user_id = u.id);

create or replace function public.ai_feature_cost(p_feature text) returns smallint
language sql
immutable
set search_path = ''
as $$
  select case p_feature
    when 'reflection' then 1
    when 'conversation_prep' then 1
    when 'decision_analysis' then 2
    when 'relationship_analysis' then 2
    when 'weekly_review' then 2
  end::smallint;
$$;

-- The credit month that contains p_at, counted in whole months from the period start.
create or replace function public.ai_credit_window(p_period_start timestamptz, p_at timestamptz default now(), out window_start timestamptz, out window_end timestamptz)
language plpgsql
stable
set search_path = ''
as $$
declare
  months int := greatest(0, (extract(year from age(p_at, p_period_start)) * 12 + extract(month from age(p_at, p_period_start)))::int);
begin
  window_start := p_period_start + make_interval(months => months);
  window_end := p_period_start + make_interval(months => months + 1);
end;
$$;

-- Credits counted against the allowance: succeeded requests, plus pending ones under 5 minutes old.
create or replace function public.ai_credits_counted(p_user uuid, p_from timestamptz, p_to timestamptz, p_include_pending boolean) returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(credits_used), 0)::int from public.ai_usage
  where user_id = p_user and created_at >= p_from and created_at < p_to
    and (request_status = 'succeeded' or (p_include_pending and request_status = 'pending' and created_at > now() - interval '5 minutes'));
$$;
revoke all on function public.ai_credits_counted(uuid, timestamptz, timestamptz, boolean) from public, anon, authenticated;

-- What the signed-in person's plan and credits look like right now. Read-only.
create or replace function public.ai_credit_status() returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sub public.subscriptions;
  win record;
  used int;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  select * into sub from public.subscriptions where user_id = uid;
  if not found or sub.plan <> 'plus' or sub.status not in ('active', 'trial') or sub.current_period_end <= now() then
    return jsonb_build_object('ai_access', false, 'allowance', 0, 'used', 0, 'remaining', 0, 'resets_at', null);
  end if;
  select * into win from public.ai_credit_window(sub.current_period_start);
  used := public.ai_credits_counted(uid, win.window_start, win.window_end, false);
  return jsonb_build_object('ai_access', true, 'allowance', 20, 'used', used, 'remaining', greatest(0, 20 - used), 'resets_at', least(win.window_end, sub.current_period_end));
end;
$$;

create or replace function public.ai_begin(p_feature text, p_token text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cost smallint := public.ai_feature_cost(p_feature);
  sub public.subscriptions;
  win record;
  counted int;
  usage_id uuid;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if cost is null then raise exception 'Unknown AI feature' using errcode = '22023'; end if;
  if p_token is null or char_length(p_token) < 32 then raise exception 'Missing request token' using errcode = '22023'; end if;
  -- Locking the row makes simultaneous requests from the same person wait their turn.
  select * into sub from public.subscriptions where user_id = uid for update;
  if not found or sub.plan <> 'plus' or sub.status not in ('active', 'trial') or sub.current_period_end <= now() then
    return jsonb_build_object('ok', false, 'reason', 'plus_required');
  end if;
  select * into win from public.ai_credit_window(sub.current_period_start);
  counted := public.ai_credits_counted(uid, win.window_start, win.window_end, true);
  if counted + cost > 20 then
    return jsonb_build_object('ok', false, 'reason', 'no_credits', 'remaining', greatest(0, 20 - counted), 'cost', cost, 'resets_at', least(win.window_end, sub.current_period_end));
  end if;
  insert into public.ai_usage (user_id, feature, credits_used, token_hash)
    values (uid, p_feature, cost, encode(sha256(convert_to(p_token, 'UTF8')), 'hex'))
    returning id into usage_id;
  return jsonb_build_object('ok', true, 'usage_id', usage_id, 'cost', cost);
end;
$$;

create or replace function public.ai_finish(p_usage_id uuid, p_token text, p_succeeded boolean) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed int;
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  update public.ai_usage
    set request_status = case when p_succeeded then 'succeeded' else 'failed' end, completed_at = now()
    where id = p_usage_id and user_id = auth.uid() and request_status = 'pending'
      and token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.ai_credit_status(), public.ai_begin(text, text), public.ai_finish(uuid, text, boolean) from public, anon;
grant execute on function public.ai_credit_status(), public.ai_begin(text, text), public.ai_finish(uuid, text, boolean) to authenticated;
revoke all on function public.ai_credit_window(timestamptz, timestamptz), public.ai_feature_cost(text) from public, anon;
