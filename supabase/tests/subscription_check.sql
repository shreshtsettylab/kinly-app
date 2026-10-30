/*
  Checks for supabase/migrations/20261030120000_subscriptions_and_ai_credits.sql.

  Paste into the Supabase SQL editor after applying the migration. It creates two throwaway
  accounts and checks: Free is assigned automatically, nobody can change their own plan or usage,
  Free accounts get no AI, Plus gets 20 credits with the right costs, failed requests cost
  nothing, simultaneous (pending) requests can't overspend, the one-time secret is required,
  credit months reset correctly, and accounts can't see each other's subscriptions or usage.
  Everything runs in one transaction and is rolled back. Every check prints "PASS: …"; any
  failure stops the script with "FAIL: …".
*/
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000a1', 'plan-check-a@example.test', '{"full_name":"Test Person A"}'),
  ('00000000-0000-4000-8000-0000000000b1', 'plan-check-b@example.test', '{}');

do $$
begin
  if (select count(*) from public.subscriptions where user_id in ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1') and plan = 'free' and status = 'active') <> 2 then
    raise exception 'FAIL: new accounts did not get the Free plan';
  end if;
  if (select name from public.profiles where user_id = '00000000-0000-4000-8000-0000000000a1') <> 'Test Person A' then
    raise exception 'FAIL: new account profile was not created';
  end if;
  if (select count(*) from public.subscription_events where user_id = '00000000-0000-4000-8000-0000000000a1' and event_type = 'assigned_free') <> 1 then
    raise exception 'FAIL: the Free assignment was not recorded';
  end if;
  raise notice 'PASS: new accounts start on Free with a profile and an event';
end $$;

-- Act as person A (Free).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

do $$
begin
  if (select plan from public.subscriptions) <> 'free' then raise exception 'FAIL: A cannot read their own subscription'; end if;
  if (public.ai_begin('reflection', repeat('x', 40)) ->> 'reason') <> 'plus_required' then raise exception 'FAIL: a Free account could start an AI request'; end if;
  if (public.ai_credit_status() ->> 'ai_access')::boolean then raise exception 'FAIL: a Free account shows AI access'; end if;
  raise notice 'PASS: Free accounts can read their plan and get no AI requests';
end $$;

do $$
begin
  begin
    update public.subscriptions set plan = 'plus';
    raise exception 'FAIL: A could change their own plan';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.ai_usage (user_id, feature, credits_used, token_hash) values (auth.uid(), 'reflection', 1, 'x');
    raise exception 'FAIL: A could write AI usage directly';
  exception when insufficient_privilege then null;
  end;
  begin
    perform token_hash from public.ai_usage;
    raise exception 'FAIL: A could read request secrets';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: nobody can change their own plan, write usage, or read request secrets';
end $$;

-- The database owner upgrades A to Plus (monthly, started 10 days ago), as a payment webhook would.
reset role;
update public.subscriptions set plan = 'plus', status = 'active', billing_interval = 'month', provider = 'manual',
  current_period_start = now() - interval '10 days', current_period_end = now() + interval '20 days'
  where user_id = '00000000-0000-4000-8000-0000000000a1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

do $$
declare
  r jsonb;
  ok boolean;
begin
  r := public.ai_begin('decision_analysis', 'secret-one-0123456789-0123456789-abc');
  if not (r ->> 'ok')::boolean or (r ->> 'cost')::int <> 2 then raise exception 'FAIL: Plus could not start a decision analysis: %', r; end if;
  if public.ai_finish((r ->> 'usage_id')::uuid, 'wrong-secret-0123456789-0123456789-abc', true) then raise exception 'FAIL: finished a request with the wrong secret'; end if;
  if not public.ai_finish((r ->> 'usage_id')::uuid, 'secret-one-0123456789-0123456789-abc', true) then raise exception 'FAIL: could not finish with the right secret'; end if;
  if public.ai_finish((r ->> 'usage_id')::uuid, 'secret-one-0123456789-0123456789-abc', false) then raise exception 'FAIL: a finished request was changed again'; end if;
  if (public.ai_credit_status() ->> 'used')::int <> 2 then raise exception 'FAIL: decision analysis did not cost 2 credits'; end if;

  r := public.ai_begin('reflection', 'secret-two-0123456789-0123456789-abc');
  ok := public.ai_finish((r ->> 'usage_id')::uuid, 'secret-two-0123456789-0123456789-abc', false);
  if not ok or (public.ai_credit_status() ->> 'used')::int <> 2 then raise exception 'FAIL: a failed request used credits'; end if;
  raise notice 'PASS: costs are right, failed requests are free, and the one-time secret is required';
end $$;

do $$
declare
  r jsonb;
  i int;
begin
  -- Nine requests in flight at once (2 credits each) on top of the 2 already used = 20.
  for i in 1..9 loop
    r := public.ai_begin('weekly_review', 'pending-' || i || '-0123456789-0123456789-abcdef');
    if not (r ->> 'ok')::boolean then raise exception 'FAIL: request % was refused early: %', i, r; end if;
  end loop;
  r := public.ai_begin('reflection', 'one-too-many-0123456789-0123456789-abc');
  if (r ->> 'reason') <> 'no_credits' then raise exception 'FAIL: pending requests let A overspend: %', r; end if;
  if (public.ai_credit_status() ->> 'used')::int <> 2 then raise exception 'FAIL: pending requests were shown as used'; end if;
  raise notice 'PASS: requests in flight count towards the limit, so simultaneous requests cannot overspend';
end $$;

-- Requests the server never finished stop counting after 5 minutes.
reset role;
update public.ai_usage set created_at = now() - interval '6 minutes' where user_id = '00000000-0000-4000-8000-0000000000a1' and request_status = 'pending';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

do $$
declare
  r jsonb;
  i int;
  status jsonb;
begin
  for i in 1..9 loop
    r := public.ai_begin('relationship_analysis', 'done-' || i || '-0123456789-0123456789-abcdef');
    if not (r ->> 'ok')::boolean then raise exception 'FAIL: abandoned requests still blocked credits: %', r; end if;
    perform public.ai_finish((r ->> 'usage_id')::uuid, 'done-' || i || '-0123456789-0123456789-abcdef', true);
  end loop;
  status := public.ai_credit_status();
  if (status ->> 'used')::int <> 20 or (status ->> 'remaining')::int <> 0 then raise exception 'FAIL: expected 20 used, got %', status; end if;
  r := public.ai_begin('conversation_prep', 'exhausted-0123456789-0123456789-abcdef');
  if (r ->> 'reason') <> 'no_credits' then raise exception 'FAIL: exhausted credits still allowed a request'; end if;
  if (r ->> 'resets_at')::timestamptz > now() + interval '21 days' or (r ->> 'resets_at')::timestamptz < now() + interval '19 days' then
    raise exception 'FAIL: reset date is wrong: %', r ->> 'resets_at';
  end if;
  raise notice 'PASS: Plus gets exactly 20 credits, then requests stop until the reset date';
end $$;

-- Person B can see none of A's subscription or usage, and is still Free.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.subscriptions) <> 1 or (select plan from public.subscriptions) <> 'free' then raise exception 'FAIL: B sees someone else''s subscription'; end if;
  if (select count(*) from public.ai_usage) <> 0 or (select count(*) from public.subscription_events where user_id <> auth.uid()) <> 0 then raise exception 'FAIL: B sees A''s usage or events'; end if;
  if (public.ai_begin('reflection', repeat('y', 40)) ->> 'reason') <> 'plus_required' then raise exception 'FAIL: B got AI without Plus'; end if;
  raise notice 'PASS: accounts cannot see each other''s subscriptions, events or usage';
end $$;

-- Signed-out visitors get nothing.
reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from public.subscriptions;
    raise exception 'FAIL: signed-out visitors can read subscriptions';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.ai_credit_status();
    raise exception 'FAIL: signed-out visitors can call the credit functions';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: signed-out visitors cannot read plans or call the credit functions';
end $$;

-- Annual plans reset credits monthly; expired plans lose AI access but nothing else.
reset role;
do $$
declare
  w record;
begin
  select * into w from public.ai_credit_window('2026-01-15 10:00+00', '2026-03-20 09:00+00');
  if w.window_start <> '2026-03-15 10:00+00' or w.window_end <> '2026-04-15 10:00+00' then raise exception 'FAIL: credit month is wrong: % to %', w.window_start, w.window_end; end if;
  select * into w from public.ai_credit_window('2026-01-15 10:00+00', '2026-03-15 09:59+00');
  if w.window_start <> '2026-02-15 10:00+00' then raise exception 'FAIL: credit month boundary is wrong: %', w.window_start; end if;
  update public.subscriptions set current_period_start = now() - interval '40 days', current_period_end = now() - interval '10 days' where user_id = '00000000-0000-4000-8000-0000000000a1';
  raise notice 'PASS: credit months start on the billing anniversary each month';
end $$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
do $$
begin
  if (public.ai_begin('reflection', repeat('z', 40)) ->> 'reason') <> 'plus_required' then raise exception 'FAIL: an expired plan still allowed AI'; end if;
  if (select count(*) from public.ai_usage) = 0 then raise exception 'FAIL: usage history disappeared'; end if;
  raise notice 'PASS: an expired plan stops AI requests and keeps the usage history';
end $$;

rollback;
