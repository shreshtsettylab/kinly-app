/*
  Row Level Security check for Kinly's private tables.

  Paste into the Supabase SQL editor and run it after applying
  supabase/migrations/20261029120000_private_user_data.sql.
  It creates two throwaway users, acts as each in turn, and checks that neither can see,
  change, delete or forge the other's data, and that signed-out visitors get nothing.
  Everything runs in one transaction and is rolled back, so it leaves no trace.

  Every check prints "PASS: …". Any failure stops the script with "FAIL: …".
*/
begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'rls-check-a@example.test'),
  ('00000000-0000-4000-8000-00000000000b', 'rls-check-b@example.test');

-- Act as user A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

insert into public.profiles (name) values ('Person A');
insert into public.people (id, name, initials, relationship, note) values ('p1', 'Maya Chen', 'MC', 'Close friend', 'Private note');
insert into public.plans (id, title, plan_date, plan_time, person_id) values ('pl1', 'Dinner', current_date + 1, '19:00', 'p1');
insert into public.goals (id, title) values ('g1', 'Call family weekly');
insert into public.reflections (id, text, person_id) values ('r1', 'A private reflection', 'p1');
insert into public.checkins (date, energy) values (current_date, 'low');

do $$
begin
  if (select count(*) from public.people) <> 1 or (select count(*) from public.reflections) <> 1 then
    raise exception 'FAIL: user A cannot see their own rows';
  end if;
  if (select user_id from public.people where id = 'p1') <> '00000000-0000-4000-8000-00000000000a' then
    raise exception 'FAIL: user_id was not filled in from the session';
  end if;
  raise notice 'PASS: user A can read their own rows, and user_id comes from the session';
end $$;

-- Act as user B.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

do $$
declare
  visible int;
begin
  select (select count(*) from public.profiles) + (select count(*) from public.people) + (select count(*) from public.plans)
       + (select count(*) from public.goals) + (select count(*) from public.reflections) + (select count(*) from public.checkins)
    into visible;
  if visible <> 0 then raise exception 'FAIL: user B can see % of user A''s rows', visible; end if;
  raise notice 'PASS: user B sees none of user A''s rows';
end $$;

do $$
declare
  changed int;
begin
  update public.people set note = 'changed by B' where id = 'p1';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'FAIL: user B changed user A''s person'; end if;
  delete from public.reflections where id = 'r1';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'FAIL: user B deleted user A''s reflection'; end if;
  raise notice 'PASS: user B cannot change or delete user A''s rows';
end $$;

do $$
begin
  begin
    insert into public.people (user_id, id, name) values ('00000000-0000-4000-8000-00000000000a', 'forged', 'Forged');
    raise exception 'FAIL: user B wrote a row into user A''s data';
  exception when insufficient_privilege then
    raise notice 'PASS: user B cannot write rows for user A';
  end;
end $$;

do $$
begin
  begin
    -- Try to take over one of A's rows by changing its owner.
    insert into public.people (id, name) values ('p-b', 'B''s person');
    update public.people set user_id = '00000000-0000-4000-8000-00000000000a' where id = 'p-b';
    raise exception 'FAIL: user B moved a row into user A''s data';
  exception when insufficient_privilege then
    raise notice 'PASS: user B cannot reassign rows to user A';
  end;
end $$;

-- Act as a signed-out visitor.
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  begin
    perform count(*) from public.people;
    raise exception 'FAIL: signed-out visitors can read people';
  exception when insufficient_privilege then
    raise notice 'PASS: signed-out visitors cannot read anything';
  end;
end $$;

-- User A's data is still intact after all of B's attempts.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

do $$
begin
  if (select note from public.people where id = 'p1') <> 'Private note' or (select count(*) from public.reflections) <> 1 then
    raise exception 'FAIL: user A''s data was altered';
  end if;
  raise notice 'PASS: user A''s data is unchanged';
end $$;

-- Deleting a person keeps their plan and reflection but clears the link.
do $$
begin
  delete from public.people where id = 'p1';
  if (select person_id from public.plans where id = 'pl1') is not null or (select person_id from public.reflections where id = 'r1') is not null then
    raise exception 'FAIL: deleting a person did not clear links';
  end if;
  raise notice 'PASS: deleting a person keeps plans and reflections and clears the link';
end $$;

rollback;
