import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Command,
  Download,
  Edit3,
  Home,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { AccountCard } from './auth/AccountCard';
import { BackupCard } from './auth/BackupCard';
import { Link } from './Link';
import { createLocalId, readLocalCollection, removeLocalCollection, writeLocalCollection } from './lib/storage';
import { people as seedPeople, type Person as SeedPerson } from './mockData';
import { AiPanel, SubscriptionCard, UpgradeNotice } from './plan/PlanParts';
import { asksForWords, findSituation, generalLines, minutesIn } from './scripts';
import { FREE_LIMITS, FREE_QUESTIONS_PER_MONTH, fmtLongDate, usePlan, type LimitKind, type NoticeKind } from './subscription';

type Page = 'home' | 'people' | 'person' | 'plans' | 'reflections' | 'goals' | 'settings' | 'you';
// Archived people stay saved, with their history, but don't count towards the Free limit.
type Person = Omit<SeedPerson, 'id'> & { id: string; archived?: boolean };
type Plan = { id: string; title: string; plan_date: string; plan_time: string; person_id: string | null; category: string; context: string };
type Goal = { id: string; title: string; description: string; category: string; status: 'active' | 'completed'; month_start: string };
type Reflection = { id: string; text: string; created_at: string; person_id?: string | null };
type Modal = 'person' | 'plan' | 'goal' | null;
type DecisionOption = { label: string; detail: string; evidence: string };
type Memory = { label: string; date: string; text: string };
type Glance = { label: string; value: string };
type Verdict = { tone: 'go' | 'hold' | 'maybe' | 'info'; headline: string; reason: string };
type Feeling = { tone: 'positive' | 'negative' | 'mixed' | 'neutral'; label: string; excerpt: string; date: string };
type PersonInsight = { upcoming: Plan[]; past: Plan[]; reflections: Reflection[]; next?: Plan; last?: Plan; feeling?: Feeling };
type Energy = 'low' | 'okay' | 'good' | null;
type Social = 'company' | 'quiet' | null;
type Recharge = 'alone' | 'one-on-one' | 'small-group' | '';
// Weekdays are stored as numbers, 0 = Sunday … 6 = Saturday, matching Date.getDay().
type Profile = { name: string; pronouns: string; recharge: Recharge; freeEvenings: number[]; intention: string; weeklyGoal: number; quietDays: number[] };
type CheckIn = { date: string; energy: Energy; social: Social; freeTonight: boolean | null; mood: string };
type DayContext = { energy: Energy; social: Social; freeTonight: boolean | null; quietToday: boolean; recharge: Recharge; freeEvenings: number[]; intention: string };
type DecisionResult = {
  kind: 'decide' | 'recall' | 'when' | 'cancel' | 'talk' | 'who' | 'say';
  verdict: Verdict;
  glance: Glance[];
  summary: string;
  memories: Memory[];
  options: DecisionOption[];
  reasonsToMeet: string[];
  reasonsToPostpone: string[];
  reasonsToGatherMore: string[];
  tradeoffs: string[];
  followUp: string | null;
  matchedPeople: Person[];
  matchedPlans: Plan[];
} | null;

const reflectionPrompts = [
  'What felt meaningful today?',
  'What drained my energy, and what restored it?',
  'Who did I feel close to, and who did I miss?',
];

function fmtDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

const pad = (value: number) => String(value).padStart(2, '0');

// "19:00" → "7:00 PM"
function fmtTime(time: string): string {
  return new Date(`2000-01-01T${time.slice(0, 5)}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Dates are compared in the user's own time zone, not UTC.
function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function daysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function planMoment(plan: Plan): string {
  return `${plan.plan_date}T${plan.plan_time.slice(0, 5)}`;
}

function isUpcoming(plan: Plan): boolean {
  const now = new Date();
  return planMoment(plan) >= `${localDateKey(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

const bySoonest = (a: Plan, b: Plan) => planMoment(a).localeCompare(planMoment(b));
const byNewest = (a: Reflection, b: Reflection) => b.created_at.localeCompare(a.created_at);

function daysUntil(dateKey: string): number {
  return Math.round((new Date(`${dateKey}T12:00:00`).getTime() - new Date(`${localDateKey()}T12:00:00`).getTime()) / 86400000);
}

function relativeDay(dateKey: string): string {
  const days = daysUntil(dateKey);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

const reflectionDate = (reflection: Reflection) => fmtDate(localDateKey(new Date(reflection.created_at)));
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

// Everyday words that would otherwise match almost any saved note.
const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'about', 'that', 'this', 'what', 'when', 'where', 'which', 'who', 'why', 'how', 'did', 'does', 'should', 'would', 'could', 'can', 'will', 'was', 'were', 'are', 'have', 'has', 'had', 'last', 'next', 'tonight', 'today', 'tomorrow', 'into', 'them', 'they', 'their', 'her', 'his', 'him', 'she', 'you', 'your', 'our', 'not', 'but', 'any', 'some', 'just', 'feel', 'think', 'want', 'need', 'get']);

const wordsOf = (text: string): string[] => text.toLowerCase().match(/[a-z0-9']+/g) || [];

// A simple, transparent feeling check: counts warm and draining words in a reflection.
const warmWords = new Set(['good', 'great', 'lovely', 'happy', 'warm', 'close', 'fun', 'easy', 'calm', 'relaxed', 'relaxing', 'enjoyed', 'enjoyable', 'grateful', 'thankful', 'laughed', 'laughing', 'meaningful', 'nourishing', 'restored', 'restorative', 'energised', 'energized', 'energising', 'energizing', 'connected', 'peaceful', 'glad', 'wonderful', 'supported', 'comfortable']);
const drainingWords = new Set(['drained', 'draining', 'tired', 'exhausted', 'exhausting', 'rushed', 'stressed', 'stressful', 'tense', 'awkward', 'anxious', 'frustrated', 'frustrating', 'sad', 'upset', 'overwhelmed', 'overwhelming', 'argued', 'argument', 'distant', 'heavy', 'hurt', 'annoyed', 'lonely', 'uncomfortable', 'disappointed', 'disappointing']);

function feelingOf(reflection: Reflection): Feeling {
  const words = wordsOf(reflection.text);
  let warm = 0;
  let draining = 0;
  words.forEach((word, index) => {
    const previous = words[index - 1] || '';
    const negated = previous === 'not' || previous === 'never' || previous === 'no' || previous.endsWith("n't");
    if (warmWords.has(word)) { if (negated) draining++; else warm++; }
    if (drainingWords.has(word)) { if (negated) warm++; else draining++; }
  });
  const tone: Feeling['tone'] = warm && draining ? 'mixed' : warm ? 'positive' : draining ? 'negative' : 'neutral';
  const labels = { positive: 'Felt good', negative: 'Felt draining', mixed: 'Felt mixed', neutral: 'No strong feeling noted' };
  const firstSentence = (reflection.text.match(/^[^.!?\n]*[.!?]?/)?.[0] || reflection.text).trim();
  const excerpt = firstSentence.length > 120 ? `${firstSentence.slice(0, 117).trimEnd()}…` : firstSentence;
  return { tone, label: labels[tone], excerpt, date: reflectionDate(reflection) };
}

// Everything Kinly knows about one person: plans before and after today, and reflections about them.
function personInsight(person: Person, plans: Plan[], reflections: Reflection[]): PersonInsight {
  const firstName = person.name.split(' ')[0].toLowerCase();
  const upcoming = plans.filter((plan) => plan.person_id === person.id && isUpcoming(plan)).sort(bySoonest);
  const past = plans.filter((plan) => plan.person_id === person.id && !isUpcoming(plan)).sort((a, b) => bySoonest(b, a));
  const about = reflections.filter((reflection) => reflection.person_id === person.id || wordsOf(reflection.text).includes(firstName)).sort(byNewest);
  return { upcoming, past, reflections: about, next: upcoming[0], last: past[0], feeling: about[0] ? feelingOf(about[0]) : undefined };
}

function glanceFor({ last, next, feeling }: PersonInsight): Glance[] {
  return [
    { label: 'Last time together', value: last ? `${last.title} · ${relativeDay(last.plan_date)}` : 'No past plans saved' },
    { label: 'How you felt', value: feeling ? `${feeling.label} — “${feeling.excerpt}”` : 'No reflections yet' },
    { label: 'Next plan', value: next ? `${next.title} · ${relativeDay(next.plan_date)} at ${fmtTime(next.plan_time)}` : 'Nothing planned yet' },
  ];
}

// Words in a personal intention ("see family more") matched against how each person is described.
const intentionGroups = [
  ['family', 'sibling', 'brother', 'sister', 'parent', 'parents', 'mother', 'father', 'mom', 'mum', 'dad', 'cousin', 'aunt', 'uncle', 'grandparent', 'partner', 'spouse'],
  ['friend', 'friends', 'friendship'],
  ['work', 'colleague', 'colleagues', 'coworker', 'mentor', 'team'],
];

function matchesIntention(person: Person, intention: string): boolean {
  if (!intention.trim()) return false;
  const words = new Set(wordsOf(intention));
  if (wordsOf(person.name).some((part) => part.length > 1 && words.has(part))) return true;
  const described = wordsOf(person.relationship);
  return intentionGroups.some((group) => group.some((word) => words.has(word)) && group.some((word) => described.includes(word)));
}

function nextFreeEvening(freeEvenings: number[]): string | null {
  if (!freeEvenings.length) return null;
  const now = new Date();
  for (let offset = 0; offset < 7; offset++) {
    const weekday = (now.getDay() + offset) % 7;
    if (!freeEvenings.includes(weekday)) continue;
    if (offset === 0) return now.getHours() < 18 ? 'Tonight is usually a free evening for you.' : null;
    return `${weekdayNames[weekday]} is your next usually free evening.`;
  }
  return null;
}

const noDay: DayContext = { energy: null, social: null, freeTonight: null, quietToday: false, recharge: '', freeEvenings: [], intention: '' };

function buildDecision(query: string, people: Person[], plans: Plan[], goals: Goal[], reflections: Reflection[], day: DayContext = noDay): DecisionResult {
  const q = query.toLowerCase().trim();
  if (!q) return null;
  const { energy } = day;
  // Specific intents first (cancel, talking points, who to contact); then "Should I…" decisions,
  // recall ("how did it go") and timing ("when") questions.
  // Asking for words ("what do I say…") comes first; the scripts library answers those.
  const kind: NonNullable<DecisionResult>['kind'] = asksForWords.test(q) ? 'say'
    : /\b(cancel|skip|bail|reschedule|call off)\b/.test(q) ? 'cancel'
    : /\b(talk about|bring up|conversation|discuss|say to|topics?)\b/.test(q) ? 'talk'
      : /\bwho\b/.test(q) ? 'who'
        : /\b(should|shall|worth)\b/.test(q) ? 'decide'
    : /\b(learn|learned|learnt|remember|recall|notes?|reflect\w*|happened|how did|how was)\b/.test(q) ? 'recall'
      : /\b(when|how long)\b/.test(q) ? 'when' : 'decide';
  const when = /\btonight\b/.test(q) ? 'tonight' : /\btoday\b/.test(q) ? 'today' : /\btomorrow\b/.test(q) ? 'tomorrow' : /\bweekend\b/.test(q) ? 'this weekend' : 'right now';
  const questionWords = new Set(wordsOf(q));
  const tokens = [...questionWords].filter((word) => word.length > 2 && !stopWords.has(word));
  const mentions = (text: string) => {
    const words = new Set(wordsOf(text));
    return tokens.some((token) => words.has(token));
  };

  // People named in the question come first; people matched only by their notes follow.
  const isNamed = (person: Person) => q.includes(person.name.toLowerCase()) || wordsOf(person.name).some((part) => part.length > 1 && questionWords.has(part));
  const namedPeople = people.filter(isNamed);
  const matchedPeople = [...namedPeople, ...people.filter((person) => !isNamed(person) && mentions(`${person.relationship} ${person.detail} ${person.note}`))];
  const planMatches = (plan: Plan) => {
    const linked = people.find((person) => person.id === plan.person_id);
    return q.includes(plan.title.toLowerCase()) || mentions(`${plan.title} ${plan.category} ${plan.context} ${linked?.name || ''}`);
  };
  const matchedPlans = plans.filter(planMatches);
  const matchedGoals = goals.filter((goal) => mentions(`${goal.title} ${goal.category} ${goal.description}`));

  const upcoming = plans.filter(isUpcoming).sort(bySoonest);
  const activeGoals = goals.filter((goal) => goal.status === 'active');
  const person = matchedPeople[0];
  const insight = person ? personInsight(person, plans, reflections) : null;
  const personName = person?.name || '';
  const firstName = personName.split(' ')[0];
  const reflectionMemory = (reflection: Reflection): Memory => ({ label: 'Reflection', date: reflectionDate(reflection), text: reflection.text });
  const planMemory = (plan: Plan): Memory => ({ label: plan.title, date: fmtDate(plan.plan_date), text: plan.context || 'No context saved for this plan.' });
  const base = { kind, glance: insight ? glanceFor(insight) : [], summary: '', memories: [] as Memory[], options: [] as DecisionOption[], reasonsToMeet: [] as string[], reasonsToPostpone: [] as string[], reasonsToGatherMore: [] as string[], tradeoffs: [] as string[], followUp: null as string | null, matchedPeople, matchedPlans };

  // --- Say: ready-to-use words for a situation, personalised with what they saved ---
  if (kind === 'say') {
    const situation = findSituation(q);
    const lines = situation ? situation.lines({ name: firstName, minutes: minutesIn(q), when: when === 'right now' ? 'today' : when }) : generalLines(firstName);
    const memories: Memory[] = lines.map((text) => ({ label: 'You could say', date: '', text }));
    if (person?.note) memories.push({ label: `From your note about ${firstName}`, date: '', text: person.note });
    if (insight?.next) memories.push({ label: `Coming up with ${firstName}`, date: relativeDay(insight.next.plan_date), text: insight.next.context ? `${insight.next.title}: ${insight.next.context}` : insight.next.title });
    (situation?.tips ?? ['Keep it short and kind; you can always say more later.']).forEach((tip) => memories.push({ label: 'A gentle tip', date: '', text: tip }));
    const feelingNote = insight?.feeling?.tone === 'negative' ? ` Last time with ${firstName} felt draining, so it’s fine to keep this brief.` : insight?.feeling?.tone === 'positive' ? ` Last time with ${firstName} felt good, so a warm, open tone will fit.` : '';
    const verdict: Verdict = situation
      ? { tone: 'info', headline: situation.headline, reason: `${situation.intro}${feelingNote}` }
      : { tone: 'info', headline: 'A simple way to say it', reason: `There’s no ready-made script for this one, so here’s a shape that works for most hard messages.${feelingNote}` };
    return { ...base, verdict, memories };
  }

  // --- Recall: how did it go, what have I saved? ---
  if (kind === 'recall') {
    const found = insight ? insight.reflections : reflections.filter((reflection) => mentions(reflection.text)).sort(byNewest);
    const pastPlans = insight ? insight.past : matchedPlans.filter((plan) => !isUpcoming(plan));
    const memories = [
      ...(person?.note ? [{ label: 'Your note', date: '', text: person.note }] : []),
      ...found.slice(0, 5).map(reflectionMemory),
      ...pastPlans.slice(0, 3).map(planMemory),
    ];
    const latest = found[0] ? feelingOf(found[0]) : undefined;
    const verdict: Verdict = person
      ? { tone: 'info', headline: latest ? `${latest.label} last time` : `No reflections about ${firstName} yet`, reason: insight?.last ? `Your last plan together was "${insight.last.title}", ${relativeDay(insight.last.plan_date)}.` : `There are no past plans with ${firstName} saved yet.` }
      : { tone: 'info', headline: memories.length ? 'Here is what you saved' : 'Nothing saved about this yet', reason: memories.length ? `${found.length} reflection${found.length === 1 ? '' : 's'} and ${pastPlans.length} past plan${pastPlans.length === 1 ? '' : 's'} match your question.` : 'Try a person’s name, or tap one of the quick questions.' };
    const followUp = found.length || !person ? null : `After your next time with ${firstName}, write a few lines in Reflections and tag them — it will show up here.`;
    return { ...base, verdict, memories, followUp };
  }

  // --- When: last and next time with this person ---
  if (kind === 'when' && insight) {
    const { last, next } = insight;
    const nextLine = next ? `Next up: "${next.title}" on ${fmtDate(next.plan_date)} at ${fmtTime(next.plan_time)}.` : `Nothing is planned with ${firstName} yet.`;
    const verdict: Verdict = last
      ? { tone: 'info', headline: `Last together ${relativeDay(last.plan_date)}`, reason: `"${last.title}" on ${fmtDate(last.plan_date)}. ${nextLine}` }
      : next
        ? { tone: 'info', headline: `Next together ${relativeDay(next.plan_date)}`, reason: `${nextLine} There are no past plans saved.` }
        : { tone: 'info', headline: `No plans with ${firstName} yet`, reason: 'Nothing past or upcoming is saved.' };
    const followUp = next ? null : `Would you like to make time for ${firstName}? Add a plan when it feels right.`;
    return { ...base, verdict, followUp };
  }

  const weekCount = upcoming.filter((plan) => daysUntil(plan.plan_date) <= 7).length;
  const restGoal = activeGoals.find((goal) => goal.category === 'Rest' || goal.category === 'Wellbeing');

  // --- Cancel: should I keep or reschedule a plan? ---
  if (kind === 'cancel') {
    const target = insight?.next || matchedPlans.filter(isUpcoming).sort(bySoonest)[0];
    if (!target) return { ...base, verdict: { tone: 'info', headline: 'Nothing to cancel', reason: person ? `There is no upcoming plan with ${firstName}.` : 'No upcoming plan matches your question.' } };
    const withPerson = people.find((item) => item.id === target.person_id);
    const targetInsight = withPerson ? personInsight(withPerson, plans, reflections) : null;
    const who = withPerson ? withPerson.name.split(' ')[0] : '';
    const keep: string[] = [];
    const drop: string[] = [];
    if (target.context) keep.push(`You saved it with intention: "${target.context}"`);
    if (targetInsight?.feeling?.tone === 'positive') keep.push(`Last time with ${who} felt good.`);
    if (daysUntil(target.plan_date) === 0) keep.push('It is today, so cancelling now may land hard.');
    if (energy === 'good') keep.push('You said your energy is good.');
    if (energy === 'low') drop.push('You said your energy is low.');
    if (day.social === 'quiet') drop.push('You said you want some quiet today.');
    if (day.social === 'company') keep.push('You said you’re up for company today.');
    if (weekCount >= 4) drop.push(`You have ${weekCount} plans in the next 7 days.`);
    if (restGoal) drop.push(`You have a ${restGoal.category.toLowerCase()} goal: "${restGoal.title}".`);
    if (targetInsight?.feeling?.tone === 'negative') drop.push(`Last time with ${who} felt draining.`);
    const score = keep.length - drop.length;
    const verdict: Verdict = score > 0
      ? { tone: 'go', headline: 'Keep the plan', reason: `"${target.title}" is ${relativeDay(target.plan_date)} at ${fmtTime(target.plan_time)}. ${keep[0]}` }
      : score < 0
        ? { tone: 'hold', headline: 'Okay to reschedule', reason: `${drop[0]} Let ${who || 'them'} know early and suggest another time.` }
        : { tone: 'maybe', headline: 'Keep it, but make it lighter', reason: `Rather than cancelling, suggest a shorter version of "${target.title}". Showing up briefly still counts.` };
    return { ...base, glance: targetInsight ? glanceFor(targetInsight) : [{ label: 'When', value: `${fmtDate(target.plan_date)} at ${fmtTime(target.plan_time)}` }], verdict, reasonsToMeet: keep, reasonsToPostpone: drop, followUp: score === 0 && !energy ? 'How is your energy? Tap Low, Okay or Good above for a clearer answer.' : null };
  }

  // --- Talk: what could I bring up with this person? ---
  if (kind === 'talk' && person && insight) {
    const ideas: Memory[] = [];
    if (person.note) ideas.push({ label: 'From your note', date: '', text: person.note });
    if (insight.next?.context) ideas.push({ label: `For ${insight.next.title}`, date: relativeDay(insight.next.plan_date), text: insight.next.context });
    insight.reflections.slice(0, 3).forEach((reflection) => {
      const sentence = reflection.text.split(/(?<=[.!?])\s+/).find((line) => /\b(next time|ask|follow up|remember|mention|check)\b/i.test(line));
      if (sentence) ideas.push({ label: 'From your reflection', date: reflectionDate(reflection), text: sentence.trim() });
    });
    if (insight.last) ideas.push({ label: 'An easy opener', date: '', text: '“How have things been since we last caught up?”' });
    ideas.push({ label: 'A gentle question', date: '', text: '“What has been taking up most of your energy lately?” Then listen more than you advise.' });
    return { ...base, verdict: { tone: 'info', headline: `Ideas for your next talk with ${firstName}`, reason: person.note ? 'Start with what you noted — it shows you remembered.' : 'Drawn from what you have saved, plus a couple of open questions.' }, memories: ideas.slice(0, 5) };
  }

  // --- Who: which person in my circle could use some attention? ---
  if (kind === 'who') {
    const ranked = people
      .map((item) => ({ person: item, insight: personInsight(item, plans, reflections) }))
      .filter((entry) => !entry.insight.next)
      .map((entry) => ({ ...entry, days: entry.insight.last ? -daysUntil(entry.insight.last.plan_date) : null }))
      .sort((a, b) => {
        // Longest gap first; warm connections and people your intention mentions get a nudge up.
        const weight = (entry: typeof a) => (entry.days ?? 30) + (entry.insight.feeling?.tone === 'positive' ? 14 : 0) - (entry.insight.feeling?.tone === 'negative' ? 14 : 0) + (matchesIntention(entry.person, day.intention) ? 20 : 0);
        return weight(b) - weight(a);
      });
    const top = ranked[0];
    if (!top) return { ...base, verdict: { tone: 'info', headline: 'Everyone has something planned', reason: 'You already have an upcoming plan with each person in your circle.' } };
    const name = top.person.name.split(' ')[0];
    const verdict: Verdict = { tone: 'go', headline: `Reach out to ${name}`, reason: top.days !== null ? `It has been ${top.days} days since your last plan together${top.insight.feeling?.tone === 'positive' ? ', and last time felt good' : ''}. A short message is enough.` : `You have nothing saved with ${name} yet — a short message is an easy start.` };
    if (matchesIntention(top.person, day.intention)) verdict.reason += ` It fits your intention: “${day.intention}”.`;
    const glance = ranked.slice(0, 3).map(({ person: item, insight: itemInsight, days }) => ({ label: item.name, value: days !== null ? `Last together ${days} days ago${itemInsight.feeling ? ` · ${lowerFirst(itemInsight.feeling.label)}` : ''}` : 'No time together saved yet' }));
    return { ...base, verdict, glance, matchedPeople: ranked.slice(0, 3).map((entry) => entry.person) };
  }

  const scheduleCount = upcoming.length;
  const reasonsToMeet: string[] = [];
  const reasonsToPostpone: string[] = [];
  const reasonsToGatherMore: string[] = [];
  const tradeoffs: string[] = [];
  const options: DecisionOption[] = [];
  let glance = base.glance;
  let verdict: Verdict;
  let followUp: string | null = null;

  const contextParts: string[] = [];

  if (person && insight) {
    contextParts.push(`${personName} is saved in your circle as "${person.relationship}".`);
    if (person.note) contextParts.push(`Your note about them: "${person.note}"`);
    if (person.detail) contextParts.push(`Context you saved: "${person.detail}"`);
    if (insight.reflections.length) contextParts.push(`You have ${insight.reflections.length} reflection${insight.reflections.length === 1 ? '' : 's'} about ${firstName}; the most recent is from ${reflectionDate(insight.reflections[0])}.`);
    if (insight.upcoming.length) {
      contextParts.push(`You have ${insight.upcoming.length} upcoming plan${insight.upcoming.length === 1 ? '' : 's'} with ${personName}: ${insight.upcoming.map((plan) => `"${plan.title}" on ${fmtDate(plan.plan_date)} at ${fmtTime(plan.plan_time)}`).join('; ')}.`);
    }
    if (insight.past.length) contextParts.push(`You have ${insight.past.length} past plan${insight.past.length === 1 ? '' : 's'} with ${personName}.`);
  }

  if (matchedPlans.length && !person) {
    const plan = matchedPlans[0];
    contextParts.push(`This relates to a saved plan: "${plan.title}" (${plan.category}) on ${fmtDate(plan.plan_date)} at ${fmtTime(plan.plan_time)}.`);
    if (plan.context) contextParts.push(`Plan context: "${plan.context}"`);
  }

  if (matchedGoals.length) {
    const goal = matchedGoals[0];
    contextParts.push(`This connects to your ${goal.status === 'active' ? 'active' : 'completed'} goal: "${goal.title}" (${goal.category}).`);
  }

  if (activeGoals.length) {
    contextParts.push(`Your active monthly ${activeGoals.length === 1 ? 'goal is' : 'goals are'}: ${activeGoals.map((goal) => `"${goal.title}"`).join(', ')}.`);
  }

  if (scheduleCount) {
    contextParts.push(`You have ${scheduleCount} upcoming plan${scheduleCount === 1 ? '' : 's'} in total.`);
  }

  // --- Person-centred decision ---
  if (person && insight) {
    const soon = insight.upcoming.find((plan) => daysUntil(plan.plan_date) <= 3);
    const relationshipGoal = activeGoals.find((goal) => goal.category === 'Relationships');
    const daysSince = insight.last ? -daysUntil(insight.last.plan_date) : null;
    // A message or call does not take up an evening, so a busy week or rest goal should not count against it.
    const lightTouch = /\b(reach out|message|call|text|check in)\b/.test(q);

    // Each saved fact counts once for or against; the verdict follows whichever side has more.
    if (daysSince !== null && daysSince >= 14 && !insight.next) reasonsToMeet.push(`It has been ${daysSince} days since your last plan together.`);
    if (daysSince === null && !insight.next) reasonsToMeet.push(`You have nothing planned with ${firstName}, so there is room to reconnect.`);
    if (insight.feeling?.tone === 'positive') reasonsToMeet.push(`Last time with ${firstName} felt good.`);
    if (relationshipGoal) reasonsToMeet.push(`It supports your goal "${relationshipGoal.title}".`);
    if (soon) reasonsToPostpone.push(`You are already seeing ${firstName} ${relativeDay(soon.plan_date)} ("${soon.title}").`);
    if (weekCount >= 3 && !lightTouch) reasonsToPostpone.push(`You already have ${weekCount} plans in the next 7 days.`);
    if (restGoal && !lightTouch) reasonsToPostpone.push(`You have a ${restGoal.category.toLowerCase()} goal: "${restGoal.title}".`);
    if (insight.feeling?.tone === 'negative') reasonsToPostpone.push(`Last time with ${firstName} felt draining.`);
    if (energy === 'good' && !lightTouch) reasonsToMeet.push('You said your energy is good.');
    if (energy === 'low' && !lightTouch) reasonsToPostpone.push('You said your energy is low.');
    if (day.social === 'company' && !lightTouch) reasonsToMeet.push('You said you’re up for company today.');
    if (day.social === 'quiet' && !lightTouch) reasonsToPostpone.push('You said you want some quiet today.');
    const tonightish = when === 'tonight' || when === 'right now';
    if (day.freeTonight === true && tonightish && !lightTouch) reasonsToMeet.push('You said tonight is free.');
    if (day.freeTonight === false && tonightish && !lightTouch) reasonsToPostpone.push('You said tonight isn’t really free.');
    if (day.quietToday && !lightTouch) reasonsToPostpone.push('Today is one of your quiet days.');
    if (matchesIntention(person, day.intention)) reasonsToMeet.push(`It fits your intention: “${day.intention}”.`);

    const score = reasonsToMeet.length - reasonsToPostpone.length;
    if (score > 0) {
      const freeEvening = lightTouch || soon ? null : nextFreeEvening(day.freeEvenings);
      verdict = { tone: 'go', headline: lightTouch ? 'Yes — reach out' : 'Yes — go for it', reason: [reasonsToMeet[0], reasonsToPostpone[0] && `Just note: ${lowerFirst(reasonsToPostpone[0])}`, freeEvening].filter(Boolean).join(' ') };
    } else if (score < 0) {
      verdict = { tone: 'hold', headline: `Not ${when}`, reason: `${reasonsToPostpone[0]} ${soon ? 'Save your energy for that.' : `Suggest another time with ${firstName} instead.`}` };
    } else {
      verdict = { tone: 'maybe', headline: energy ? 'Either way is fine — your call' : 'Maybe — check your energy', reason: reasonsToMeet.length ? `${reasonsToMeet[0]} But ${lowerFirst(reasonsToPostpone[0])}` : 'Nothing you have saved points strongly either way.' };
      followUp = energy ? null : 'How is your energy right now? Tap Low, Okay or Good above for a clearer answer.';
    }

    if (!person.note && !person.detail) reasonsToGatherMore.push(`You have not saved a note or context for ${personName}. Adding one would make this clearer.`);
    reasonsToGatherMore.push(`Check how you feel ${when} — your saved data cannot tell you your current energy level.`);

    const nextPlan = insight.next;
    if (nextPlan) {
      options.push({ label: 'Keep the existing plan', detail: `You already have "${nextPlan.title}" with ${personName} on ${fmtDate(nextPlan.plan_date)} at ${fmtTime(nextPlan.plan_time)}. Consider whether meeting ${when} is in addition to that or instead of it.`, evidence: `Saved plan: "${nextPlan.title}" on ${fmtDate(nextPlan.plan_date)} at ${fmtTime(nextPlan.plan_time)}.` });
    } else {
      options.push({ label: 'Add a low-pressure plan', detail: day.recharge === 'small-group' ? `Something small with ${personName} and a friend or two this week could keep it light and easy.` : `A short walk or coffee with ${personName} this week could keep the connection warm without overcommitting your week.${day.recharge === 'alone' ? ' Leave some time to yourself afterwards.' : ''}`, evidence: `${personName} has no upcoming plans in your saved data.` });
    }
    options.push({ label: 'Postpone and protect your time', detail: `Hold off and rest. You can reach out to ${personName} when your schedule and energy feel steadier.`, evidence: weekCount >= 3 ? `You have ${weekCount} plans in the next 7 days.` : `No specific plan with ${personName} would be disrupted.` });

    tradeoffs.push(`Meeting ${when} sustains closeness, but if your energy is low it may not feel meaningful to either of you.`);
    tradeoffs.push('Postponing protects your energy, but delays time together.');
    if (nextPlan) tradeoffs.push('Adding a second plan so close to an existing one may dilute the quality of both.');

  // --- Plan-centred decision (no person matched) ---
  } else if (matchedPlans.length) {
    const plan = matchedPlans[0];
    const linkedPerson = people.find((item) => item.id === plan.person_id);
    glance = linkedPerson
      ? glanceFor(personInsight(linkedPerson, plans, reflections))
      : [{ label: 'When', value: `${fmtDate(plan.plan_date)} · ${relativeDay(plan.plan_date)} at ${fmtTime(plan.plan_time)}` }, { label: 'Category', value: plan.category }];

    if (!isUpcoming(plan)) {
      verdict = { tone: 'info', headline: 'That plan has already passed', reason: `"${plan.title}" was ${relativeDay(plan.plan_date)}, on ${fmtDate(plan.plan_date)}.` };
    } else if (plan.context) {
      verdict = { tone: 'go', headline: 'Yes — keep the plan', reason: `It is ${relativeDay(plan.plan_date)} at ${fmtTime(plan.plan_time)}, and you saved it with intention: "${plan.context}"` };
    } else {
      verdict = { tone: 'maybe', headline: 'Probably — if it still feels right', reason: `"${plan.title}" is ${relativeDay(plan.plan_date)} at ${fmtTime(plan.plan_time)}. You did not save why it matters.` };
      followUp = `What has changed since you saved "${plan.title}"? If it still feels right, keep it.`;
    }

    reasonsToMeet.push(`"${plan.title}" is already saved for ${fmtDate(plan.plan_date)} at ${fmtTime(plan.plan_time)}.`);
    if (plan.context) reasonsToMeet.push(`Your saved context: "${plan.context}"`);
    if (linkedPerson) reasonsToMeet.push(`This plan is linked to ${linkedPerson.name}.`);
    if (scheduleCount >= 3) reasonsToPostpone.push(`You have ${scheduleCount} upcoming plans already.`);
    if (!plan.context) reasonsToGatherMore.push('This plan has no saved context. Adding one would clarify whether the timing fits.');
    reasonsToGatherMore.push('Check whether anything else on your calendar conflicts.');

    options.push({ label: 'Go ahead with the saved plan', detail: `"${plan.title}" is already on your calendar for ${fmtDate(plan.plan_date)}. Trust the intention you captured.`, evidence: `Saved plan: "${plan.title}" on ${fmtDate(plan.plan_date)} at ${fmtTime(plan.plan_time)}.` });
    options.push({ label: 'Reconsider the timing', detail: 'Review whether the current slot competes with a rest or wellbeing goal before confirming.', evidence: activeGoals.length ? `Active goals: ${activeGoals.map((goal) => `"${goal.title}"`).join(', ')}.` : 'No active goals saved.' });

    tradeoffs.push('Following through on a saved plan builds trust with yourself.');
    tradeoffs.push('Adjusting now is easier than dragging through a plan that no longer fits.');

  // --- Goal-centred decision ---
  } else if (matchedGoals.length) {
    const goal = matchedGoals[0];
    verdict = goal.status === 'active'
      ? { tone: 'go', headline: 'Yes — take one small step', reason: `It moves your goal "${goal.title}" forward without overcommitting your week.` }
      : { tone: 'info', headline: 'You already completed this goal', reason: `"${goal.title}" is marked as completed.` };
    if (goal.status === 'active' && !goal.description) followUp = `What would one small step toward "${goal.title}" look like?`;

    if (goal.status === 'active') reasonsToMeet.push(`Your active goal "${goal.title}" (${goal.category}) could benefit from a concrete step this week.`);
    reasonsToPostpone.push(`"${goal.title}" is a monthly goal — there is time, and not every day needs to advance it.`);
    options.push({ label: 'Take a small step toward it', detail: `Choose one concrete action this week that moves "${goal.title}" forward.`, evidence: `Goal: "${goal.title}" in ${goal.category}.` });
    options.push({ label: 'Pause and revisit', detail: 'Let the goal sit if your attention is needed elsewhere right now.', evidence: 'Monthly goal — no immediate deadline in your saved data.' });

  // --- Nothing matched ---
  } else if (people.length || plans.length) {
    verdict = { tone: 'info', headline: 'I could not find that yet', reason: 'Nothing you have saved matches this question. Try a person’s name, or tap one of the quick questions.' };
    followUp = 'Is this about someone new? Add them to People so Kinly can help next time.';
    if (upcoming.length) contextParts.push(`Your next upcoming plan is "${upcoming[0].title}" on ${fmtDate(upcoming[0].plan_date)}.`);

  // --- No data at all ---
  } else {
    verdict = { tone: 'info', headline: 'Nothing saved yet', reason: 'Add a person or a plan first, then ask again.' };
  }

  return { ...base, kind, verdict, glance, summary: contextParts.join(' '), memories: insight ? insight.reflections.slice(0, 2).map(reflectionMemory) : [], options, reasonsToMeet, reasonsToPostpone, reasonsToGatherMore, tradeoffs, followUp };
}

const navigation: { id: Page; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'people', label: 'People', icon: Users },
  { id: 'plans', label: 'Plans', icon: CalendarDays },
  { id: 'reflections', label: 'Reflections', icon: BookOpen },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const categories = ['Social', 'Work', 'Family', 'Learning', 'Wellbeing', 'Rest', 'Personal'];
const goalCategories = ['Work', 'Learning', 'Relationships', 'Wellbeing', 'Rest'];
const defaultProfile: Profile = { name: 'Jordan Lee', pronouns: '', recharge: '', freeEvenings: [], intention: '', weeklyGoal: 0, quietDays: [] };
const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];

// Muted, gender-neutral avatar colours that sit with the charcoal and slate palette.
const personColors = ['#526579', '#3A5470', '#2E3C4D', '#4D6474', '#5B6F63', '#7A6A5C'];
const initialsOf = (name: string) => name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
const goalLimitMessage = `Kinly Free keeps up to ${FREE_LIMITS.goals} active goals. Mark one completed first, or explore Kinly Plus for unlimited goals.`;
const planLimitMessage = `Kinly Free keeps up to ${FREE_LIMITS.plans} upcoming plans. Past plans don’t count. Explore Kinly Plus for unlimited plans.`;
const countActive = (goals: { status: string }[]) => goals.filter((goal) => goal.status === 'active').length;
// Fields every saved item must have; used to check backup files before importing them.
const collectionFields = {
  people: ['id', 'name', 'initials', 'relationship', 'color'],
  plans: ['id', 'title', 'plan_date', 'plan_time', 'category'],
  goals: ['id', 'title', 'category', 'status', 'month_start'],
  reflections: ['id', 'text', 'created_at'],
};
type CollectionKey = keyof typeof collectionFields;
const collectionKeys = Object.keys(collectionFields) as CollectionKey[];
const isValidItem = (item: unknown, fields: string[]) => !!item && typeof item === 'object' && fields.every((field) => typeof (item as Record<string, unknown>)[field] === 'string');
const shortcutLabel =/Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl';

function Avatar({ person, size = 'md' }: { person: Person; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  return <div className={`avatar avatar-${size}`} style={{ backgroundColor: person.color }} aria-label={person.name}>{person.initials}</div>;
}

function App() {
  const [page, setPage] = useState<Page>('home');
  const [personId, setPersonId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [presetPersonId, setPresetPersonId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [search, setSearch] = useState('');
  const [question, setQuestion] = useState('');
  const [submittedQuestion, setSubmittedQuestion] = useState('');
  const todayKey = localDateKey();
  const todayCheckIn = checkins.find((checkin) => checkin.date === todayKey);
  const energy = todayCheckIn?.energy ?? null;
  const profileName = profile.name;
  const [aiEnabled, setAiEnabled] = useState(false);
  const plan = usePlan();
  // Shown when someone tries to go past a Free limit; dismissible and never repeated on its own.
  const [limitNotice, setLimitNotice] = useState<NoticeKind | null>(null);
  // Questions asked this calendar month, kept in this browser.
  const [questionUsage, setQuestionUsage] = useState<{ month: string; questions: number }>({ month: '', questions: 0 });
  const [modal, setModal] = useState<Modal>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = () => {
    setLoading(true);
    setError('');
    const loadedPeople = readLocalCollection<Person>('people', seedPeople);
    const mayaId = loadedPeople.find((person) => person.name === 'Maya Chen')?.id || null;
    const seedPlans: Plan[] = [
      { id: 'coffee-with-maya', title: 'Coffee with Maya', plan_date: daysFromToday(-9), plan_time: '09:30', person_id: mayaId, category: 'Social', context: 'She talked through the studio move. Listening helped more than advice.' },
      { id: 'dinner-at-lupa', title: 'Dinner at Lupa', plan_date: daysFromToday(1), plan_time: '19:00', person_id: loadedPeople.find((person) => person.name === 'Maya Chen')?.id || null, category: 'Social', context: 'A chance to catch up without rushing.' },
      { id: 'prospect-park-walk', title: 'Walk in Prospect Park', plan_date: daysFromToday(3), plan_time: '10:30', person_id: loadedPeople.find((person) => person.name === 'Arjun Mehta')?.id || null, category: 'Wellbeing', context: 'Keep the morning unhurried.' },
      { id: 'project-catch-up', title: 'Project catch-up', plan_date: daysFromToday(5), plan_time: '14:00', person_id: loadedPeople.find((person) => person.name === 'Elena Rossi')?.id || null, category: 'Work', context: 'Bring the first draft.' },
    ];
    setPeople(loadedPeople);
    setPlans(readLocalCollection<Plan>('plans', seedPlans));
    setGoals(readLocalCollection<Goal>('goals', []));
    const seedReflections: Reflection[] = [
      { id: 'coffee-with-maya-reflection', text: 'Coffee with Maya felt warm and easy. She needs room to think out loud before she wants suggestions. Next time, ask how the studio move is going and just listen.', created_at: new Date(Date.now() - 9 * 86400000).toISOString(), person_id: mayaId },
    ];
    setReflections(readLocalCollection<Reflection>('reflections', seedReflections));
    setProfile({ ...defaultProfile, ...readLocalCollection<Partial<Profile>>('profile', [defaultProfile])[0] });
    setCheckins(readLocalCollection<CheckIn>('checkins', []));
    setAiEnabled(readLocalCollection<{ deeperAnswers: boolean }>('settings', [{ deeperAnswers: false }])[0]?.deeperAnswers === true);
    setQuestionUsage(readLocalCollection<{ month: string; questions: number }>('usage', [{ month: '', questions: 0 }])[0] ?? { month: '', questions: 0 });
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const navigate = (nextPage: Page) => {
    setPage(nextPage);
    setLimitNotice(null);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const questionRef = useRef<HTMLInputElement>(null);
  const focusQuestion = () => {
    setPage('home');
    setMobileOpen(false);
    // Bring the question section into view and briefly highlight the box, so it's clear where to type.
    requestAnimationFrame(() => {
      const input = questionRef.current;
      if (!input) return;
      input.closest('.ask-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      input.focus({ preventScroll: true });
      const box = input.closest('.question-box');
      box?.classList.remove('question-box-pulse');
      void (box as HTMLElement | null)?.offsetWidth;
      box?.classList.add('question-box-pulse');
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !modal) {
        event.preventDefault();
        focusQuestion();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modal]);

  const filteredPeople = useMemo(() => people.filter((person) => `${person.name} ${person.relationship}`.toLowerCase().includes(search.toLowerCase())), [people, search]);
  const upcomingPlans = useMemo(() => plans.filter(isUpcoming).sort(bySoonest), [plans]);
  const activeGoals = goals.filter((goal) => goal.status === 'active');
  const activePeople = useMemo(() => people.filter((person) => !person.archived), [people]);
  // Free limits count only what is active: people who aren't archived, plans still ahead, goals not completed.
  const activeCounts: Record<LimitKind, number> = { people: activePeople.length, plans: upcomingPlans.length, goals: activeGoals.length };
  const limits = plan.isPlus ? null : FREE_LIMITS;
  const atLimit = (kind: LimitKind) => !!limits && activeCounts[kind] >= limits[kind];

  const savePerson = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    if (!name) return;
    const relationship = String(form.get('relationship') || '').trim() || 'Person in your life';
    const color = String(form.get('color') || '') || personColors[people.length % personColors.length];
    const values = { name, initials: initialsOf(name), relationship, detail: String(form.get('detail') || '').trim(), note: String(form.get('note') || '').trim(), color };
    const nextPeople = editingId
      ? people.map((person) => person.id === editingId ? { ...person, ...values } : person)
      : [...people, { ...values, id: createLocalId() }];
    if (!editingId && atLimit('people')) { setModal(null); setLimitNotice('people'); return; }
    writeLocalCollection('people', nextPeople);
    setModal(null); setEditingId(null); loadData();
  };

  const archivePerson = (id: string, archived: boolean) => {
    if (!archived && atLimit('people')) { setLimitNotice('people'); return; }
    writeLocalCollection('people', people.map((person) => person.id === id ? { ...person, archived } : person));
    setLimitNotice(null);
    loadData();
  };

  const deletePerson = async (id: string) => {
    if (!window.confirm('Remove this person from your directory?')) return;
    const nextPeople = people.filter((person) => person.id !== id);
    writeLocalCollection('people', nextPeople);
    writeLocalCollection('plans', plans.map((plan) => plan.person_id === id ? { ...plan, person_id: null } : plan));
    writeLocalCollection('reflections', reflections.map((reflection) => reflection.person_id === id ? { ...reflection, person_id: null } : reflection));
    if (page === 'person' && personId === id) navigate('people');
    loadData();
  };

  const savePlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') || '').trim();
    const planDate = String(form.get('plan_date') || '');
    const planTime = String(form.get('plan_time') || '');
    if (!title || !planDate || !planTime) return;
    const values = { title, plan_date: planDate, plan_time: planTime, person_id: String(form.get('person_id') || '') || null, category: String(form.get('category') || 'Personal'), context: String(form.get('context') || '').trim() };
    const nextPlans = editingId
      ? plans.map((plan) => plan.id === editingId ? { ...plan, ...values } : plan)
      : [...plans, { ...values, id: createLocalId() }];
    const becomesActive = isUpcoming({ ...values, id: '' }) && !(editingId && upcomingPlans.some((item) => item.id === editingId));
    if (limits && becomesActive && nextPlans.filter(isUpcoming).length > limits.plans) { setError(planLimitMessage); return; }
    writeLocalCollection('plans', nextPlans);
    setModal(null); setEditingId(null); loadData();
  };

  const deletePlan = async (id: string) => {
    if (!window.confirm('Delete this plan?')) return;
    writeLocalCollection('plans', plans.filter((plan) => plan.id !== id));
    loadData();
  };

  const saveGoal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') || '').trim();
    if (!title) return;
    const values = { title, description: String(form.get('description') || '').trim(), category: String(form.get('category') || 'Relationships'), status: String(form.get('status') || 'active') as 'active' | 'completed' };
    const nextGoals = editingId
      ? goals.map((goal) => goal.id === editingId ? { ...goal, ...values } : goal)
      : [...goals, { ...values, id: createLocalId(), month_start: `${localDateKey().slice(0, 7)}-01` }];
    if (limits && countActive(nextGoals) > Math.max(limits.goals, activeGoals.length)) { setError(goalLimitMessage); return; }
    writeLocalCollection('goals', nextGoals);
    setModal(null); setEditingId(null); loadData();
  };

  const deleteGoal = async (id: string) => {
    if (!window.confirm('Delete this goal?')) return;
    writeLocalCollection('goals', goals.filter((goal) => goal.id !== id));
    loadData();
  };

  const toggleGoal = async (goal: Goal) => {
    const nextGoals = goals.map((item) => item.id === goal.id ? { ...item, status: goal.status === 'active' ? 'completed' : 'active' } : item);
    if (limits && goal.status !== 'active' && countActive(nextGoals) > limits.goals) { setLimitNotice('goals'); return; }
    writeLocalCollection('goals', nextGoals);
    loadData();
  };

  const saveReflection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = String(form.get('text') || '').trim();
    if (!text) return;
    const next = [{ id: createLocalId(), text, created_at: new Date().toISOString(), person_id: String(form.get('person_id') || '') || null }, ...reflections];
    writeLocalCollection('reflections', next);
    (event.target as HTMLFormElement).reset();
    loadData();
  };

  const deleteReflection = async (id: string) => {
    if (!window.confirm('Delete this reflection?')) return;
    writeLocalCollection('reflections', reflections.filter((r) => r.id !== id));
    loadData();
  };

  const setDeeperAnswers = (on: boolean): string => {
    writeLocalCollection('settings', [{ deeperAnswers: on }]);
    setAiEnabled(on);
    return on ? 'AI features are on. Nothing is sent until you tap one.' : 'AI features are off. Nothing will be sent to the AI.';
  };

  const saveProfile = (patch: Partial<Profile>) => {
    const next = { ...profile, ...patch };
    writeLocalCollection('profile', [next]);
    setProfile(next);
  };

  // One check-in per day; the newest 90 days are kept so patterns can be drawn from them.
  const updateCheckIn = (patch: Partial<CheckIn>) => {
    const next: CheckIn = { ...(todayCheckIn ?? { date: todayKey, energy: null, social: null, freeTonight: null, mood: '' }), ...patch };
    const list = [...checkins.filter((checkin) => checkin.date !== todayKey), next].sort((a, b) => a.date.localeCompare(b.date)).slice(-90);
    writeLocalCollection('checkins', list);
    setCheckins(list);
  };
  const setEnergy = (value: Energy) => updateCheckIn({ energy: value });

  const day = useMemo<DayContext>(() => ({ energy: todayCheckIn?.energy ?? null, social: todayCheckIn?.social ?? null, freeTonight: todayCheckIn?.freeTonight ?? null, quietToday: profile.quietDays.includes(new Date().getDay()), recharge: profile.recharge, freeEvenings: profile.freeEvenings, intention: profile.intention }), [todayCheckIn, profile]);

  const exportData = (): string => {
    const backup = { app: 'kinly', version: 2, exported_at: new Date().toISOString(), people, plans, goals, reflections, profile: [profile], checkins };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `kinly-backup-${localDateKey()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'Backup downloaded. Keep the file somewhere safe.';
  };

  const importData = async (file: File): Promise<string> => {
    let data: Partial<Record<CollectionKey | 'profile' | 'checkins', unknown>>;
    try {
      data = JSON.parse(await file.text());
    } catch {
      return 'That file could not be read. Choose a Kinly backup (.json) file.';
    }
    const valid = !!data && typeof data === 'object' && collectionKeys.every((key) => Array.isArray(data[key]) && (data[key] as unknown[]).every((item) => isValidItem(item, collectionFields[key])));
    if (!valid) return 'That file does not look like a Kinly backup, so nothing was changed.';
    if (!window.confirm('Replace everything saved in this browser with this backup?')) return '';
    collectionKeys.forEach((key) => writeLocalCollection(key, data[key] as unknown[]));
    // Profile and daily check-ins arrived in version 2 backups; older files simply leave them as they are.
    if (Array.isArray(data.profile) && data.profile[0] && typeof data.profile[0] === 'object') writeLocalCollection('profile', [{ ...defaultProfile, ...(data.profile[0] as Partial<Profile>) }]);
    if (Array.isArray(data.checkins)) writeLocalCollection('checkins', (data.checkins as unknown[]).filter((item) => isValidItem(item, ['date'])));
    loadData();
    return 'Backup restored.';
  };

  const deleteAllData = (): string => {
    if (!window.confirm('Delete all people, plans, goals, reflections, check-ins and your profile saved in this browser? This cannot be undone. Consider exporting a backup first.')) return '';
    collectionKeys.forEach((key) => writeLocalCollection(key, []));
    writeLocalCollection('checkins', []);
    writeLocalCollection('profile', [{ ...defaultProfile, name: '' }]);
    loadData();
    return 'All your data has been deleted from this browser.';
  };

  const restoreExamples = (): string => {
    if (!window.confirm('Replace your current data with the example people and plans?')) return '';
    collectionKeys.forEach((key) => removeLocalCollection(key));
    loadData();
    return 'The example people and plans are back.';
  };

  // Free includes a monthly allowance of questions; asking the same question again doesn't count.
  const monthKey = localDateKey().slice(0, 7);
  const questionsUsed = questionUsage.month === monthKey ? questionUsage.questions : 0;
  const questionsLeft = plan.isPlus ? null : Math.max(0, FREE_QUESTIONS_PER_MONTH - questionsUsed);
  const nextMonth = new Date(); nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
  const questionsResetOn = fmtLongDate(`${localDateKey(nextMonth)}T12:00:00`);
  const countQuestion = (text: string): boolean => {
    if (!text.trim() || text === submittedQuestion || plan.isPlus) return true;
    if (questionsUsed >= FREE_QUESTIONS_PER_MONTH) { setLimitNotice('questions'); return false; }
    const next = { month: monthKey, questions: questionsUsed + 1 };
    writeLocalCollection('usage', [next]);
    setQuestionUsage(next);
    return true;
  };
  const submitQuestion = (override?: string) => { const text = override ?? question; if (countQuestion(text)) setSubmittedQuestion(text); };
  const decisionResult = useMemo(() => buildDecision(submittedQuestion, people, plans, goals, reflections, day), [submittedQuestion, people, plans, goals, reflections, day]);

  // What each AI feature sends: only the saved context it needs, cut to size, and only when tapped.
  const cut = (value: string, max: number) => value.slice(0, max);
  const planItem = (item: Plan) => ({ title: cut(item.title, 120), when: `${fmtDate(item.plan_date)} at ${fmtTime(item.plan_time)} (${relativeDay(item.plan_date)})`, category: cut(item.category, 30), context: cut(item.context, 400), with: cut(people.find((person) => person.id === item.person_id)?.name ?? '', 80), upcoming: isUpcoming(item) });
  const reflectionItem = (item: Reflection) => ({ date: reflectionDate(item), about: cut(people.find((person) => person.id === item.person_id)?.name ?? '', 80), text: cut(item.text, 1200) });
  const personItem = (person: Person) => ({ name: cut(person.name, 80), relationship: cut(person.relationship, 80), detail: cut(person.detail, 300), note: cut(person.note, 600) });
  const goalItem = (goal: Goal) => ({ title: cut(goal.title, 120), category: cut(goal.category, 30), description: cut(goal.description, 300) });
  const aboutYou = { social: day.social === 'company' ? 'up for company' : day.social === 'quiet' ? 'wants some quiet' : 'not said', freeTonight: day.freeTonight === null ? 'not said' : day.freeTonight ? 'yes' : 'not really', mood: cut(todayCheckIn?.mood ?? '', 30), recharge: day.recharge || 'not said', intention: cut(day.intention, 160), quietDay: day.quietToday };
  const circleItem = (item: Person) => {
    const itemInsight = personInsight(item, plans, reflections);
    return { name: cut(item.name, 80), last: itemInsight.last ? cut(`${itemInsight.last.title}, ${relativeDay(itemInsight.last.plan_date)}`, 100) : 'none saved', next: itemInsight.next ? cut(`${itemInsight.next.title}, ${relativeDay(itemInsight.next.plan_date)}`, 100) : 'none planned', feeling: itemInsight.feeling?.label || 'no reflections' };
  };
  const decisionContext = () => {
    if (!decisionResult) return { today: fmtDate(localDateKey()) };
    const person = decisionResult.kind === 'who' ? undefined : decisionResult.matchedPeople[0] ?? people.find((item) => item.id === decisionResult.matchedPlans[0]?.person_id);
    const insight = person ? personInsight(person, plans, reflections) : null;
    return {
      today: fmtDate(localDateKey()),
      question: cut(submittedQuestion, 300),
      energy,
      aboutYou,
      instantAnswer: { headline: cut(decisionResult.verdict.headline, 120), reason: cut(decisionResult.verdict.reason, 500) },
      person: person ? personItem(person) : null,
      plans: insight ? [...insight.upcoming.slice(0, 5), ...insight.past.slice(0, 5)].map(planItem) : decisionResult.matchedPlans.slice(0, 5).map(planItem),
      reflections: insight ? insight.reflections.slice(0, 5).map(reflectionItem) : [],
      circle: decisionResult.kind === 'who' ? activePeople.slice(0, 12).map(circleItem) : [],
      goals: activeGoals.slice(0, 5).map(goalItem),
    };
  };
  const personContext = (person: Person) => {
    const insight = personInsight(person, plans, reflections);
    return { today: fmtDate(localDateKey()), person: personItem(person), plans: [...insight.upcoming.slice(0, 10), ...insight.past.slice(0, 10)].map(planItem), reflections: insight.reflections.slice(0, 10).map(reflectionItem) };
  };
  const reflectionContext = () => ({ today: fmtDate(localDateKey()), aboutYou, reflections: [...reflections].sort(byNewest).slice(0, 10).map(reflectionItem) });
  const weeklyContext = () => ({
    today: fmtDate(localDateKey()),
    aboutYou,
    plans: plans.filter((item) => Math.abs(daysUntil(item.plan_date)) <= 7).sort(bySoonest).slice(0, 20).map(planItem),
    reflections: reflections.filter((item) => Date.now() - Date.parse(item.created_at) <= 7 * 86400000).sort(byNewest).slice(0, 10).map(reflectionItem),
    circle: activePeople.slice(0, 12).map(circleItem),
    goals: activeGoals.slice(0, 10).map(goalItem),
  });
  const aiProps = { plan, aiEnabled, onEnableAi: () => navigate('settings') };

  const openModal = (type: Modal, id: string | null = null) => {
    // Adding past a Free limit explains the limit instead of opening an empty form.
    const kind = type === 'person' ? 'people' : type === 'plan' ? 'plans' : type === 'goal' ? 'goals' : null;
    if (!id && kind && atLimit(kind)) { setLimitNotice(kind); return; }
    setModal(type); setEditingId(id); setError(''); setPresetPersonId(null);
  };
  const openPlanFor = (id: string) => { if (atLimit('plans')) { setLimitNotice('plans'); return; } openModal('plan'); setPresetPersonId(id); };
  const openPerson = (id: string) => { setPersonId(id); navigate('person'); };
  const askAbout = (text: string) => {
    setQuestion(text);
    if (countQuestion(text)) setSubmittedQuestion(text);
    setPage('home');
    setMobileOpen(false);
    requestAnimationFrame(() => questionRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };
  const selectedPerson = people.find((person) => person.id === personId);

  return (
    <div className="app-shell" data-clarity-mask="True">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <button className="brand" onClick={() => navigate('home')} aria-label="Go to Kinly home"><img className="brand-icon" src="/assets/kinly-icon.png" alt="" /><span className="brand-wordmark">Kinly</span></button>
          <button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <div className="workspace-label">YOUR SPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${page === id || (page === 'person' && id === 'people') ? 'nav-item-active' : ''}`} onClick={() => navigate(id)}><Icon size={18} strokeWidth={page === id ? 2.3 : 1.8} /><span>{label}</span>{id === 'home' && <span className="nav-dot" />}</button>)}
        </nav>
        <div className="sidebar-bottom"><div className="privacy-note"><Sparkles size={15} /><span>Your space is private<br />by design. <Link to="/?home" className="privacy-link">About Kinly</Link></span></div><button className="profile-chip" onClick={() => navigate('you')} aria-label="Your day and profile"><div className="profile-avatar">{initialsOf(profileName) || '·'}</div><div><strong>{profileName || 'Your space'}</strong><span>{todayCheckIn?.mood ? `Feeling ${todayCheckIn.mood}` : energy ? `Energy today: ${energy}` : 'Check in for today'}</span></div><ChevronRight size={15} className="profile-chevron" /></button></div>
      </aside>
      {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <main className="main-content">
        <header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={21} /></button><nav className="breadcrumbs" aria-label="Breadcrumb"><button className="breadcrumb-link" onClick={() => navigate('home')}>Kinly</button><ChevronRight size={14} />{page === 'person' ? <><button className="breadcrumb-link" onClick={() => navigate('people')}>People</button><ChevronRight size={14} /><strong aria-current="page">{selectedPerson?.name}</strong></> : <strong aria-current="page">{page === 'you' ? 'You' : navigation.find((item) => item.id === page)?.label}</strong>}</nav><div className="topbar-actions"><button className="icon-button" onClick={focusQuestion} aria-label="Ask a question" title={`Ask a question (${shortcutLabel} K)`}><Search size={18} /></button><button className="top-avatar" onClick={() => navigate('you')} aria-label="Your day and profile" title="Your day and profile">{initialsOf(profileName) || '·'}</button></div></header>
        {error && !modal && <div className="error-banner" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={15} /></button></div>}
        {limitNotice && !(limitNotice === 'questions' && page === 'home') && <UpgradeNotice kind={limitNotice} resetsOn={limitNotice === 'questions' ? questionsResetOn : undefined} onDismiss={() => setLimitNotice(null)} />}
        {loading ? <div className="loading-state"><div className="loading-dot" /><p>Preparing your space…</p></div> : <>
          {page === 'home' && <HomePage question={question} setQuestion={(v) => { setQuestion(v); setSubmittedQuestion(''); }} onSubmitQuestion={submitQuestion} decision={decisionResult} ai={<AiPanel key={`${submittedQuestion}|${energy}`} feature="decision_analysis" {...aiProps} buildContext={decisionContext} sends="this question and the related notes" benefit="Advanced decision analysis weighs everything you’ve saved about the people and plans involved." />} weekly={<AiPanel feature="weekly_review" {...aiProps} buildContext={weeklyContext} sends="this week’s plans, reflections and goals" benefit="A weekly review looks back at who you saw and how it felt, and ahead at the week to come." />} questionNote={limitNotice === 'questions' ? <UpgradeNotice kind="questions" resetsOn={questionsResetOn} onDismiss={() => setLimitNotice(null)} /> : questionsLeft !== null ? <p className="questions-left">{questionsLeft} of {FREE_QUESTIONS_PER_MONTH} free questions left this month · resets {questionsResetOn}</p> : null} energy={energy} setEnergy={setEnergy} weeklyGoal={profile.weeklyGoal} quietToday={day.quietToday} navigate={navigate} onAddPerson={() => openModal('person')} onOpenPerson={openPerson} onAddPlan={() => openModal('plan')} questionRef={questionRef} people={activePeople} plans={upcomingPlans} allPlans={plans} reflections={reflections} goals={activeGoals} />}
          {page === 'people' && <PeoplePage search={search} setSearch={setSearch} people={filteredPeople} limit={limits?.people ?? null} activeCount={activePeople.length} onAdd={() => openModal('person')} onOpen={openPerson} onEdit={(id) => openModal('person', id)} onDelete={deletePerson} />}
          {page === 'person' && selectedPerson && <PersonPage person={selectedPerson} insight={personInsight(selectedPerson, plans, reflections)} onBack={() => navigate('people')} onEdit={() => openModal('person', selectedPerson.id)} onDelete={() => deletePerson(selectedPerson.id)} onAddPlan={() => openPlanFor(selectedPerson.id)} onAsk={askAbout} onSaveReflection={saveReflection} onArchive={(archived) => archivePerson(selectedPerson.id, archived)} ai={<div className="person-ai"><AiPanel key={`prep-${selectedPerson.id}`} feature="conversation_prep" {...aiProps} buildContext={() => personContext(selectedPerson)} sends={`your notes, plans and reflections about ${selectedPerson.name.split(' ')[0]}`} benefit="Conversation preparation suggests an opener and what to follow up on, from your own notes." /><AiPanel key={`analysis-${selectedPerson.id}`} feature="relationship_analysis" {...aiProps} buildContext={() => personContext(selectedPerson)} sends={`your notes, plans and reflections about ${selectedPerson.name.split(' ')[0]}`} benefit="Detailed relationship analysis looks at the rhythm of your time together and how it has felt." /></div>} />}
          {page === 'person' && !selectedPerson && <PeoplePage search={search} setSearch={setSearch} people={filteredPeople} limit={limits?.people ?? null} activeCount={activePeople.length} onAdd={() => openModal('person')} onOpen={openPerson} onEdit={(id) => openModal('person', id)} onDelete={deletePerson} />}
          {page === 'plans' && <PlansPage plans={plans} people={people} limit={limits?.plans ?? null} onAdd={() => openModal('plan')} onEdit={(id) => openModal('plan', id)} onDelete={deletePlan} />}
          {page === 'goals' && <GoalsPage goals={goals} limit={limits?.goals ?? null} onAdd={() => openModal('goal')} onEdit={(id) => openModal('goal', id)} onDelete={deleteGoal} onToggle={toggleGoal} />}
          {page === 'reflections' && <ReflectionsPage reflections={reflections} people={people} onSave={saveReflection} onDelete={deleteReflection} ai={reflections.length > 0 ? <AiPanel feature="reflection" {...aiProps} buildContext={reflectionContext} sends="your 10 most recent reflections" benefit="An AI reflection notices themes across what you’ve written and offers a question to sit with." /> : null} />}
          {page === 'you' && <YouPage profile={profile} onSaveProfile={saveProfile} todayCheckIn={todayCheckIn} onCheckIn={updateCheckIn} checkins={checkins} people={people} plans={plans} reflections={reflections} />}
          {page === 'settings' && <SettingsPage plan={plan} aiEnabled={aiEnabled} onToggleAi={setDeeperAnswers} counts={{ people: people.length, plans: plans.length, goals: goals.length, reflections: reflections.length }} onExport={exportData} onImport={importData} onDeleteAll={deleteAllData} onRestoreExamples={restoreExamples} />}
        </>}
      </main>
      {modal === 'person' && <PersonModal person={editingId ? people.find((item) => item.id === editingId) : undefined} defaultColor={personColors[people.length % personColors.length]} onClose={() => { setModal(null); setEditingId(null); }} onSubmit={savePerson} />}
      {modal === 'plan' && <PlanModal plan={editingId ? plans.find((item) => item.id === editingId) : undefined} presetPersonId={presetPersonId} people={activePeople} error={error} onClose={() => { setModal(null); setEditingId(null); setError(''); }} onSubmit={savePlan} />}
      {modal === 'goal' && <GoalModal goal={editingId ? goals.find((item) => item.id === editingId) : undefined} error={error} onClose={() => { setModal(null); setEditingId(null); setError(''); }} onSubmit={saveGoal} />}
    </div>
  );
}

// Ready-made questions built from what is saved, so asking takes a single tap.
function buildQuickQuestions(people: Person[], plans: Plan[], reflections: Reflection[]): string[] {
  const byId = (id?: string | null) => people.find((person) => person.id === id);
  const first = (person: Person) => person.name.split(' ')[0];
  const upcoming = plans.filter(isUpcoming).sort(bySoonest);
  const questions: string[] = [];
  const nextPlan = upcoming[0];
  if (nextPlan) questions.push(`Should I go to ${nextPlan.title}?`);
  const reflected = byId([...reflections].sort(byNewest).find((reflection) => byId(reflection.person_id))?.person_id);
  if (reflected) questions.push(`How did it go with ${first(reflected)} last time?`);
  const quiet = people.find((person) => !upcoming.some((plan) => plan.person_id === person.id));
  if (quiet) questions.push('Who should I reach out to this week?');
  const nextPerson = byId(upcoming.find((plan) => byId(plan.person_id) && plan.person_id !== nextPlan?.person_id)?.person_id);
  if (nextPerson) questions.push(`When am I next seeing ${first(nextPerson)}?`);
  return questions;
}

type Moment = { kicker: string; title: string; text: string; action: { label: string; personId?: string; question?: string } };

// The Home card picks the most timely thing from saved data, falling back to a gentle prompt.
function buildMoment(people: Person[], plans: Plan[], reflections: Reflection[], quietToday = false): Moment {
  const first = (person: Person) => person.name.split(' ')[0];
  const soon = plans.filter(isUpcoming).sort(bySoonest).find((plan) => daysUntil(plan.plan_date) <= 1 && people.some((person) => person.id === plan.person_id));
  if (soon) {
    const person = people.find((item) => item.id === soon.person_id) as Person;
    const { feeling } = personInsight(person, plans, reflections);
    const when = daysUntil(soon.plan_date) === 0 ? 'today' : 'tomorrow';
    return {
      kicker: when === 'today' ? 'TODAY' : 'COMING UP TOMORROW',
      title: `${soon.title} with ${first(person)}, ${when} at ${fmtTime(soon.plan_time)}.`,
      text: person.note ? `Your note: “${person.note}”` : feeling ? `Last time: ${lowerFirst(feeling.label)} — “${feeling.excerpt}”` : soon.context || 'A good moment to think about what you want from the time together.',
      action: { label: `Open ${first(person)}’s page`, personId: person.id },
    };
  }
  if (quietToday) {
    return {
      kicker: 'A QUIET DAY',
      title: 'Today is one of your quiet days.',
      text: 'Nothing needs planning. Kinly will lean towards rest in its answers today.',
      action: { label: 'Reflect for a minute' },
    };
  }
  const quiet = people
    .map((person) => ({ person, insight: personInsight(person, plans, reflections) }))
    .filter(({ insight }) => insight.last && !insight.next && -daysUntil(insight.last.plan_date) >= 21)
    .sort((a, b) => (a.insight.last as Plan).plan_date.localeCompare((b.insight.last as Plan).plan_date))[0];
  if (quiet) {
    const name = first(quiet.person);
    return {
      kicker: 'A GENTLE NUDGE',
      title: `It has been ${-daysUntil((quiet.insight.last as Plan).plan_date)} days since you saw ${name}.`,
      text: 'A short message can keep things warm — no plan needed.',
      action: { label: `Should I reach out to ${name}?`, question: `Should I reach out to ${name}?` },
    };
  }
  return {
    kicker: 'A MOMENT TO CONSIDER',
    title: 'What would feel nourishing today?',
    text: 'Nothing is planned for the next day. Notice what your energy is asking for before you fill the space.',
    action: { label: 'Reflect for a minute' },
  };
}

const questionsAbout = (person: Person, hasPlan = false) => {
  const first = person.name.split(' ')[0];
  return [
    `Should I meet ${first}?`,
    `How did it go with ${first} last time?`,
    `What should I talk about with ${first}?`,
    hasPlan ? `Should I cancel on ${first}?` : `When did I last see ${first}?`,
  ];
};

const energyLevels: { value: NonNullable<Energy>; label: string }[] = [{ value: 'low', label: 'Low' }, { value: 'okay', label: 'Okay' }, { value: 'good', label: 'Good' }];

function HomePage({ question, setQuestion, onSubmitQuestion, decision, ai, weekly, questionNote, energy, setEnergy, weeklyGoal, quietToday, navigate, onAddPerson, onOpenPerson, onAddPlan, questionRef, people, plans, allPlans, reflections, goals }: { question: string; setQuestion: (value: string) => void; onSubmitQuestion: (override?: string) => void; decision: DecisionResult; ai: ReactNode; weekly: ReactNode; questionNote: ReactNode; energy: Energy; setEnergy: (value: Energy) => void; weeklyGoal: number; quietToday: boolean; navigate: (page: Page) => void; onAddPerson: () => void; onOpenPerson: (id: string) => void; onAddPlan: () => void; questionRef: RefObject<HTMLInputElement>; people: Person[]; plans: Plan[]; allPlans: Plan[]; reflections: Reflection[]; goals: Goal[] }) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const focusPerson = people.find((person) => person.id === focusId);
  const quickQuestions = useMemo(() => buildQuickQuestions(people, allPlans, reflections), [people, allPlans, reflections]);
  const moment = useMemo(() => buildMoment(people, allPlans, reflections, quietToday), [people, allPlans, reflections, quietToday]);
  const runMoment = () => {
    if (moment.action.personId) onOpenPerson(moment.action.personId);
    else if (moment.action.question) { ask(moment.action.question); questionRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    else navigate('reflections');
  };
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (question.trim()) onSubmitQuestion(); };
  const ask = (prompt: string) => { setQuestion(prompt); onSubmitQuestion(prompt); };
  const askSection = <section className="ask-section">
    <div className="section-heading"><div><span className="card-kicker">THINK IT THROUGH</span><h2>Bring a question to mind.</h2></div><CircleHelp size={18} /></div>
    <form className="question-box" onSubmit={submit}><Search size={19} /><input ref={questionRef} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="e.g. Should I meet Maya tonight?" aria-label="Ask about a person or plan" /><kbd>{shortcutLabel === '⌘' ? <Command size={12} /> : shortcutLabel} K</kbd><button type="submit" className="ask-button" disabled={!question.trim()}>Ask</button></form>{questionNote}
    {people.length > 0 && <div className="ask-people"><span className="ask-label">Ask about</span>{people.slice(0, 6).map((person) => <button type="button" key={person.id} className={`ask-person ${focusId === person.id ? 'ask-person-active' : ''}`} aria-pressed={focusId === person.id} onClick={() => setFocusId(focusId === person.id ? null : person.id)}><Avatar person={person} size="xs" />{person.name.split(' ')[0]}</button>)}</div>}
    <div className="energy-row" role="group" aria-label="Your energy right now"><span className="ask-label">Your energy right now</span>{energyLevels.map((level) => <button type="button" key={level.value} className={`energy-option ${energy === level.value ? 'energy-active' : ''}`} aria-pressed={energy === level.value} onClick={() => setEnergy(energy === level.value ? null : level.value)}>{level.label}</button>)}</div>
    <div className="prompt-list">{(focusPerson ? questionsAbout(focusPerson, allPlans.some((plan) => plan.person_id === focusPerson.id && isUpcoming(plan))) : quickQuestions).map((prompt) => <button key={prompt} className="prompt-pill" onClick={() => ask(prompt)}>{prompt}<ArrowUpRight size={14} /></button>)}</div>
    {decision && <DecisionPanel decision={decision} ai={ai} onClear={() => setQuestion('')} />}
  </section>;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  return <div className="page-wrap home-page"><section className="welcome-row"><div><p className="eyebrow">{today}</p><h1>Your people. A more intentional tomorrow.</h1><p className="intro">Think clearly about your time, your relationships, and the choices between them.</p></div><button className="quiet-button" onClick={onAddPerson}><Plus size={16} /> Add a person</button></section><section className="reflection-card"><div className="reflection-icon"><Sparkles size={19} /></div><div className="reflection-copy"><span className="card-kicker">{moment.kicker}</span><h2>{moment.title}</h2><p>{moment.text}</p></div><button className="text-button" onClick={runMoment}>{moment.action.label} <ArrowUpRight size={15} /></button></section>{askSection}<div className="summary-strip"><SummaryStat label="PEOPLE IN YOUR CIRCLE" value={people.length} icon={<Users size={16} />} onClick={() => navigate('people')} /><SummaryStat label="UPCOMING PLANS" value={plans.length} icon={<CalendarDays size={16} />} onClick={() => navigate('plans')} /><SummaryStat label="ACTIVE PRIORITIES" value={goals.length} icon={<Target size={16} />} onClick={() => navigate('goals')} /></div><CircleInsights people={people} plans={allPlans} reflections={reflections} weeklyGoal={weeklyGoal} onOpenPerson={onOpenPerson} onOpenYou={() => navigate('you')} /><section className="content-card weekly-review"><div><span className="card-kicker">KINLY PLUS · WEEKLY REVIEW</span><h2>Look back, look ahead</h2><p>Who you saw this week, how it felt, and what the week ahead could hold.</p></div>{weekly}</section><div className="dashboard-grid"><section className="content-card upcoming-card"><div className="card-header"><div><span className="card-kicker">YOUR WEEK</span><h2>Coming up</h2></div><button className="card-link" onClick={() => navigate('plans')}>View all <ArrowUpRight size={14} /></button></div><div className="plans-list">{plans.length ? plans.slice(0, 3).map((plan) => <PlanRow key={plan.id} plan={plan} person={people.find((person) => person.id === plan.person_id)} />) : <EmptyInline text="No plans on the horizon yet." action="Add a plan" onClick={onAddPlan} />}</div></section><section className="content-card people-preview"><div className="card-header"><div><span className="card-kicker">YOUR CIRCLE</span><h2>People</h2></div><button className="card-link" onClick={() => navigate('people')}>See directory <ArrowUpRight size={14} /></button></div><div className="mini-people">{people.slice(0, 4).map((person) => <button className="mini-person" key={person.id} onClick={() => onOpenPerson(person.id)}><Avatar person={person} size="sm" /><span>{person.name.split(' ')[0]}</span></button>)}</div><button className="add-person-line" onClick={onAddPerson}><Plus size={15} /> Keep your circle close</button></section></div></div>;
}

// A monthly read on the circle: who you saw, who feels good to be around, who may be drifting.
function CircleInsights({ people, plans, reflections, weeklyGoal, onOpenPerson, onOpenYou }: { people: Person[]; plans: Plan[]; reflections: Reflection[]; weeklyGoal: number; onOpenPerson: (id: string) => void; onOpenYou: () => void }) {
  const month = localDateKey().slice(0, 7);
  // The week runs Monday to Sunday.
  const weekStart = daysFromToday(-((new Date().getDay() + 6) % 7));
  const weekEnd = daysFromToday(6 - ((new Date().getDay() + 6) % 7));
  const thisWeek = plans.filter((plan) => plan.person_id && plan.plan_date >= weekStart && plan.plan_date <= weekEnd);
  const seenThisWeek = new Set(thisWeek.filter((plan) => !isUpcoming(plan)).map((plan) => plan.person_id));
  const plannedThisWeek = new Set(thisWeek.filter((plan) => isUpcoming(plan) && !seenThisWeek.has(plan.person_id)).map((plan) => plan.person_id));
  const monthName = new Date().toLocaleDateString('en-US', { month: 'long' });
  const entries = people.map((person) => ({ person, insight: personInsight(person, plans, reflections) }));
  const seen = entries.filter(({ insight }) => insight.past.some((plan) => plan.plan_date.startsWith(month)));
  const feelsGood = entries.filter(({ insight }) => insight.feeling?.tone === 'positive');
  const drifting = entries
    .filter(({ insight }) => !insight.next && (!insight.last || -daysUntil(insight.last.plan_date) >= 21))
    .map((entry) => ({ ...entry, days: entry.insight.last ? -daysUntil(entry.insight.last.plan_date) : null }))
    .sort((a, b) => (b.days ?? 999) - (a.days ?? 999));
  const recent = reflections.filter((reflection) => Date.now() - new Date(reflection.created_at).getTime() <= 30 * 86400000).map(feelingOf);
  const count = (tone: Feeling['tone']) => recent.filter((feeling) => feeling.tone === tone).length;
  const chip = (person: Person, detail?: string) => <button key={person.id} className="insight-person" onClick={() => onOpenPerson(person.id)}><Avatar person={person} size="xs" /><span>{person.name.split(' ')[0]}</span>{detail && <small>{detail}</small>}</button>;
  if (!people.length) return null;
  return <section className="content-card circle-insights">
    <div className="card-header"><div><span className="card-kicker">YOUR CIRCLE IN {monthName.toUpperCase()}</span><h2>How your connections are going</h2></div></div>
    {weeklyGoal > 0
      ? <div className="week-goal"><div className="week-goal-text"><span className="insight-label">This week’s goal</span><span><b>{seenThisWeek.size}</b> seen{plannedThisWeek.size ? <> · <b>{plannedThisWeek.size}</b> planned</> : null} of {weeklyGoal} {weeklyGoal === 1 ? 'person' : 'people'}</span></div><div className="week-goal-bar" aria-hidden="true"><i className="week-goal-seen" style={{ width: `${Math.min(seenThisWeek.size / weeklyGoal, 1) * 100}%` }} /><i className="week-goal-planned" style={{ width: `${Math.min(plannedThisWeek.size / weeklyGoal, Math.max(0, 1 - seenThisWeek.size / weeklyGoal)) * 100}%` }} /></div></div>
      : <button className="deeper-invite week-goal-invite" onClick={onOpenYou}><Target size={14} /> Set a weekly connection goal</button>}
    <div className="insight-grid">
      <div className="insight-col"><span className="insight-label">Time together this month</span><strong className="insight-number">{seen.length}<small> of {people.length} people</small></strong><div className="insight-people">{seen.length ? seen.map(({ person }) => chip(person)) : <p className="insight-empty">No plans with anyone yet this month.</p>}</div></div>
      <div className="insight-col"><span className="insight-label">Feels good with</span><div className="insight-people">{feelsGood.length ? feelsGood.map(({ person }) => chip(person)) : <p className="insight-empty">Write a reflection after time together to see who leaves you feeling good.</p>}</div></div>
      <div className="insight-col"><span className="insight-label">Might be drifting</span><div className="insight-people">{drifting.length ? drifting.slice(0, 4).map(({ person, days }) => chip(person, days !== null ? `${days}d` : 'not yet')) : <p className="insight-empty">Everyone has been seen recently or has a plan coming up.</p>}</div></div>
    </div>
    <p className="insight-footer">{recent.length ? <>Your last 30 days of reflections: <b>{count('positive')}</b> felt good · <b>{count('mixed')}</b> mixed · <b>{count('negative')}</b> draining{count('neutral') ? <> · <b>{count('neutral')}</b> neutral</> : null}</> : 'No reflections in the last 30 days yet.'}</p>
  </section>;
}

function SummaryStat({ label, value, icon, onClick }: { label: string; value: number; icon: React.ReactNode; onClick: () => void }) { return <button className="summary-stat" onClick={onClick}><span className="summary-stat-icon">{icon}</span><span><strong>{value}</strong><small>{label}</small></span><ArrowUpRight size={14} /></button>; }

function PlanRow({ plan, person }: { plan: Plan; person?: Person }) { return <div className="plan-row"><div className="date-block"><strong>{new Date(`${plan.plan_date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</strong><span>{new Date(`${plan.plan_date}T12:00:00`).getDate()}</span></div><div className="plan-info"><strong>{plan.title}</strong><span>{person?.name || 'Personal time'} <i>·</i> {plan.category}</span></div><div className="plan-time"><Clock3 size={14} />{fmtTime(plan.plan_time)}</div><ChevronRight size={16} className="row-chevron" /></div>; }

function PeoplePage({ search, setSearch, people, limit, activeCount, onAdd, onOpen, onEdit, onDelete }: { search: string; setSearch: (value: string) => void; people: Person[]; limit: number | null; activeCount: number; onAdd: () => void; onOpen: (id: string) => void; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  const active = people.filter((person) => !person.archived);
  const archived = people.filter((person) => person.archived);
  const card = (person: Person) => <article className={`person-card ${person.archived ? 'person-card-archived' : ''}`} key={person.id}><div className="person-card-top"><Avatar person={person} size="lg" /><div className="card-actions"><button className="card-action" onClick={() => onEdit(person.id)} aria-label={`Edit ${person.name}`}><Edit3 size={15} /></button><button className="card-action danger-action" onClick={() => onDelete(person.id)} aria-label={`Delete ${person.name}`}><Trash2 size={15} /></button></div></div><h2>{person.name}</h2><p className="relationship">{person.relationship}{person.archived && <span className="archived-chip">Archived</span>}</p><p className="person-detail">{person.detail || 'Add a little context to remember what matters.'}</p><div className="person-divider" /><div className="no-plan"><BookOpen size={15} /><span>{person.note || 'No note added yet'}</span></div><button className="view-person" onClick={() => onOpen(person.id)}>Open profile <ArrowUpRight size={15} /></button></article>;
  return <div className="page-wrap people-page"><section className="page-heading-row"><div><p className="eyebrow">YOUR CIRCLE</p><h1>People</h1><p className="intro">The people who shape your days, held in one thoughtful place.</p></div><button className="primary-button" onClick={onAdd}><Plus size={17} /> Add person</button></section><div className="directory-toolbar"><div className="directory-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people" aria-label="Search people" /></div><span>{limit ? `${activeCount} of ${limit} people on Free` : `${activeCount} ${activeCount === 1 ? 'person' : 'people'}`}</span></div>{active.length ? <div className="people-grid">{active.map(card)}</div> : <div className="empty-state"><div className="empty-icon"><Users size={23} /></div><h2>{search ? 'No one by that name yet.' : 'Your circle starts here.'}</h2><p>{search ? 'Try another search, or add someone new to your circle.' : 'Add the first person you’d like to keep close.'}</p><button className="primary-button" onClick={onAdd}><Plus size={17} /> Add person</button></div>}{archived.length > 0 && <details className="archived-people"><summary>Archived ({archived.length}) <ChevronRight size={14} /></summary><p className="intro">Archived people keep all their notes, plans and reflections. They don’t count towards the Free limit.</p><div className="people-grid">{archived.map(card)}</div></details>}</div>;
}

function PersonPage({ person, insight, onBack, onEdit, onDelete, onAddPlan, onAsk, onSaveReflection, onArchive, ai }: { person: Person; insight: PersonInsight; onBack: () => void; onEdit: () => void; onDelete: () => void; onAddPlan: () => void; onAsk: (question: string) => void; onSaveReflection: (event: FormEvent<HTMLFormElement>) => void; onArchive: (archived: boolean) => void; ai: ReactNode }) {
  const first = person.name.split(' ')[0];
  // Past plans and reflections in one timeline, newest first.
  const history = [
    ...insight.past.map((plan) => ({ id: plan.id, kind: 'plan' as const, sortKey: planMoment(plan), date: fmtDate(plan.plan_date), title: plan.title, text: plan.context })),
    ...insight.reflections.map((reflection) => ({ id: reflection.id, kind: 'reflection' as const, sortKey: `${localDateKey(new Date(reflection.created_at))}T${new Date(reflection.created_at).toTimeString().slice(0, 5)}`, date: reflectionDate(reflection), title: feelingOf(reflection).label, text: reflection.text })),
  ].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  return <div className="page-wrap person-page">
    <button className="text-button back-link" onClick={onBack}><ArrowLeft size={15} /> All people</button>
    <section className="person-hero"><Avatar person={person} size="lg" /><div className="person-hero-copy"><p className="eyebrow">{person.relationship.toUpperCase()}{person.archived && ' · ARCHIVED'}</p><h1>{person.name}</h1><p className="intro">{person.detail || 'Add a little context to remember what matters.'}</p></div><div className="person-hero-actions"><button className="quiet-button" onClick={onEdit}><Edit3 size={15} /> Edit</button><button className="primary-button" onClick={onAddPlan}><Plus size={16} /> Add plan</button></div></section>
    <dl className="decision-glance person-glance">{glanceFor(insight).map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
    <div className="person-ask"><span className="ask-label">Ask about {first}</span>{questionsAbout(person, insight.upcoming.length > 0).map((question) => <button key={question} className="prompt-pill" onClick={() => onAsk(question)}>{question}<ArrowUpRight size={14} /></button>)}</div>
    {person.note && <section className="content-card person-note"><span className="card-kicker">YOUR NOTE</span><p>{person.note}</p></section>}
    <section className="content-card person-plus"><span className="card-kicker">KINLY PLUS · WITH {first.toUpperCase()}</span>{ai}</section>
    <div className="person-columns">
      <section className="content-card"><div className="card-header"><div><span className="card-kicker">NEXT WITH {first.toUpperCase()}</span><h2>Coming up</h2></div></div><div className="plans-list">{insight.upcoming.length ? insight.upcoming.map((plan) => <PlanRow key={plan.id} plan={plan} person={person} />) : <EmptyInline text={`Nothing planned with ${first} yet.`} action="Add a plan" onClick={onAddPlan} />}</div></section>
      <section className="content-card"><div className="card-header"><div><span className="card-kicker">LOOKING BACK</span><h2>Your history together</h2></div></div>{history.length ? <ol className="person-timeline">{history.map((item) => <li key={`${item.kind}-${item.id}`} className={`timeline-item timeline-${item.kind}`}><span className="timeline-icon">{item.kind === 'plan' ? <CalendarDays size={13} /> : <BookOpen size={13} />}</span><div><span className="timeline-meta">{item.date} · {item.kind === 'plan' ? 'Plan' : 'Reflection'}</span><strong>{item.title}</strong>{item.text && <p>{item.text}</p>}</div></li>)}</ol> : <p className="person-empty">Nothing here yet. After you spend time together, write how it felt below.</p>}</section>
    </div>
    <section className="reflection-compose person-reflect"><form onSubmit={onSaveReflection}><label>How did your last time with {first} feel?<textarea name="text" placeholder="A few honest lines are enough…" required /></label><input type="hidden" name="person_id" value={person.id} /><div className="modal-actions"><button type="submit" className="primary-button"><Check size={16} /> Save reflection</button></div></form></section>
    <div className="person-footer-actions"><button className="text-button person-remove" onClick={() => onArchive(!person.archived)}>{person.archived ? <><ArchiveRestore size={14} /> Return {first} to your circle</> : <><Archive size={14} /> Archive {first}</>}</button><button className="text-button person-remove" onClick={onDelete}><Trash2 size={14} /> Remove {first} from your circle</button></div>
  </div>;
}

function PlansPage({ plans, people, limit, onAdd, onEdit, onDelete }: { plans: Plan[]; people: Person[]; limit: number | null; onAdd: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void }) { const upcoming = plans.filter(isUpcoming).sort(bySoonest); const past = plans.filter((plan) => !isUpcoming(plan)).sort((a, b) => bySoonest(b, a)); return <div className="page-wrap plans-page"><section className="page-heading-row"><div><p className="eyebrow">YOUR TIME</p><h1>Plans</h1><p className="intro">See what is ahead, and make room for the choices that matter.</p></div><button className="primary-button" onClick={onAdd}><Plus size={17} /> Add plan</button></section>{limit && <div className="goal-limit"><CalendarDays size={16} /><span>{upcoming.length} of {limit} upcoming plans on Free · past plans don’t count</span><div className="goal-progress"><i style={{ width: `${Math.min(upcoming.length / limit * 100, 100)}%` }} /></div></div>}<div className="plan-columns"><PlanGroup title="Upcoming" plans={upcoming} people={people} onEdit={onEdit} onDelete={onDelete} empty="Nothing scheduled yet." /><PlanGroup title="Past plans" plans={past} people={people} onEdit={onEdit} onDelete={onDelete} empty="Your past plans will appear here." /></div></div>; }

function PlanGroup({ title, plans, people, onEdit, onDelete, empty }: { title: string; plans: Plan[]; people: Person[]; onEdit: (id: string) => void; onDelete: (id: string) => void; empty: string }) { return <section className="plan-group"><div className="section-heading"><div><span className="card-kicker">{title === 'Upcoming' ? 'NEXT ON YOUR CALENDAR' : 'LOOKING BACK'}</span><h2>{title}</h2></div><span className="group-count">{plans.length}</span></div>{plans.length ? <div className="plan-cards">{plans.map((plan) => <article className="plan-card" key={plan.id}><div className="plan-card-date"><strong>{new Date(`${plan.plan_date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</strong><b>{new Date(`${plan.plan_date}T12:00:00`).getDate()}</b><small>{new Date(`${plan.plan_date}T12:00:00`).toLocaleDateString('en-US', { month: 'short' })}</small></div><div className="plan-card-main"><div className="plan-card-heading"><div><span className="category-label">{plan.category}</span><h3>{plan.title}</h3></div><div className="card-actions"><button className="card-action" onClick={() => onEdit(plan.id)} aria-label={`Edit ${plan.title}`}><Edit3 size={15} /></button><button className="card-action danger-action" onClick={() => onDelete(plan.id)} aria-label={`Delete ${plan.title}`}><Trash2 size={15} /></button></div></div><p>{plan.context || 'No context added for this plan.'}</p><div className="plan-card-meta"><span><Clock3 size={14} /> {fmtTime(plan.plan_time)}</span><span><Users size={14} /> {people.find((person) => person.id === plan.person_id)?.name || 'Personal time'}</span></div></div></article>)}</div> : <div className="empty-state compact-empty"><div className="empty-icon"><CalendarDays size={20} /></div><p>{empty}</p></div>}</section>; }

function GoalsPage({ goals, limit, onAdd, onEdit, onDelete, onToggle }: { goals: Goal[]; limit: number | null; onAdd: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void; onToggle: (goal: Goal) => void }) { const activeCount = goals.filter((goal) => goal.status === 'active').length; return <div className="page-wrap goals-page"><section className="page-heading-row"><div><p className="eyebrow">THIS MONTH</p><h1>Goals</h1><p className="intro">A few gentle priorities to help your time reflect what matters.</p></div><button className="primary-button" onClick={onAdd}><Plus size={17} /> Add goal</button></section><div className="goal-limit"><Target size={16} /><span>{limit ? `${activeCount} of ${limit} active goals on Free` : `${activeCount} active ${activeCount === 1 ? 'goal' : 'goals'}`}</span>{limit && <div className="goal-progress"><i style={{ width: `${Math.min(activeCount / limit * 100, 100)}%` }} /></div>}</div>{goals.length ? <div className="goals-grid">{goals.map((goal) => <article className={`goal-card ${goal.status === 'completed' ? 'goal-completed' : ''}`} key={goal.id}><div className="goal-card-top"><span className="category-label">{goal.category}</span><div className="card-actions"><button className="card-action" onClick={() => onEdit(goal.id)} aria-label={`Edit ${goal.title}`}><Edit3 size={15} /></button><button className="card-action danger-action" onClick={() => onDelete(goal.id)} aria-label={`Delete ${goal.title}`}><Trash2 size={15} /></button></div></div><h2>{goal.title}</h2><p>{goal.description || 'No description added.'}</p><button className="goal-status" onClick={() => onToggle(goal)}>{goal.status === 'active' ? <><span className="status-circle" /> Active priority</> : <><Check size={14} /> Completed</>}</button></article>)}</div> : <div className="empty-state"><div className="empty-icon"><Target size={21} /></div><h2>What deserves your attention?</h2><p>Keep it light. Start with one priority for this month.</p><button className="primary-button" onClick={onAdd}><Plus size={17} /> Add goal</button></div>}</div>; }

function EmptyInline({ text, action, onClick }: { text: string; action: string; onClick: () => void }) { return <div className="empty-inline"><span>{text}</span><button className="card-link" onClick={onClick}>{action} <ArrowUpRight size={14} /></button></div>; }

function DecisionPanel({ decision, ai, onClear }: { decision: NonNullable<DecisionResult>; ai: ReactNode; onClear: () => void }) {
  const { verdict } = decision;
  const kicker = { recall: 'LOOKING BACK', when: 'YOUR TIME TOGETHER', talk: 'TALKING POINTS', who: 'YOUR CIRCLE', cancel: 'KEEP OR RESCHEDULE', decide: 'YOUR ANSWER', say: 'WHAT TO SAY' }[decision.kind];
  // Recall questions are answered by the saved memories themselves, so show them up front.
  const memoriesFirst = decision.kind === 'recall' || decision.kind === 'talk' || decision.kind === 'say';
  const memories = decision.memories.length > 0 && <div className="decision-memories"><span className="card-kicker">{decision.kind === 'talk' ? 'THINGS TO BRING UP' : decision.kind === 'say' ? 'WORDS YOU COULD USE' : 'WHAT YOU SAVED'}</span>{decision.memories.map((memory) => <div className="decision-memory" key={`${memory.label}-${memory.date}-${memory.text}`}><span className="decision-memory-label">{memory.label}{memory.date && ` · ${memory.date}`}</span><p>{memory.text}</p></div>)}</div>;
  const hasDetails = Boolean(decision.summary || (!memoriesFirst && decision.memories.length) || decision.options.length || decision.reasonsToMeet.length || decision.reasonsToPostpone.length || decision.reasonsToGatherMore.length || decision.tradeoffs.length);
  return <div className={`decision-panel tone-${verdict.tone}`} aria-live="polite">
    <div className="decision-verdict"><span className="verdict-mark" aria-hidden="true" /><div className="verdict-copy"><span className="card-kicker">{kicker} — FROM YOUR SAVED DATA</span><h3>{verdict.headline}</h3><p>{verdict.reason}</p></div><button className="icon-button decision-clear" onClick={onClear} aria-label="Clear answer"><X size={16} /></button></div>
    {decision.glance.length > 0 && <dl className="decision-glance">{decision.glance.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>}
    {decision.followUp && <div className="decision-followup"><CircleHelp size={15} /><span>{decision.followUp}</span></div>}
    {ai}
    {memoriesFirst && memories}
    {hasDetails && <details className="decision-details"><summary>See the full reasoning <ChevronRight size={14} /></summary>
      {decision.summary && <p className="decision-summary">{decision.summary}</p>}
      {decision.matchedPeople.length > 0 && <div className="decision-match"><Users size={14} /><span>Related: {decision.matchedPeople.map((p) => p.name).join(', ')}</span></div>}
      {decision.matchedPlans.length > 0 && <div className="decision-match"><CalendarDays size={14} /><span>Related plans: {decision.matchedPlans.map((p) => p.title).join(', ')}</span></div>}
      {!memoriesFirst && memories}
      {decision.options.length > 0 && <div className="decision-options">{decision.options.map((option) => <div className="decision-option" key={option.label}><strong>{option.label}</strong><p>{option.detail}</p><span className="decision-evidence">{option.evidence}</span></div>)}</div>}
      {decision.reasonsToMeet.length > 0 && <div className="decision-reasons"><span className="card-kicker">REASONS TO GO AHEAD</span><ul>{decision.reasonsToMeet.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}
      {decision.reasonsToPostpone.length > 0 && <div className="decision-reasons"><span className="card-kicker">REASONS TO HOLD OFF</span><ul>{decision.reasonsToPostpone.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}
      {decision.reasonsToGatherMore.length > 0 && <div className="decision-reasons"><span className="card-kicker">WORTH CHECKING</span><ul>{decision.reasonsToGatherMore.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}
      {decision.tradeoffs.length > 0 && <div className="decision-tradeoffs"><span className="card-kicker">TRADE-OFFS</span><ul>{decision.tradeoffs.map((tradeoff) => <li key={tradeoff}>{tradeoff}</li>)}</ul></div>}
    </details>}
  </div>;
}

function ReflectionsPage({ reflections, people, onSave, onDelete, ai }: { reflections: Reflection[]; people: Person[]; onSave: (event: FormEvent<HTMLFormElement>) => void; onDelete: (id: string) => void; ai: ReactNode }) {
  return <div className="page-wrap reflections-page"><section className="page-heading-row"><div><p className="eyebrow">A QUIET PRACTICE</p><h1>Reflections</h1><p className="intro">Pause and notice what is true for you right now. Nothing needs to be solved.</p></div></section><section className="reflection-compose"><form onSubmit={onSave}><label>What is on your mind?<textarea name="text" autoFocus placeholder="Write a few lines…" required /></label>{people.length > 0 && <div className="reflection-tag"><label>About someone<span className="label-optional">Optional</span><select name="person_id" defaultValue=""><option value="">No one in particular</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label></div>}<div className="prompt-list">{reflectionPrompts.map((prompt) => <button type="button" key={prompt} className="prompt-pill" onClick={(event) => { const ta = (event.currentTarget.closest('form')?.querySelector('textarea')); if (ta) { ta.value = prompt; ta.focus(); } }}>{prompt}<ArrowUpRight size={14} /></button>)}</div><div className="modal-actions"><button type="submit" className="primary-button"><Check size={16} /> Save reflection</button></div></form></section><section className="reflection-history"><div className="section-heading"><div><span className="card-kicker">SAVED REFLECTIONS</span><h2>Previous reflections</h2></div><span className="group-count">{reflections.length}</span></div>{ai && <div className="reflection-ai">{ai}</div>}{reflections.length ? <div className="reflection-list">{reflections.map((reflection) => <article className="reflection-card-item" key={reflection.id}><div className="reflection-item-top"><span className="reflection-date">{new Date(reflection.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} · {new Date(reflection.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}{people.find((person) => person.id === reflection.person_id) && <> · About {people.find((person) => person.id === reflection.person_id)?.name}</>}</span><button className="card-action danger-action" onClick={() => onDelete(reflection.id)} aria-label="Delete reflection"><Trash2 size={15} /></button></div><p>{reflection.text}</p></article>)}</div> : <div className="empty-state compact-empty"><div className="empty-icon"><BookOpen size={20} /></div><p>No reflections yet. Start with one above.</p></div>}</section></div>;
}

function ColorField({ value }: { value: string }) {
  return <fieldset className="color-field"><legend>Colour</legend><div className="color-swatches">{personColors.map((color) => <label key={color} className="color-swatch" style={{ backgroundColor: color }}><input type="radio" name="color" value={color} defaultChecked={color === value} aria-label={`Colour ${color}`} /><Check size={13} /></label>)}</div></fieldset>;
}

function PersonModal({ person, defaultColor, onClose, onSubmit }: { person?: Person; defaultColor: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <ModalFrame title={person ? 'Edit person' : 'Add someone'} eyebrow="YOUR CIRCLE" onClose={onClose}><form onSubmit={onSubmit}><label>Name<input name="name" defaultValue={person?.name} autoFocus placeholder="e.g. Alex Morgan" required /></label><label>Relationship<span className="label-optional">Optional</span><input name="relationship" defaultValue={person?.relationship} placeholder="e.g. close friend, colleague" /></label><label>Context<span className="label-optional">Optional</span><input name="detail" defaultValue={person?.detail} placeholder="What helps you remember this relationship?" /></label><label>Note<span className="label-optional">Optional</span><textarea name="note" defaultValue={person?.note} placeholder="A small thing worth remembering" /></label><ColorField value={person?.color || defaultColor} /><ModalActions onClose={onClose} label={person ? 'Save changes' : 'Add person'} /></form></ModalFrame>; }

function PlanModal({ plan, presetPersonId, people, error, onClose, onSubmit }: { plan?: Plan; presetPersonId: string | null; people: Person[]; error: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <ModalFrame title={plan ? 'Edit plan' : 'Add a plan'} eyebrow="YOUR TIME" onClose={onClose}><form onSubmit={onSubmit}><label>Title<input name="title" defaultValue={plan?.title} autoFocus placeholder="e.g. Dinner with Maya" required /></label><div className="form-row"><label>Date<input type="date" name="plan_date" defaultValue={plan?.plan_date} required /></label><label>Time<input type="time" name="plan_time" defaultValue={plan?.plan_time?.slice(0, 5)} required /></label></div><div className="form-row"><label>Person<select name="person_id" defaultValue={plan?.person_id || presetPersonId || ''}><option value="">Personal time</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label>Category<select name="category" defaultValue={plan?.category || 'Personal'}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label></div><label>Context<span className="label-optional">Optional</span><textarea name="context" defaultValue={plan?.context} placeholder="What do you want to keep in mind?" /></label>{error && <p className="form-error" role="alert">{error}</p>}<ModalActions onClose={onClose} label={plan ? 'Save changes' : 'Add plan'} /></form></ModalFrame>; }

function GoalModal({ goal, error, onClose, onSubmit }: { goal?: Goal; error: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <ModalFrame title={goal ? 'Edit goal' : 'Add a monthly goal'} eyebrow="THIS MONTH" onClose={onClose}><form onSubmit={onSubmit}><label>Title<input name="title" defaultValue={goal?.title} autoFocus placeholder="e.g. Protect two evenings for rest" required /></label><label>Category<select name="category" defaultValue={goal?.category || 'Relationships'}>{goalCategories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Description<span className="label-optional">Optional</span><textarea name="description" defaultValue={goal?.description} placeholder="What would this look like in practice?" /></label>{goal && <label>Status<select name="status" defaultValue={goal.status}><option value="active">Active</option><option value="completed">Completed</option></select></label>}{error && <p className="form-error" role="alert">{error}</p>}<ModalActions onClose={onClose} label={goal ? 'Save changes' : 'Add goal'} /></form></ModalFrame>; }

const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function ModalFrame({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  // Read during the first render, before an autoFocus field inside the form takes focus.
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  // Keyboard users stay inside the open form: focus moves in, Tab and Shift+Tab cycle within it,
  // Escape closes it, and focus returns to whatever opened it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.contains(document.activeElement)) (dialog.querySelector<HTMLElement>(focusableSelector) ?? dialog).focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { closeRef.current(); return; }
      if (event.key !== 'Tab' || !dialog) return;
      const items = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)].filter((item) => item.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const outside = !dialog.contains(document.activeElement);
      if (event.shiftKey && (outside || document.activeElement === first)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (outside || document.activeElement === last)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); if (opener && document.contains(opener)) opener.focus(); };
  }, [opener]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={dialogRef} tabIndex={-1}><div className="modal-header"><div><span className="card-kicker">{eyebrow}</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>{children}</div></div>; }
function ModalActions({ onClose, label }: { onClose: () => void; label: string }) { return <div className="modal-actions"><button type="button" className="quiet-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button"><Check size={16} /> {label}</button></div>; }

const energyScore = { low: 0, okay: 1, good: 2 } as const;
const dayDiff = (from: string, to: string) => Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000);

// Gentle patterns from daily check-ins and reflections. Each needs enough data before it says anything.
function findPatterns(checkins: CheckIn[], people: Person[], plans: Plan[], reflections: Reflection[]): string[] {
  const patterns: string[] = [];
  const rated = checkins.filter((checkin): checkin is CheckIn & { energy: NonNullable<Energy> } => checkin.energy !== null);
  const busy: number[] = [];
  const calm: number[] = [];
  rated.forEach((checkin) => {
    const priorWeek = plans.filter((plan) => plan.person_id && dayDiff(plan.plan_date, checkin.date) >= 1 && dayDiff(plan.plan_date, checkin.date) <= 7).length;
    (priorWeek >= 3 ? busy : calm).push(energyScore[checkin.energy]);
  });
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  if (busy.length >= 3 && calm.length >= 3) {
    const gap = average(calm) - average(busy);
    if (gap >= 0.5) patterns.push('Your energy tends to dip after weeks with three or more plans.');
    if (gap <= -0.5) patterns.push('Busier weeks seem to lift your energy.');
  }
  const quietDays = rated.filter((checkin) => checkin.social === 'quiet').length;
  if (rated.length >= 7 && quietDays / rated.length >= 0.5) patterns.push('You’ve wanted quiet on most days lately — it may be worth protecting a free evening.');
  people.forEach((person) => {
    const tones = personInsight(person, plans, reflections).reflections.map((reflection) => feelingOf(reflection).tone);
    const first = person.name.split(' ')[0];
    if (tones.length >= 2 && tones.filter((tone) => tone === 'positive').length / tones.length >= 0.66) patterns.push(`Time with ${first} usually leaves you feeling good.`);
    if (tones.length >= 2 && tones.filter((tone) => tone === 'negative').length / tones.length >= 0.66) patterns.push(`Time with ${first} has often felt draining — shorter plans may help.`);
  });
  return patterns.slice(0, 4);
}

function ChoiceRow<T extends string | number | boolean>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T | null; onChange: (value: T | null) => void }) {
  return <div className="choice-row" role="group" aria-label={label}><span className="choice-label">{label}</span><div className="choice-options">{options.map((option) => <button type="button" key={String(option.value)} className={`energy-option ${value === option.value ? 'energy-active' : ''}`} aria-pressed={value === option.value} onClick={() => onChange(value === option.value ? null : option.value)}>{option.label}</button>)}</div></div>;
}

function DayToggles({ label, value, onChange }: { label: string; value: number[]; onChange: (days: number[]) => void }) {
  return <div className="choice-row" role="group" aria-label={label}><span className="choice-label">{label}</span><div className="choice-options">{weekdayOrder.map((weekday) => <button type="button" key={weekday} className={`day-toggle ${value.includes(weekday) ? 'energy-active' : ''}`} aria-pressed={value.includes(weekday)} aria-label={weekdayNames[weekday]} onClick={() => onChange(value.includes(weekday) ? value.filter((item) => item !== weekday) : [...value, weekday])}>{weekdayNames[weekday].slice(0, 3)}</button>)}</div></div>;
}

function YouPage({ profile, onSaveProfile, todayCheckIn, onCheckIn, checkins, people, plans, reflections }: { profile: Profile; onSaveProfile: (patch: Partial<Profile>) => void; todayCheckIn?: CheckIn; onCheckIn: (patch: Partial<CheckIn>) => void; checkins: CheckIn[]; people: Person[]; plans: Plan[]; reflections: Reflection[] }) {
  const [about, setAbout] = useState({ name: profile.name, pronouns: profile.pronouns, intention: profile.intention });
  const [saved, setSaved] = useState('');
  const [mood, setMood] = useState(todayCheckIn?.mood ?? '');
  const saveMood = () => { if (mood.trim() !== (todayCheckIn?.mood ?? '')) onCheckIn({ mood: mood.trim() }); };
  const first = profile.name.split(' ')[0];
  const strip = Array.from({ length: 14 }, (_, index) => {
    const date = daysFromToday(index - 13);
    return { date, energy: checkins.find((checkin) => checkin.date === date)?.energy ?? null };
  });
  const patterns = findPatterns(checkins, people, plans, reflections);
  const checkedInDays = checkins.filter((checkin) => checkin.energy).length;
  const saveAbout = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSaveProfile({ name: about.name.trim(), pronouns: about.pronouns.trim(), intention: about.intention.trim() });
    setSaved('Saved.');
  };
  return <div className="page-wrap you-page">
    <section className="page-heading-row"><div><p className="eyebrow">YOU</p><h1>{first ? `Hi, ${first}.` : 'Your space'}</h1><p className="intro">A few things that help Kinly answer like a friend who knows you. It all stays in this browser.</p></div></section>

    <section className="content-card you-today"><div className="card-header"><div><span className="card-kicker">TODAY · {fmtDate(localDateKey()).toUpperCase()}</span><h2>How are you arriving today?</h2></div></div>
      <ChoiceRow label="Energy" value={todayCheckIn?.energy ?? null} onChange={(value) => onCheckIn({ energy: value })} options={energyLevels} />
      <ChoiceRow label="Social appetite" value={todayCheckIn?.social ?? null} onChange={(value) => onCheckIn({ social: value })} options={[{ value: 'company' as const, label: 'Up for company' }, { value: 'quiet' as const, label: 'Want some quiet' }]} />
      <ChoiceRow label="Free tonight?" value={todayCheckIn?.freeTonight ?? null} onChange={(value) => onCheckIn({ freeTonight: value })} options={[{ value: true, label: 'Yes' }, { value: false, label: 'Not really' }]} />
      <div className="choice-row"><label className="choice-label" htmlFor="today-mood">One word for today</label><input id="today-mood" className="you-input mood-input" value={mood} maxLength={24} placeholder="calm, stretched, hopeful…" onChange={(event) => setMood(event.target.value)} onBlur={saveMood} onKeyDown={(event) => { if (event.key === 'Enter') saveMood(); }} /></div>
      <p className="you-note">Resets tomorrow. Today’s answers use it automatically.</p>
    </section>

    <section className="content-card you-patterns"><div className="card-header"><div><span className="card-kicker">YOUR LAST 14 DAYS</span><h2>Energy and patterns</h2></div></div>
      <div className="energy-strip" aria-label="Energy over the last 14 days">{strip.map((cell) => <div key={cell.date} className={`strip-cell strip-${cell.energy ?? 'none'}`} title={`${fmtDate(cell.date)}: ${cell.energy ?? 'no check-in'}`}><span>{weekdayNames[new Date(`${cell.date}T12:00:00`).getDay()].slice(0, 1)}</span></div>)}</div>
      <div className="strip-legend"><span><i className="strip-cell strip-low" /> Low</span><span><i className="strip-cell strip-okay" /> Okay</span><span><i className="strip-cell strip-good" /> Good</span></div>
      {patterns.length ? <ul className="pattern-list">{patterns.map((pattern) => <li key={pattern}><Sparkles size={13} />{pattern}</li>)}</ul> : <p className="insight-empty">{checkedInDays < 6 ? `Check in for a few more days (${checkedInDays} so far) and patterns will start to appear here.` : 'No clear patterns yet. Keep checking in and writing reflections.'}</p>}
    </section>

    <section className="content-card you-about"><div className="card-header"><div><span className="card-kicker">ABOUT YOU</span><h2>What Kinly should know</h2></div></div>
      <form onSubmit={saveAbout} className="you-form">
        <div className="you-fields"><label>Name<input className="you-input" value={about.name} maxLength={40} onChange={(event) => { setAbout({ ...about, name: event.target.value }); setSaved(''); }} placeholder="What should Kinly call you?" /></label><label>Pronouns<span className="label-optional">Optional</span><input className="you-input" value={about.pronouns} maxLength={24} onChange={(event) => { setAbout({ ...about, pronouns: event.target.value }); setSaved(''); }} placeholder="they/them" /></label></div>
        <label>A personal intention<span className="label-optional">Optional</span><input className="you-input" value={about.intention} maxLength={120} onChange={(event) => { setAbout({ ...about, intention: event.target.value }); setSaved(''); }} placeholder="See family more this month" /></label>
        <div className="you-form-actions"><button type="submit" className="primary-button"><Check size={16} /> Save</button>{saved && <span className="settings-status">{saved}</span>}</div>
      </form>
      <ChoiceRow label="What recharges you" value={profile.recharge || null} onChange={(value) => onSaveProfile({ recharge: value ?? '' })} options={[{ value: 'alone' as const, label: 'Time alone' }, { value: 'one-on-one' as const, label: 'One-on-one' }, { value: 'small-group' as const, label: 'Small groups' }]} />
      <DayToggles label="Usual free evenings" value={profile.freeEvenings} onChange={(days) => onSaveProfile({ freeEvenings: days })} />
    </section>

    <section className="content-card you-rhythm"><div className="card-header"><div><span className="card-kicker">YOUR RHYTHM</span><h2>Connection goal and quiet days</h2></div></div>
      <ChoiceRow label="See this many people a week" value={profile.weeklyGoal || null} onChange={(value) => onSaveProfile({ weeklyGoal: value ?? 0 })} options={[1, 2, 3, 4, 5].map((count) => ({ value: count, label: String(count) }))} />
      <DayToggles label="Quiet days — no new plan suggestions" value={profile.quietDays} onChange={(days) => onSaveProfile({ quietDays: days })} />
      <p className="you-note">Your weekly progress shows on Home. On quiet days, Kinly leans towards rest.</p>
    </section>
  </div>;
}

function SettingsPage({ plan, aiEnabled, onToggleAi, counts, onExport, onImport, onDeleteAll, onRestoreExamples }: { plan: ReturnType<typeof usePlan>; aiEnabled: boolean; onToggleAi: (on: boolean) => string; counts: Record<CollectionKey, number>; onExport: () => string; onImport: (file: File) => Promise<string>; onDeleteAll: () => string; onRestoreExamples: () => string }) {
  const [status, setStatus] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
  const choseFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) setStatus(await onImport(file));
  };
  return <div className="page-wrap settings-page">
    <section className="page-heading-row"><div><p className="eyebrow">YOUR DATA</p><h1>Settings</h1><p className="intro">Everything in Kinly stays on this device. Here is how to keep it safe.</p></div></section>
    <section className="content-card settings-privacy"><div className="reflection-icon"><ShieldCheck size={19} /></div><div><span className="card-kicker">WHERE YOUR DATA LIVES</span><h2>Only in this browser</h2><p>The people, plans, goals and reflections you add are saved in this browser on this device. They are not sent to Kinly or anyone else, unless you turn on AI features below and use one. That also means clearing your browser data, using a private window, or switching to another device will not bring them with you — export a backup to keep a copy.</p><p className="settings-counts">Saved here now: {counts.people} {counts.people === 1 ? 'person' : 'people'} · {plural(counts.plans, 'plan')} · {plural(counts.goals, 'goal')} · {plural(counts.reflections, 'reflection')}</p></div></section>
    <SubscriptionCard plan={plan} />
    <AccountCard />
    <BackupCard onExport={onExport} />
    <section className={`content-card settings-ai ${aiEnabled ? 'settings-ai-on' : ''}`}><div className="reflection-icon"><Sparkles size={19} /></div><div className="settings-ai-copy"><span className="card-kicker">KINLY PLUS · AI</span><h2>AI features</h2><p>Kinly Plus includes AI reflections, conversation preparation, decision and relationship analysis, and weekly reviews, written by an AI model running on Cloudflare, which doesn’t use what’s sent to train AI. Each one sends only the notes, plans and reflections it needs, and only when you tap it; Kinly doesn’t store them. Each button shows its cost in AI credits before you tap, and failed requests never use credits.</p><p className="settings-ai-status">{aiEnabled ? 'On — only sent when you ask.' : 'Off — everything stays in this browser.'}</p></div><button className={aiEnabled ? 'quiet-button' : 'primary-button'} onClick={() => setStatus(onToggleAi(!aiEnabled))} aria-pressed={aiEnabled}>{aiEnabled ? 'Turn off' : 'Turn on'}</button></section>
    <div className="settings-grid">
      <section className="content-card settings-card"><span className="card-kicker">BACK UP</span><h2>Export a backup</h2><p>Download everything as a single file. Keep it somewhere safe, or use it to move to another device or browser.</p><div className="settings-actions"><button className="primary-button" onClick={() => setStatus(onExport())}><Download size={16} /> Export backup</button></div></section>
      <section className="content-card settings-card"><span className="card-kicker">RESTORE</span><h2>Import a backup</h2><p>Load a backup file you exported earlier. It replaces what is saved in this browser now.</p><div className="settings-actions"><button className="quiet-button" onClick={() => fileRef.current?.click()}><Upload size={16} /> Import backup</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={choseFile} /></div></section>
      <section className="content-card settings-card"><span className="card-kicker">START FRESH</span><h2>Clear your space</h2><p>Remove everything saved here, or bring back the example people and plans to explore again.</p><div className="settings-actions"><button className="quiet-button danger-button" onClick={() => setStatus(onDeleteAll())}><Trash2 size={16} /> Delete all data</button><button className="quiet-button" onClick={() => setStatus(onRestoreExamples())}>Restore examples</button></div></section>
    </div>
    {status && <p className="settings-status" role="status">{status}</p>}
  </div>;
}

export default App;
