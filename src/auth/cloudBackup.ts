import type { SupabaseClient } from '@supabase/supabase-js';
import { peekLocalCollection } from '../lib/storage';

// One-way, explicit copy of this browser's Kinly data into the signed-in user's private tables.
// Browser data is only read, never changed. Re-running is safe: rows are matched by id and
// updated, so nothing is duplicated.

type Row = Record<string, unknown>;
export type BackupRows = { profile: Row | null; people: Row[]; plans: Row[]; goals: Row[]; reflections: Row[]; checkins: Row[]; skipped: number };
export type Counts = { people: number; plans: number; goals: number; reflections: number; checkins: number };

const str = (value: unknown, max: number) => (typeof value === 'string' ? value : '').slice(0, max);
const isDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isTime = (value: unknown): value is string => typeof value === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(value);
const weekdays = (value: unknown) => (Array.isArray(value) ? [...new Set(value.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))] : []);
const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | null => (allowed.includes(value as T) ? (value as T) : null);
const obj = (value: unknown): Row => (value && typeof value === 'object' ? (value as Row) : {});

// Turns what is saved in the browser into rows that satisfy the database rules. Items missing
// their essentials (an id, a name, a title, a date) are skipped and counted, never guessed.
export function buildBackupRows(userId: string): BackupRows {
  let skipped = 0;
  const keep = <T>(row: T | null) => { if (!row) skipped++; return row; };

  const people = peekLocalCollection('people').map(obj).map((p) => keep(str(p.id, 100) && str(p.name, 120).trim() ? {
    user_id: userId, id: str(p.id, 100), name: str(p.name, 120).trim(), initials: str(p.initials, 4), relationship: str(p.relationship, 120),
    detail: str(p.detail, 600), note: str(p.note, 2000), color: /^#[0-9A-Fa-f]{6}$/.test(str(p.color, 7)) ? str(p.color, 7) : '#526579',
  } : null)).filter((row): row is NonNullable<typeof row> => row !== null);
  const personIds = new Set(people.map((p) => p.id));
  // A link to someone who has since been deleted becomes "no one", as it does in the app.
  const personLink = (value: unknown) => (typeof value === 'string' && personIds.has(value) ? value : null);

  const plans = peekLocalCollection('plans').map(obj).map((p) => keep(str(p.id, 100) && str(p.title, 200).trim() && isDate(p.plan_date) && isTime(p.plan_time) ? {
    user_id: userId, id: str(p.id, 100), title: str(p.title, 200).trim(), plan_date: p.plan_date, plan_time: p.plan_time,
    person_id: personLink(p.person_id), category: str(p.category, 40) || 'Personal', context: str(p.context, 2000),
  } : null)).filter((row): row is NonNullable<typeof row> => row !== null);

  const goals = peekLocalCollection('goals').map(obj).map((g) => keep(str(g.id, 100) && str(g.title, 200).trim() ? {
    user_id: userId, id: str(g.id, 100), title: str(g.title, 200).trim(), description: str(g.description, 2000),
    category: str(g.category, 40) || 'Relationships', status: oneOf(g.status, ['active', 'completed'] as const) ?? 'active',
    ...(isDate(g.month_start) ? { month_start: g.month_start } : {}),
  } : null)).filter((row): row is NonNullable<typeof row> => row !== null);

  const reflections = peekLocalCollection('reflections').map(obj).map((r) => keep(str(r.id, 100) && str(r.text, 10000).trim() && !Number.isNaN(Date.parse(str(r.created_at, 40))) ? {
    user_id: userId, id: str(r.id, 100), text: str(r.text, 10000), created_at: new Date(str(r.created_at, 40)).toISOString(), person_id: personLink(r.person_id),
  } : null)).filter((row): row is NonNullable<typeof row> => row !== null);

  const checkins = peekLocalCollection('checkins').map(obj).map((c) => keep(isDate(c.date) ? {
    user_id: userId, date: c.date, energy: oneOf(c.energy, ['low', 'okay', 'good'] as const), social: oneOf(c.social, ['company', 'quiet'] as const),
    free_tonight: typeof c.freeTonight === 'boolean' ? c.freeTonight : null, mood: str(c.mood, 40),
  } : null)).filter((row): row is NonNullable<typeof row> => row !== null);

  const localProfile = obj(peekLocalCollection('profile')[0]);
  const settings = obj(peekLocalCollection('settings')[0]);
  const weeklyGoal = Number(localProfile.weeklyGoal);
  const profile = Object.keys(localProfile).length || Object.keys(settings).length ? {
    user_id: userId, name: str(localProfile.name, 80), pronouns: str(localProfile.pronouns, 40),
    recharge: oneOf(localProfile.recharge, ['', 'alone', 'one-on-one', 'small-group'] as const) ?? '',
    free_evenings: weekdays(localProfile.freeEvenings), quiet_days: weekdays(localProfile.quietDays), intention: str(localProfile.intention, 200),
    weekly_goal: Number.isInteger(weeklyGoal) && weeklyGoal >= 0 && weeklyGoal <= 10 ? weeklyGoal : 0, deeper_answers: settings.deeperAnswers === true,
  } : null;

  return { profile, people, plans, goals, reflections, checkins, skipped };
}

export const localCounts = (rows: BackupRows): Counts => ({ people: rows.people.length, plans: rows.plans.length, goals: rows.goals.length, reflections: rows.reflections.length, checkins: rows.checkins.length });

const tableNames: Record<keyof Counts | 'profiles', string> = { profiles: 'your profile', people: 'people', plans: 'plans', goals: 'goals', reflections: 'reflections', checkins: 'check-ins' };

export class BackupStepError extends Error {
  constructor(public step: string, public original: unknown) {
    super(`Couldn’t copy ${step}.`);
  }
}

// People go first so that plans and reflections can link to them.
export async function uploadBackup(client: SupabaseClient, rows: BackupRows): Promise<void> {
  const steps: [keyof typeof tableNames, Row[], string][] = [
    ['profiles', rows.profile ? [rows.profile] : [], 'user_id'],
    ['people', rows.people, 'user_id,id'],
    ['plans', rows.plans, 'user_id,id'],
    ['goals', rows.goals, 'user_id,id'],
    ['reflections', rows.reflections, 'user_id,id'],
    ['checkins', rows.checkins, 'user_id,date'],
  ];
  for (const [table, values, onConflict] of steps) {
    if (!values.length) continue;
    const { error } = await client.from(table).upsert(values, { onConflict });
    if (error) throw new BackupStepError(tableNames[table], error);
  }
}

// Asks the database what this account holds. Row Level Security limits counts to the user's own rows.
export async function accountCounts(client: SupabaseClient): Promise<Counts> {
  const tables: (keyof Counts)[] = ['people', 'plans', 'goals', 'reflections', 'checkins'];
  const results = await Promise.all(tables.map((table) => client.from(table).select('*', { count: 'exact', head: true })));
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
  return Object.fromEntries(tables.map((table, index) => [table, results[index].count ?? 0])) as Counts;
}

export function describeCounts(counts: Counts): string {
  const parts = ([['people', 'person', 'people'], ['plans', 'plan', 'plans'], ['goals', 'goal', 'goals'], ['reflections', 'reflection', 'reflections'], ['checkins', 'check-in', 'check-ins']] as const)
    .map(([key, one, many]) => `${counts[key]} ${counts[key] === 1 ? one : many}`);
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
