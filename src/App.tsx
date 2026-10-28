import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Command,
  Edit3,
  Home,
  Menu,
  Plus,
  Search,
  Settings,
  Sparkles,
  Target,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { createLocalId, readLocalCollection, writeLocalCollection } from './lib/storage';
import { people as seedPeople, prompts, type Person as SeedPerson } from './mockData';

type Page = 'home' | 'people' | 'plans' | 'reflections' | 'goals' | 'settings';
type Person = Omit<SeedPerson, 'id'> & { id: string };
type Plan = { id: string; title: string; plan_date: string; plan_time: string; person_id: string | null; category: string; context: string };
type Goal = { id: string; title: string; description: string; category: string; status: 'active' | 'completed'; month_start: string };
type Reflection = { id: string; text: string; created_at: string };
type Modal = 'person' | 'plan' | 'goal' | null;
type DecisionOption = { label: string; detail: string; evidence: string };
type DecisionResult = {
  summary: string;
  options: DecisionOption[];
  reasonsToMeet: string[];
  reasonsToPostpone: string[];
  reasonsToGatherMore: string[];
  tradeoffs: string[];
  recommendation: string | null;
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

// Everyday words that would otherwise match almost any saved note.
const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'about', 'that', 'this', 'what', 'when', 'where', 'which', 'who', 'why', 'how', 'did', 'does', 'should', 'would', 'could', 'can', 'will', 'was', 'were', 'are', 'have', 'has', 'had', 'last', 'next', 'tonight', 'today', 'tomorrow', 'into', 'them', 'they', 'their', 'her', 'his', 'him', 'she', 'you', 'your', 'our', 'not', 'but', 'any', 'some', 'just', 'feel', 'think', 'want', 'need', 'get']);

const wordsOf = (text: string) => text.toLowerCase().match(/[a-z0-9']+/g) || [];

function buildDecision(query: string, people: Person[], plans: Plan[], goals: Goal[]): DecisionResult {
  const q = query.toLowerCase().trim();
  if (!q) return null;
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
  const person = matchedPeople[0];
  const personName = person?.name;
  const personPlans = person ? upcoming.filter((plan) => plan.person_id === person.id) : [];
  const personPastPlans = person ? plans.filter((plan) => plan.person_id === person.id && !isUpcoming(plan)) : [];
  const activeGoals = goals.filter((goal) => goal.status === 'active');
  const scheduleCount = upcoming.length;

  const reasonsToMeet: string[] = [];
  const reasonsToPostpone: string[] = [];
  const reasonsToGatherMore: string[] = [];
  const tradeoffs: string[] = [];
  const options: DecisionOption[] = [];
  let recommendation: string | null = null;
  let followUp: string | null = null;

  const contextParts: string[] = [];

  if (person) {
    contextParts.push(`${personName} is saved in your circle as "${person.relationship}".`);
    if (person.note) contextParts.push(`Your note about them: "${person.note}"`);
    if (person.detail) contextParts.push(`Context you saved: "${person.detail}"`);
  }

  if (personPlans.length) {
    contextParts.push(`You have ${personPlans.length} upcoming plan${personPlans.length === 1 ? '' : 's'} with ${personName}: ${personPlans.map((plan) => `"${plan.title}" on ${fmtDate(plan.plan_date)} at ${plan.plan_time.slice(0, 5)}`).join('; ')}.`);
    personPlans.forEach((plan) => { if (plan.context) contextParts.push(`Plan context for "${plan.title}": "${plan.context}"`); });
  }

  if (personPastPlans.length) {
    contextParts.push(`You have ${personPastPlans.length} past plan${personPastPlans.length === 1 ? '' : 's'} with ${personName}.`);
  }

  if (matchedPlans.length && !person) {
    const plan = matchedPlans[0];
    contextParts.push(`This relates to a saved plan: "${plan.title}" (${plan.category}) on ${fmtDate(plan.plan_date)} at ${plan.plan_time.slice(0, 5)}.`);
    if (plan.context) contextParts.push(`Plan context: "${plan.context}"`);
  }

  if (matchedGoals.length) {
    const goal = matchedGoals[0];
    contextParts.push(`This connects to your ${goal.status === 'active' ? 'active' : 'completed'} goal: "${goal.title}" (${goal.category}).`);
    if (goal.description) contextParts.push(`Goal description: "${goal.description}"`);
  }

  if (activeGoals.length) {
    contextParts.push(`Your active monthly ${activeGoals.length === 1 ? 'goal is' : 'goals are'}: ${activeGoals.map((goal) => `"${goal.title}"`).join(', ')}.`);
  }

  if (scheduleCount) {
    contextParts.push(`You have ${scheduleCount} upcoming plan${scheduleCount === 1 ? '' : 's'} in total.`);
  }

  // --- Person-centred decision ---
  if (person) {
    // Reasons to meet
    if (personPlans.length) {
      reasonsToMeet.push(`You already have "${personPlans[0].title}" planned with ${personName} on ${fmtDate(personPlans[0].plan_date)} — this plan already exists.`);
    }
    if (person.note) {
      reasonsToMeet.push(`Your saved note about ${personName} — "${person.note}" — suggests there is something specific worth following up on.`);
    }
    if (!personPlans.length) {
      reasonsToMeet.push(`${personName} has no upcoming plans in your calendar, so there may be room to add one.`);
    }
    if (matchedGoals.some((goal) => goal.category === 'Relationships' && goal.status === 'active')) {
      reasonsToMeet.push(`You have an active Relationships goal: "${matchedGoals.find((goal) => goal.category === 'Relationships')?.title}" — meeting supports it.`);
    }

    // Reasons to postpone
    if (scheduleCount >= 3) {
      reasonsToPostpone.push(`You already have ${scheduleCount} upcoming plans. Adding another may spread your attention thin.`);
    }
    if (personPlans.length) {
      reasonsToPostpone.push(`You already have a plan with ${personName} on ${fmtDate(personPlans[0].plan_date)}. Meeting again tonight may be redundant.`);
    }
    if (activeGoals.some((goal) => goal.category === 'Rest' || goal.category === 'Wellbeing')) {
      reasonsToPostpone.push(`You have an active ${activeGoals.find((goal) => goal.category === 'Rest' || goal.category === 'Wellbeing')?.category} goal: "${activeGoals.find((goal) => goal.category === 'Rest' || goal.category === 'Wellbeing')?.title}". An evening at home might serve that.`);
    }

    // Reasons to gather more info
    if (!person.note && !person.detail) {
      reasonsToGatherMore.push(`You have not saved a note or context for ${personName}. Adding one would make this decision clearer.`);
    }
    reasonsToGatherMore.push(`Check how you feel physically and socially tonight — your saved data cannot tell you your current energy level.`);

    // Options with evidence
    if (personPlans.length) {
      options.push({ label: 'Keep the existing plan', detail: `You already have "${personPlans[0].title}" with ${personName} on ${fmtDate(personPlans[0].plan_date)} at ${personPlans[0].plan_time.slice(0, 5)}. Consider whether tonight is in addition to that or instead of it.`, evidence: `Saved plan: "${personPlans[0].title}" on ${personPlans[0].plan_date} at ${personPlans[0].plan_time}.` });
    } else {
      options.push({ label: 'Add a low-pressure plan', detail: `A short walk or coffee with ${personName} this week could keep the connection warm without overcommitting your evening.`, evidence: `${personName} has no upcoming plans in your saved data.` });
    }
    options.push({ label: 'Postpone and protect the evening', detail: `Stay home tonight and rest. You can reach out to ${personName} when your schedule and energy feel steadier.`, evidence: scheduleCount >= 3 ? `You have ${scheduleCount} upcoming plans already.` : `No specific plan with ${personName} would be disrupted.` });

    // Trade-offs
    tradeoffs.push('Meeting tonight sustains closeness, but if your energy is low it may not feel meaningful to either of you.');
    tradeoffs.push('Postponing protects your energy, but delays the follow-through your note suggests matters.');
    if (personPlans.length) tradeoffs.push('Adding a second plan so close to an existing one may dilute the quality of both.');

    // Recommendation logic
    const meetSignal = (person.note ? 1 : 0) + (matchedGoals.some((goal) => goal.category === 'Relationships') ? 1 : 0) + (personPlans.length ? 1 : 0);
    const postponeSignal = (scheduleCount >= 3 ? 1 : 0) + (activeGoals.some((goal) => goal.category === 'Rest' || goal.category === 'Wellbeing') ? 1 : 0) + (personPlans.length ? 1 : 0);

    if (meetSignal >= 2 && postponeSignal <= 1) {
      recommendation = `Based on your saved notes and goals, meeting ${personName} seems well-supported — but only if your energy tonight can hold it. If not, postponing is a reasonable choice.`;
    } else if (postponeSignal >= 2 && meetSignal <= 1) {
      recommendation = `Your saved plans and goals suggest the evening might be better spent resting. Consider reaching out to ${personName} to set something up for later this week instead.`;
    } else {
      recommendation = null;
      followUp = `What is your energy like right now? Your saved data does not capture how today has felt, and that matters as much as the plans and notes here.`;
    }

  // --- Plan-centred decision (no person matched) ---
  } else if (matchedPlans.length) {
    const plan = matchedPlans[0];
    const linkedPerson = people.find((person) => person.id === plan.person_id);

    reasonsToMeet.push(`"${plan.title}" is already saved for ${fmtDate(plan.plan_date)} at ${plan.plan_time.slice(0, 5)}.`);
    if (plan.context) reasonsToMeet.push(`Your saved context: "${plan.context}"`);
    if (linkedPerson) reasonsToMeet.push(`This plan is linked to ${linkedPerson.name}.`);

    reasonsToPostpone.push(`The plan is set for ${fmtDate(plan.plan_date)} — meeting tonight would be in addition to, not instead of, that.`);
    if (scheduleCount >= 3) reasonsToPostpone.push(`You have ${scheduleCount} upcoming plans already.`);

    if (!plan.context) reasonsToGatherMore.push(`This plan has no saved context. Adding one would clarify whether tonight fits.`);
    reasonsToGatherMore.push(`Check whether anything else on your calendar tonight conflicts.`);

    options.push({ label: 'Go ahead with the saved plan', detail: `"${plan.title}" is already on your calendar for ${fmtDate(plan.plan_date)}. Trust the intention you captured.`, evidence: `Saved plan: "${plan.title}" on ${plan.plan_date} at ${plan.plan_time}.` });
    options.push({ label: 'Reconsider the timing', detail: `Review whether the current slot competes with a rest or wellbeing goal before confirming.`, evidence: activeGoals.length ? `Active goals: ${activeGoals.map((goal) => `"${goal.title}"`).join(', ')}.` : `No active goals saved.` });

    tradeoffs.push('Following through on a saved plan builds trust with yourself.');
    tradeoffs.push('Adjusting now is easier than dragging through a plan that no longer fits.');

    if (linkedPerson && plan.context) {
      recommendation = `Your saved context for "${plan.title}" suggests the plan is intentional. Unless something has shifted today, keeping it seems reasonable.`;
    } else {
      recommendation = null;
      followUp = `What has changed since you saved "${plan.title}"? If the context still feels right, keeping the plan makes sense.`;
    }

  // --- Goal-centred decision ---
  } else if (matchedGoals.length) {
    const goal = matchedGoals[0];

    if (goal.status === 'active') {
      reasonsToMeet.push(`Your active goal "${goal.title}" (${goal.category}) could benefit from a concrete step this week.`);
      if (goal.description) reasonsToMeet.push(`Goal description: "${goal.description}"`);
    }
    reasonsToPostpone.push(`"${goal.title}" is a monthly goal — there is time, and not every evening needs to advance it.`);
    reasonsToGatherMore.push(`Consider which specific action would move "${goal.title}" forward before committing tonight.`);

    options.push({ label: 'Take a small step toward it', detail: `Choose one concrete action this week that moves "${goal.title}" forward.`, evidence: `Active goal: "${goal.title}" in ${goal.category}.` });
    options.push({ label: 'Pause and revisit', detail: `Let the goal sit if your attention is needed elsewhere tonight.`, evidence: `Monthly goal — no immediate deadline in your saved data.` });

    tradeoffs.push('A small step sustains momentum without overwhelming your week.');
    tradeoffs.push('Pausing avoids overcommitting but risks losing the thread of the goal.');

    if (goal.status === 'active' && goal.description) {
      recommendation = `Your goal "${goal.title}" has a description, which suggests you have thought about it. A small step tonight could be worthwhile if your evening is otherwise open.`;
    } else {
      recommendation = null;
      followUp = `What would a "small step" toward "${goal.title}" look like concretely? Deciding that first would make tonight's choice clearer.`;
    }

  // --- No match, but upcoming plans exist ---
  } else if (upcoming.length) {
    contextParts.push(`No saved person, plan, or goal matched your question. Your next upcoming plan is "${upcoming[0].title}" on ${fmtDate(upcoming[0].plan_date)}.`);

    reasonsToGatherMore.push(`No saved data matched this question. Try searching by a person's name or a plan title.`);
    reasonsToGatherMore.push(`Consider whether this question relates to someone or something not yet in your saved data.`);

    options.push({ label: 'Focus on your next plan', detail: `"${upcoming[0].title}" is coming up on ${fmtDate(upcoming[0].plan_date)}.`, evidence: `Next upcoming plan: "${upcoming[0].title}".` });
    options.push({ label: 'Add context first', detail: `Add a person or plan related to this question so future decisions can draw on it.`, evidence: `No match found for: "${query}".` });

    tradeoffs.push('Acting on what is already planned keeps your commitments intact.');
    tradeoffs.push('Pausing to add context now makes future decisions sharper.');

    recommendation = null;
    followUp = `Who or what is this question about? Try adding them to your People or Plans so the decision has something to work with.`;

  // --- No data at all ---
  } else {
    contextParts.push('You have no saved people, plans, or goals yet. There is nothing in your workspace for this question to draw on.');

    reasonsToGatherMore.push('No saved people, plans, or goals exist yet. Adding even one would give this decision shape.');

    options.push({ label: 'Add a person', detail: 'Name someone who is on your mind so future decisions can include them.', evidence: 'No people saved yet.' });
    options.push({ label: 'Add a plan', detail: 'Capture one intention for the week so you can weigh competing choices.', evidence: 'No plans saved yet.' });

    tradeoffs.push('Adding structure now makes later decisions clearer.');
    tradeoffs.push('Staying open avoids premature commitment but keeps things vague.');

    recommendation = null;
    followUp = `Who is this question about? Start by adding them as a person — then ask again.`;
  }

  const summary = contextParts.join(' ');

  return { summary, options, reasonsToMeet, reasonsToPostpone, reasonsToGatherMore, tradeoffs, recommendation, followUp, matchedPeople, matchedPlans };
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
const maxActiveGoals = 3;
const goalLimitMessage = 'You can keep up to three active monthly goals. Complete or remove one first.';
const countActive = (goals: { status: string }[]) => goals.filter((goal) => goal.status === 'active').length;
const shortcutLabel = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl';

function Avatar({ person, size = 'md' }: { person: Person; size?: 'sm' | 'md' | 'lg' }) {
  return <div className={`avatar avatar-${size}`} style={{ backgroundColor: person.color }} aria-label={person.name}>{person.initials}</div>;
}

function App() {
  const [page, setPage] = useState<Page>('home');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [search, setSearch] = useState('');
  const [question, setQuestion] = useState('');
  const [submittedQuestion, setSubmittedQuestion] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = () => {
    setLoading(true);
    setError('');
    const loadedPeople = readLocalCollection<Person>('people', seedPeople);
    const seedPlans: Plan[] = [
      { id: 'dinner-at-lupa', title: 'Dinner at Lupa', plan_date: daysFromToday(1), plan_time: '19:00', person_id: loadedPeople.find((person) => person.name === 'Maya Chen')?.id || null, category: 'Social', context: 'A chance to catch up without rushing.' },
      { id: 'prospect-park-walk', title: 'Walk in Prospect Park', plan_date: daysFromToday(3), plan_time: '10:30', person_id: loadedPeople.find((person) => person.name === 'Arjun Mehta')?.id || null, category: 'Wellbeing', context: 'Keep the morning unhurried.' },
      { id: 'project-catch-up', title: 'Project catch-up', plan_date: daysFromToday(5), plan_time: '14:00', person_id: loadedPeople.find((person) => person.name === 'Elena Rossi')?.id || null, category: 'Work', context: 'Bring the first draft.' },
    ];
    setPeople(loadedPeople);
    setPlans(readLocalCollection<Plan>('plans', seedPlans));
    setGoals(readLocalCollection<Goal>('goals', []));
    setReflections(readLocalCollection<Reflection>('reflections', []));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const navigate = (nextPage: Page) => {
    setPage(nextPage);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const questionRef = useRef<HTMLInputElement>(null);
  const focusQuestion = () => {
    setPage('home');
    setMobileOpen(false);
    requestAnimationFrame(() => questionRef.current?.focus());
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

  const savePerson = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    if (!name) return;
    const relationship = String(form.get('relationship') || '').trim() || 'Person in your life';
    const values = { name, initials: name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(), relationship, detail: String(form.get('detail') || '').trim(), note: String(form.get('note') || '').trim(), color: '#526579' };
    const nextPeople = editingId
      ? people.map((person) => person.id === editingId ? { ...person, ...values } : person)
      : [...people, { ...values, id: createLocalId() }];
    writeLocalCollection('people', nextPeople);
    setModal(null); setEditingId(null); loadData();
  };

  const deletePerson = async (id: string) => {
    if (!window.confirm('Remove this person from your directory?')) return;
    const nextPeople = people.filter((person) => person.id !== id);
    writeLocalCollection('people', nextPeople);
    writeLocalCollection('plans', plans.map((plan) => plan.person_id === id ? { ...plan, person_id: null } : plan));
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
    if (countActive(nextGoals) > maxActiveGoals) { setError(goalLimitMessage); return; }
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
    if (countActive(nextGoals) > maxActiveGoals) { setError(goalLimitMessage); return; }
    writeLocalCollection('goals', nextGoals);
    loadData();
  };

  const saveReflection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = String(form.get('text') || '').trim();
    if (!text) return;
    const next = [{ id: createLocalId(), text, created_at: new Date().toISOString() }, ...reflections];
    writeLocalCollection('reflections', next);
    (event.target as HTMLFormElement).reset();
    loadData();
  };

  const deleteReflection = async (id: string) => {
    if (!window.confirm('Delete this reflection?')) return;
    writeLocalCollection('reflections', reflections.filter((r) => r.id !== id));
    loadData();
  };

  const submitQuestion = (override?: string) => { setSubmittedQuestion(override ?? question); };
  const decisionResult = useMemo(() => buildDecision(submittedQuestion, people, plans, goals), [submittedQuestion, people, plans, goals]);

  const openModal = (type: Modal, id: string | null = null) => { setModal(type); setEditingId(id); setError(''); };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <button className="brand" onClick={() => navigate('home')} aria-label="Go to Kinly home"><img className="brand-icon" src="/assets/kinly-icon.png" alt="" /><span className="brand-wordmark">Kinly</span></button>
          <button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <div className="workspace-label">YOUR SPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'nav-item-active' : ''}`} onClick={() => navigate(id)}><Icon size={18} strokeWidth={page === id ? 2.3 : 1.8} /><span>{label}</span>{id === 'home' && <span className="nav-dot" />}</button>)}
        </nav>
        <div className="sidebar-bottom"><div className="privacy-note"><Sparkles size={15} /><span>Your space is private<br />by design.</span></div><div className="profile-chip"><div className="profile-avatar">JL</div><div><strong>Jordan Lee</strong><span>Personal space</span></div><ChevronRight size={15} className="profile-chevron" /></div></div>
      </aside>
      {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <main className="main-content">
        <header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={21} /></button><div className="breadcrumbs"><span>Kinly</span><ChevronRight size={14} /><strong>{navigation.find((item) => item.id === page)?.label}</strong></div><div className="topbar-actions"><button className="icon-button" onClick={focusQuestion} aria-label="Ask a question" title={`Ask a question (${shortcutLabel} K)`}><Search size={18} /></button><div className="top-avatar">JL</div></div></header>
        {error && !modal && <div className="error-banner" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={15} /></button></div>}
        {loading ? <div className="loading-state"><div className="loading-dot" /><p>Preparing your space…</p></div> : <>
          {page === 'home' && <HomePage question={question} setQuestion={(v) => { setQuestion(v); setSubmittedQuestion(''); }} onSubmitQuestion={submitQuestion} decision={decisionResult} navigate={navigate} onAddPerson={() => openModal('person')} onAddPlan={() => openModal('plan')} questionRef={questionRef} people={people} plans={upcomingPlans} goals={activeGoals} />}
          {page === 'people' && <PeoplePage search={search} setSearch={setSearch} people={filteredPeople} onAdd={() => openModal('person')} onEdit={(id) => openModal('person', id)} onDelete={deletePerson} />}
          {page === 'plans' && <PlansPage plans={plans} people={people} onAdd={() => openModal('plan')} onEdit={(id) => openModal('plan', id)} onDelete={deletePlan} />}
          {page === 'goals' && <GoalsPage goals={goals} onAdd={() => openModal('goal')} onEdit={(id) => openModal('goal', id)} onDelete={deleteGoal} onToggle={toggleGoal} />}
          {page === 'reflections' && <ReflectionsPage reflections={reflections} onSave={saveReflection} onDelete={deleteReflection} />}
          {page === 'settings' && <PlaceholderPage page={page} navigate={navigate} />}
        </>}
      </main>
      {modal === 'person' && <PersonModal person={editingId ? people.find((item) => item.id === editingId) : undefined} onClose={() => { setModal(null); setEditingId(null); }} onSubmit={savePerson} />}
      {modal === 'plan' && <PlanModal plan={editingId ? plans.find((item) => item.id === editingId) : undefined} people={people} onClose={() => { setModal(null); setEditingId(null); }} onSubmit={savePlan} />}
      {modal === 'goal' && <GoalModal goal={editingId ? goals.find((item) => item.id === editingId) : undefined} error={error} onClose={() => { setModal(null); setEditingId(null); setError(''); }} onSubmit={saveGoal} />}
    </div>
  );
}

function HomePage({ question, setQuestion, onSubmitQuestion, decision, navigate, onAddPerson, onAddPlan, questionRef, people, plans, goals }: { question: string; setQuestion: (value: string) => void; onSubmitQuestion: (override?: string) => void; decision: DecisionResult; navigate: (page: Page) => void; onAddPerson: () => void; onAddPlan: () => void; questionRef: RefObject<HTMLInputElement>; people: Person[]; plans: Plan[]; goals: Goal[] }) {
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onSubmitQuestion(); };
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  return <div className="page-wrap home-page"><section className="welcome-row"><div><p className="eyebrow">{today}</p><h1>Your people. A more intentional tomorrow.</h1><p className="intro">Think clearly about your time, your relationships, and the choices between them.</p></div><button className="quiet-button" onClick={onAddPerson}><Plus size={16} /> Add a person</button></section><section className="reflection-card"><div className="reflection-icon"><Sparkles size={19} /></div><div className="reflection-copy"><span className="card-kicker">A MOMENT TO CONSIDER</span><h2>What would feel nourishing today?</h2><p>You have some open space this evening. Notice what your energy is asking for before you fill it.</p></div><button className="text-button" onClick={() => navigate('reflections')}>Reflect for a minute <ArrowUpRight size={15} /></button></section><section className="ask-section"><div className="section-heading"><div><span className="card-kicker">THINK IT THROUGH</span><h2>Bring a question to mind.</h2></div><CircleHelp size={18} /></div><form className="question-box" onSubmit={submit}><Search size={19} /><input ref={questionRef} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about a person or plan…" aria-label="Ask about a person or plan" /><kbd>{shortcutLabel === '⌘' ? <Command size={12} /> : shortcutLabel} K</kbd></form><div className="prompt-list">{prompts.map((prompt) => <button key={prompt} className="prompt-pill" onClick={() => { setQuestion(prompt); onSubmitQuestion(prompt); }}>{prompt}<ArrowUpRight size={14} /></button>)}</div>{decision && <DecisionPanel decision={decision} />}</section><div className="summary-strip"><SummaryStat label="PEOPLE IN YOUR CIRCLE" value={people.length} icon={<Users size={16} />} onClick={() => navigate('people')} /><SummaryStat label="UPCOMING PLANS" value={plans.length} icon={<CalendarDays size={16} />} onClick={() => navigate('plans')} /><SummaryStat label="ACTIVE PRIORITIES" value={goals.length} icon={<Target size={16} />} onClick={() => navigate('goals')} /></div><div className="dashboard-grid"><section className="content-card upcoming-card"><div className="card-header"><div><span className="card-kicker">YOUR WEEK</span><h2>Coming up</h2></div><button className="card-link" onClick={() => navigate('plans')}>View all <ArrowUpRight size={14} /></button></div><div className="plans-list">{plans.length ? plans.slice(0, 3).map((plan) => <PlanRow key={plan.id} plan={plan} person={people.find((person) => person.id === plan.person_id)} />) : <EmptyInline text="No plans on the horizon yet." action="Add a plan" onClick={onAddPlan} />}</div></section><section className="content-card people-preview"><div className="card-header"><div><span className="card-kicker">YOUR CIRCLE</span><h2>People</h2></div><button className="card-link" onClick={() => navigate('people')}>See directory <ArrowUpRight size={14} /></button></div><div className="mini-people">{people.slice(0, 4).map((person) => <button className="mini-person" key={person.id} onClick={() => navigate('people')}><Avatar person={person} size="sm" /><span>{person.name.split(' ')[0]}</span></button>)}</div><button className="add-person-line" onClick={onAddPerson}><Plus size={15} /> Keep your circle close</button></section></div></div>;
}

function SummaryStat({ label, value, icon, onClick }: { label: string; value: number; icon: React.ReactNode; onClick: () => void }) { return <button className="summary-stat" onClick={onClick}><span className="summary-stat-icon">{icon}</span><span><strong>{value}</strong><small>{label}</small></span><ArrowUpRight size={14} /></button>; }

function PlanRow({ plan, person }: { plan: Plan; person?: Person }) { return <div className="plan-row"><div className="date-block"><strong>{new Date(`${plan.plan_date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</strong><span>{new Date(`${plan.plan_date}T12:00:00`).getDate()}</span></div><div className="plan-info"><strong>{plan.title}</strong><span>{person?.name || 'Personal time'} <i>·</i> {plan.category}</span></div><div className="plan-time"><Clock3 size={14} />{plan.plan_time.slice(0, 5)}</div><ChevronRight size={16} className="row-chevron" /></div>; }

function PeoplePage({ search, setSearch, people, onAdd, onEdit, onDelete }: { search: string; setSearch: (value: string) => void; people: Person[]; onAdd: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void }) { return <div className="page-wrap people-page"><section className="page-heading-row"><div><p className="eyebrow">YOUR CIRCLE</p><h1>People</h1><p className="intro">The people who shape your days, held in one thoughtful place.</p></div><button className="primary-button" onClick={onAdd}><Plus size={17} /> Add person</button></section><div className="directory-toolbar"><div className="directory-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people" aria-label="Search people" /></div><span>{people.length} {people.length === 1 ? 'person' : 'people'}</span></div>{people.length ? <div className="people-grid">{people.map((person) => <article className="person-card" key={person.id}><div className="person-card-top"><Avatar person={person} size="lg" /><div className="card-actions"><button className="card-action" onClick={() => onEdit(person.id)} aria-label={`Edit ${person.name}`}><Edit3 size={15} /></button><button className="card-action danger-action" onClick={() => onDelete(person.id)} aria-label={`Delete ${person.name}`}><Trash2 size={15} /></button></div></div><h2>{person.name}</h2><p className="relationship">{person.relationship}</p><p className="person-detail">{person.detail || 'Add a little context to remember what matters.'}</p><div className="person-divider" /><div className="no-plan"><BookOpen size={15} /><span>{person.note || 'No note added yet'}</span></div><button className="view-person" onClick={() => onEdit(person.id)}>Edit profile <Edit3 size={15} /></button></article>)}</div> : <div className="empty-state"><div className="empty-icon"><Users size={23} /></div><h2>No one by that name yet.</h2><p>Try another search, or add someone new to your circle.</p><button className="primary-button" onClick={onAdd}><Plus size={17} /> Add person</button></div>}</div>; }

function PlansPage({ plans, people, onAdd, onEdit, onDelete }: { plans: Plan[]; people: Person[]; onAdd: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void }) { const upcoming = plans.filter(isUpcoming).sort(bySoonest); const past = plans.filter((plan) => !isUpcoming(plan)).sort((a, b) => bySoonest(b, a)); return <div className="page-wrap plans-page"><section className="page-heading-row"><div><p className="eyebrow">YOUR TIME</p><h1>Plans</h1><p className="intro">See what is ahead, and make room for the choices that matter.</p></div><button className="primary-button" onClick={onAdd}><Plus size={17} /> Add plan</button></section><div className="plan-columns"><PlanGroup title="Upcoming" plans={upcoming} people={people} onEdit={onEdit} onDelete={onDelete} empty="Nothing scheduled yet." /><PlanGroup title="Past plans" plans={past} people={people} onEdit={onEdit} onDelete={onDelete} empty="Your past plans will appear here." /></div></div>; }

function PlanGroup({ title, plans, people, onEdit, onDelete, empty }: { title: string; plans: Plan[]; people: Person[]; onEdit: (id: string) => void; onDelete: (id: string) => void; empty: string }) { return <section className="plan-group"><div className="section-heading"><div><span className="card-kicker">{title === 'Upcoming' ? 'NEXT ON YOUR CALENDAR' : 'LOOKING BACK'}</span><h2>{title}</h2></div><span className="group-count">{plans.length}</span></div>{plans.length ? <div className="plan-cards">{plans.map((plan) => <article className="plan-card" key={plan.id}><div className="plan-card-date"><strong>{new Date(`${plan.plan_date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</strong><b>{new Date(`${plan.plan_date}T12:00:00`).getDate()}</b><small>{new Date(`${plan.plan_date}T12:00:00`).toLocaleDateString('en-US', { month: 'short' })}</small></div><div className="plan-card-main"><div className="plan-card-heading"><div><span className="category-label">{plan.category}</span><h3>{plan.title}</h3></div><div className="card-actions"><button className="card-action" onClick={() => onEdit(plan.id)} aria-label={`Edit ${plan.title}`}><Edit3 size={15} /></button><button className="card-action danger-action" onClick={() => onDelete(plan.id)} aria-label={`Delete ${plan.title}`}><Trash2 size={15} /></button></div></div><p>{plan.context || 'No context added for this plan.'}</p><div className="plan-card-meta"><span><Clock3 size={14} /> {plan.plan_time.slice(0, 5)}</span><span><Users size={14} /> {people.find((person) => person.id === plan.person_id)?.name || 'Personal time'}</span></div></div></article>)}</div> : <div className="empty-state compact-empty"><div className="empty-icon"><CalendarDays size={20} /></div><p>{empty}</p></div>}</section>; }

function GoalsPage({ goals, onAdd, onEdit, onDelete, onToggle }: { goals: Goal[]; onAdd: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void; onToggle: (goal: Goal) => void }) { const activeCount = goals.filter((goal) => goal.status === 'active').length; return <div className="page-wrap goals-page"><section className="page-heading-row"><div><p className="eyebrow">THIS MONTH</p><h1>Goals</h1><p className="intro">A few gentle priorities to help your time reflect what matters.</p></div>{activeCount < 3 && <button className="primary-button" onClick={onAdd}><Plus size={17} /> Add goal</button>}</section><div className="goal-limit"><Target size={16} /><span>{activeCount} of 3 active monthly priorities</span><div className="goal-progress"><i style={{ width: `${Math.min(activeCount / 3 * 100, 100)}%` }} /></div></div>{goals.length ? <div className="goals-grid">{goals.map((goal) => <article className={`goal-card ${goal.status === 'completed' ? 'goal-completed' : ''}`} key={goal.id}><div className="goal-card-top"><span className="category-label">{goal.category}</span><div className="card-actions"><button className="card-action" onClick={() => onEdit(goal.id)} aria-label={`Edit ${goal.title}`}><Edit3 size={15} /></button><button className="card-action danger-action" onClick={() => onDelete(goal.id)} aria-label={`Delete ${goal.title}`}><Trash2 size={15} /></button></div></div><h2>{goal.title}</h2><p>{goal.description || 'No description added.'}</p><button className="goal-status" onClick={() => onToggle(goal)}>{goal.status === 'active' ? <><span className="status-circle" /> Active priority</> : <><Check size={14} /> Completed</>}</button></article>)}</div> : <div className="empty-state"><div className="empty-icon"><Target size={21} /></div><h2>What deserves your attention?</h2><p>Keep it light. Start with one priority for this month.</p><button className="primary-button" onClick={onAdd}><Plus size={17} /> Add goal</button></div>}</div>; }

function EmptyInline({ text, action, onClick }: { text: string; action: string; onClick: () => void }) { return <div className="empty-inline"><span>{text}</span><button className="card-link" onClick={onClick}>{action} <ArrowUpRight size={14} /></button></div>; }

function DecisionPanel({ decision }: { decision: NonNullable<DecisionResult> }) {
  return <div className="decision-panel">
    <div className="decision-header"><span className="card-kicker">DECISION SUPPORT — FROM YOUR SAVED DATA</span><p className="decision-summary">{decision.summary}</p></div>
    {decision.matchedPeople.length > 0 && <div className="decision-match"><Users size={14} /><span>Related: {decision.matchedPeople.map((p) => p.name).join(', ')}</span></div>}
    {decision.matchedPlans.length > 0 && <div className="decision-match"><CalendarDays size={14} /><span>Related plans: {decision.matchedPlans.map((p) => p.title).join(', ')}</span></div>}
    <div className="decision-options">{decision.options.map((option) => <div className="decision-option" key={option.label}><strong>{option.label}</strong><p>{option.detail}</p><span className="decision-evidence">{option.evidence}</span></div>)}</div>
    {decision.reasonsToMeet.length > 0 && <div className="decision-reasons"><span className="card-kicker">REASONS TO MEET / GO AHEAD</span><ul>{decision.reasonsToMeet.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}
    {decision.reasonsToPostpone.length > 0 && <div className="decision-reasons"><span className="card-kicker">REASONS TO POSTPONE</span><ul>{decision.reasonsToPostpone.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}
    {decision.reasonsToGatherMore.length > 0 && <div className="decision-reasons"><span className="card-kicker">GATHER MORE INFORMATION</span><ul>{decision.reasonsToGatherMore.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}
    <div className="decision-tradeoffs"><span className="card-kicker">TRADE-OFFS</span><ul>{decision.tradeoffs.map((tradeoff) => <li key={tradeoff}>{tradeoff}</li>)}</ul></div>
    {decision.recommendation && <div className="decision-next"><Sparkles size={15} /><span><strong>Tentative recommendation: </strong>{decision.recommendation}</span></div>}
    {decision.followUp && <div className="decision-followup"><CircleHelp size={15} /><span>{decision.followUp}</span></div>}
  </div>;
}

function ReflectionsPage({ reflections, onSave, onDelete }: { reflections: Reflection[]; onSave: (event: FormEvent<HTMLFormElement>) => void; onDelete: (id: string) => void }) {
  return <div className="page-wrap reflections-page"><section className="page-heading-row"><div><p className="eyebrow">A QUIET PRACTICE</p><h1>Reflections</h1><p className="intro">Pause and notice what is true for you right now. Nothing needs to be solved.</p></div></section><section className="reflection-compose"><form onSubmit={onSave}><label>What is on your mind?<textarea name="text" autoFocus placeholder="Write a few lines…" required /></label><div className="prompt-list">{reflectionPrompts.map((prompt) => <button type="button" key={prompt} className="prompt-pill" onClick={(event) => { const ta = (event.currentTarget.closest('form')?.querySelector('textarea')); if (ta) { ta.value = prompt; ta.focus(); } }}>{prompt}<ArrowUpRight size={14} /></button>)}</div><div className="modal-actions"><button type="submit" className="primary-button"><Check size={16} /> Save reflection</button></div></form></section><section className="reflection-history"><div className="section-heading"><div><span className="card-kicker">SAVED REFLECTIONS</span><h2>Previous reflections</h2></div><span className="group-count">{reflections.length}</span></div>{reflections.length ? <div className="reflection-list">{reflections.map((reflection) => <article className="reflection-card-item" key={reflection.id}><div className="reflection-item-top"><span className="reflection-date">{new Date(reflection.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} · {new Date(reflection.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span><button className="card-action danger-action" onClick={() => onDelete(reflection.id)} aria-label="Delete reflection"><Trash2 size={15} /></button></div><p>{reflection.text}</p></article>)}</div> : <div className="empty-state compact-empty"><div className="empty-icon"><BookOpen size={20} /></div><p>No reflections yet. Start with one above.</p></div>}</section></div>;
}

function PersonModal({ person, onClose, onSubmit }: { person?: Person; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <ModalFrame title={person ? 'Edit person' : 'Add someone'} eyebrow="YOUR CIRCLE" onClose={onClose}><form onSubmit={onSubmit}><label>Name<input name="name" defaultValue={person?.name} autoFocus placeholder="e.g. Alex Morgan" required /></label><label>Relationship<span className="label-optional">Optional</span><input name="relationship" defaultValue={person?.relationship} placeholder="e.g. close friend, colleague" /></label><label>Context<span className="label-optional">Optional</span><input name="detail" defaultValue={person?.detail} placeholder="What helps you remember this relationship?" /></label><label>Note<span className="label-optional">Optional</span><textarea name="note" defaultValue={person?.note} placeholder="A small thing worth remembering" /></label><ModalActions onClose={onClose} label={person ? 'Save changes' : 'Add person'} /></form></ModalFrame>; }

function PlanModal({ plan, people, onClose, onSubmit }: { plan?: Plan; people: Person[]; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <ModalFrame title={plan ? 'Edit plan' : 'Add a plan'} eyebrow="YOUR TIME" onClose={onClose}><form onSubmit={onSubmit}><label>Title<input name="title" defaultValue={plan?.title} autoFocus placeholder="e.g. Dinner with Maya" required /></label><div className="form-row"><label>Date<input type="date" name="plan_date" defaultValue={plan?.plan_date} required /></label><label>Time<input type="time" name="plan_time" defaultValue={plan?.plan_time?.slice(0, 5)} required /></label></div><div className="form-row"><label>Person<select name="person_id" defaultValue={plan?.person_id || ''}><option value="">Personal time</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label>Category<select name="category" defaultValue={plan?.category || 'Personal'}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label></div><label>Context<span className="label-optional">Optional</span><textarea name="context" defaultValue={plan?.context} placeholder="What do you want to keep in mind?" /></label><ModalActions onClose={onClose} label={plan ? 'Save changes' : 'Add plan'} /></form></ModalFrame>; }

function GoalModal({ goal, error, onClose, onSubmit }: { goal?: Goal; error: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <ModalFrame title={goal ? 'Edit goal' : 'Add a monthly goal'} eyebrow="THIS MONTH" onClose={onClose}><form onSubmit={onSubmit}><label>Title<input name="title" defaultValue={goal?.title} autoFocus placeholder="e.g. Protect two evenings for rest" required /></label><label>Category<select name="category" defaultValue={goal?.category || 'Relationships'}>{goalCategories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Description<span className="label-optional">Optional</span><textarea name="description" defaultValue={goal?.description} placeholder="What would this look like in practice?" /></label>{goal && <label>Status<select name="status" defaultValue={goal.status}><option value="active">Active</option><option value="completed">Completed</option></select></label>}{error && <p className="form-error" role="alert">{error}</p>}<ModalActions onClose={onClose} label={goal ? 'Save changes' : 'Add goal'} /></form></ModalFrame>; }

function ModalFrame({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><span className="card-kicker">{eyebrow}</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>{children}</div></div>; }
function ModalActions({ onClose, label }: { onClose: () => void; label: string }) { return <div className="modal-actions"><button type="button" className="quiet-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button"><Check size={16} /> {label}</button></div>; }

function PlaceholderPage({ page, navigate }: { page: Page; navigate: (page: Page) => void }) { const label = navigation.find((item) => item.id === page)?.label; return <div className="page-wrap placeholder-page"><div className="placeholder-mark"><Sparkles size={22} /></div><p className="eyebrow">COMING NEXT</p><h1>{label} will feel intentional.</h1><p>This space is reserved for a calm, useful way to work with your {label?.toLowerCase()}. It is not connected yet.</p><button className="quiet-button" onClick={() => navigate('home')}>Return home <ArrowUpRight size={15} /></button></div>; }

export default App;
