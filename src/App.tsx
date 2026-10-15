import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  Bell,
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
type DecisionResult = { summary: string; options: { label: string; detail: string }[]; tradeoffs: string[]; nextStep: string; matchedPeople: Person[]; matchedPlans: Plan[] } | null;

const reflectionPrompts = [
  'What felt meaningful today?',
  'What drained my energy, and what restored it?',
  'Who did I feel close to, and who did I miss?',
];

function buildDecision(query: string, people: Person[], plans: Plan[], goals: Goal[]): DecisionResult {
  const q = query.toLowerCase().trim();
  if (!q) return null;
  const matchedPeople = people.filter((p) => p.name.toLowerCase().includes(q) || p.relationship.toLowerCase().includes(q));
  const matchedPlans = plans.filter((p) => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.context || '').toLowerCase().includes(q));
  const matchedGoals = goals.filter((g) => g.title.toLowerCase().includes(q) || g.category.toLowerCase().includes(q));
  const now = new Date().toISOString().slice(0, 10);
  const upcoming = plans.filter((p) => p.plan_date >= now).sort((a, b) => a.plan_date.localeCompare(b.plan_date));
  const personName = matchedPeople[0]?.name;
  const personPlans = personName ? plans.filter((p) => p.person_id === matchedPeople[0].id && p.plan_date >= now).sort((a, b) => a.plan_date.localeCompare(b.plan_date)) : [];

  let summary: string;
  const options: { label: string; detail: string }[] = [];
  const tradeoffs: string[] = [];
  let nextStep: string;

  if (matchedPeople.length && personPlans.length) {
    summary = `You have ${personPlans.length} upcoming plan${personPlans.length === 1 ? '' : 's'} with ${personName}. Their latest note says: “${matchedPeople[0].note || 'No note saved yet.'}”`;
    options.push({ label: 'Keep the next plan', detail: `${personPlans[0].title} on ${new Date(personPlans[0].plan_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at ${personPlans[0].plan_time.slice(0, 5)}.` });
    options.push({ label: 'Reschedule for more space', detail: 'Move it to a less full day so the conversation does not feel rushed.' });
    tradeoffs.push('Keeping the plan honours the relationship but commits your time sooner.');
    tradeoffs.push('Rescheduling creates breathing room but may dilute the momentum of the connection.');
    nextStep = `Open Plans and confirm or adjust “${personPlans[0].title}.”`;
  } else if (matchedPeople.length) {
    summary = `${personName} is in your circle with no upcoming plans. Your note: “${matchedPeople[0].note || 'No note saved yet.'}”`;
    options.push({ label: 'Add a low-pressure plan', detail: 'A short walk or coffee this week keeps the connection warm without overcommitting.' });
    options.push({ label: 'Hold off for now', detail: 'Wait until your schedule clears so the time together feels genuine.' });
    tradeoffs.push('Reaching out soon sustains closeness.');
    tradeoffs.push('Waiting protects your energy but may delay the relationship.');
    nextStep = `Add a plan with ${personName} when the timing feels right.`;
  } else if (matchedPlans.length) {
    summary = `This relates to “${matchedPlans[0].title}” — a ${matchedPlans[0].category.toLowerCase()} plan on ${new Date(matchedPlans[0].plan_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}.`;
    options.push({ label: 'Go ahead with it', detail: matchedPlans[0].context || 'The plan is already set — trust the intention you captured.' });
    options.push({ label: 'Reconsider the time', detail: 'Check whether the slot competes with a priority you care about.' });
    tradeoffs.push('Following through builds trust with yourself and others.');
    tradeoffs.push('Adjusting now is cheaper than dragging through a plan that does not fit.');
    nextStep = `Review the plan details and decide whether the current time still works.`;
  } else if (matchedGoals.length) {
    summary = `This connects to your goal: “${matchedGoals[0].title}.” It is ${matchedGoals[0].status === 'active' ? 'an active priority' : 'completed'} in the ${matchedGoals[0].category} category.`;
    options.push({ label: 'Take a small step', detail: 'Choose one concrete action this week that moves the goal forward.' });
    options.push({ label: 'Pause and revisit', detail: 'Let it sit if your attention is needed elsewhere right now.' });
    tradeoffs.push('A small step sustains momentum without overwhelming your week.');
    tradeoffs.push('Pausing avoids overcommitting but risks losing the thread.');
    nextStep = `Open Goals and check whether “${matchedGoals[0].title}” still fits this month.`;
  } else if (upcoming.length) {
    summary = `No exact match found, but your next plan is “${upcoming[0].title}” on ${new Date(upcoming[0].plan_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}.`;
    options.push({ label: 'Focus on the next plan', detail: 'Direct your attention there and revisit this question afterwards.' });
    options.push({ label: 'Clear the deck first', detail: 'Finish or defer what is open before adding anything new.' });
    tradeoffs.push('Attending to what is already planned keeps your word intact.');
    tradeoffs.push('Clearing space reduces stress but may delay a relationship or commitment.');
    nextStep = 'Open Plans to review what is coming up and decide what to protect.';
  } else {
    summary = 'You have no saved people, plans, or goals matching this question yet. Start by adding one person or plan to give the decision some shape.';
    options.push({ label: 'Add a person', detail: 'Name someone who is on your mind so future decisions can include them.' });
    options.push({ label: 'Add a plan', detail: 'Capture one intention for the week so you can weigh competing choices.' });
    tradeoffs.push('Adding structure now makes later decisions clearer.');
    tradeoffs.push('Staying open avoids premature commitment but keeps things vague.');
    nextStep = 'Add a person or a plan, then return to this question.';
  }
  return { summary, options, tradeoffs, nextStep, matchedPeople, matchedPlans };
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
      { id: 'dinner-at-lupa', title: 'Dinner at Lupa', plan_date: '2026-10-16', plan_time: '19:00', person_id: loadedPeople.find((person) => person.name === 'Maya Chen')?.id || null, category: 'Social', context: 'A chance to catch up without rushing.' },
      { id: 'prospect-park-walk', title: 'Walk in Prospect Park', plan_date: '2026-10-17', plan_time: '10:30', person_id: loadedPeople.find((person) => person.name === 'Arjun Mehta')?.id || null, category: 'Wellbeing', context: 'Keep the morning unhurried.' },
      { id: 'project-catch-up', title: 'Project catch-up', plan_date: '2026-10-19', plan_time: '14:00', person_id: loadedPeople.find((person) => person.name === 'Elena Rossi')?.id || null, category: 'Work', context: 'Bring the first draft.' },
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

  const filteredPeople = useMemo(() => people.filter((person) => `${person.name} ${person.relationship}`.toLowerCase().includes(search.toLowerCase())), [people, search]);
  const upcomingPlans = useMemo(() => plans.filter((plan) => `${plan.plan_date}T${plan.plan_time}` >= new Date().toISOString().slice(0, 16)), [plans]);
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
    if (!editingId && activeGoals.length >= 3) { setError('You can keep up to three active monthly goals.'); return; }
    const values = { title, description: String(form.get('description') || '').trim(), category: String(form.get('category') || 'Relationships'), status: String(form.get('status') || 'active') as 'active' | 'completed' };
    const nextGoals = editingId
      ? goals.map((goal) => goal.id === editingId ? { ...goal, ...values } : goal)
      : [...goals, { ...values, id: createLocalId(), month_start: new Date().toISOString().slice(0, 10) }];
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
        <header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={21} /></button><div className="breadcrumbs"><span>Kinly</span><ChevronRight size={14} /><strong>{navigation.find((item) => item.id === page)?.label}</strong></div><div className="topbar-actions"><button className="icon-button" aria-label="Search"><Search size={18} /></button><button className="icon-button notification-button" aria-label="Notifications"><Bell size={18} /><span /></button><div className="top-avatar">JL</div></div></header>
        {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={15} /></button></div>}
        {loading ? <div className="loading-state"><div className="loading-dot" /><p>Preparing your space…</p></div> : <>
          {page === 'home' && <HomePage question={question} setQuestion={(v) => { setQuestion(v); setSubmittedQuestion(''); }} onSubmitQuestion={submitQuestion} decision={decisionResult} navigate={navigate} people={people} plans={upcomingPlans} goals={activeGoals} />}
          {page === 'people' && <PeoplePage search={search} setSearch={setSearch} people={filteredPeople} onAdd={() => openModal('person')} onEdit={(id) => openModal('person', id)} onDelete={deletePerson} />}
          {page === 'plans' && <PlansPage plans={plans} people={people} onAdd={() => openModal('plan')} onEdit={(id) => openModal('plan', id)} onDelete={deletePlan} />}
          {page === 'goals' && <GoalsPage goals={goals} onAdd={() => openModal('goal')} onEdit={(id) => openModal('goal', id)} onDelete={deleteGoal} onToggle={toggleGoal} />}
          {page === 'reflections' && <ReflectionsPage reflections={reflections} onSave={saveReflection} onDelete={deleteReflection} />}
          {page === 'settings' && <PlaceholderPage page={page} navigate={navigate} />}
        </>}
      </main>
      {modal === 'person' && <PersonModal person={editingId ? people.find((item) => item.id === editingId) : undefined} onClose={() => { setModal(null); setEditingId(null); }} onSubmit={savePerson} />}
      {modal === 'plan' && <PlanModal plan={editingId ? plans.find((item) => item.id === editingId) : undefined} people={people} onClose={() => { setModal(null); setEditingId(null); }} onSubmit={savePlan} />}
      {modal === 'goal' && <GoalModal goal={editingId ? goals.find((item) => item.id === editingId) : undefined} onClose={() => { setModal(null); setEditingId(null); }} onSubmit={saveGoal} />}
    </div>
  );
}

function HomePage({ question, setQuestion, onSubmitQuestion, decision, navigate, people, plans, goals }: { question: string; setQuestion: (value: string) => void; onSubmitQuestion: (override?: string) => void; decision: DecisionResult; navigate: (page: Page) => void; people: Person[]; plans: Plan[]; goals: Goal[] }) {
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onSubmitQuestion(); };
  return <div className="page-wrap home-page"><section className="welcome-row"><div><p className="eyebrow">THURSDAY, OCTOBER 15</p><h1>Your people. A more intentional tomorrow.</h1><p className="intro">Think clearly about your time, your relationships, and the choices between them.</p></div><button className="quiet-button" onClick={() => navigate('people')}><Plus size={16} /> Add a person</button></section><section className="reflection-card"><div className="reflection-icon"><Sparkles size={19} /></div><div className="reflection-copy"><span className="card-kicker">A MOMENT TO CONSIDER</span><h2>What would feel nourishing today?</h2><p>You have some open space this evening. Notice what your energy is asking for before you fill it.</p></div><button className="text-button" onClick={() => navigate('reflections')}>Reflect for a minute <ArrowUpRight size={15} /></button></section><section className="ask-section"><div className="section-heading"><div><span className="card-kicker">THINK IT THROUGH</span><h2>Bring a question to mind.</h2></div><CircleHelp size={18} /></div><form className="question-box" onSubmit={submit}><Search size={19} /><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about a person or plan…" aria-label="Ask about a person or plan" /><kbd><Command size={12} /> K</kbd></form><div className="prompt-list">{prompts.map((prompt) => <button key={prompt} className="prompt-pill" onClick={() => { setQuestion(prompt); onSubmitQuestion(prompt); }}>{prompt}<ArrowUpRight size={14} /></button>)}</div>{decision && <DecisionPanel decision={decision} />}</section><div className="summary-strip"><SummaryStat label="PEOPLE IN YOUR CIRCLE" value={people.length} icon={<Users size={16} />} onClick={() => navigate('people')} /><SummaryStat label="UPCOMING PLANS" value={plans.length} icon={<CalendarDays size={16} />} onClick={() => navigate('plans')} /><SummaryStat label="ACTIVE PRIORITIES" value={goals.length} icon={<Target size={16} />} onClick={() => navigate('goals')} /></div><div className="dashboard-grid"><section className="content-card upcoming-card"><div className="card-header"><div><span className="card-kicker">YOUR WEEK</span><h2>Coming up</h2></div><button className="card-link" onClick={() => navigate('plans')}>View all <ArrowUpRight size={14} /></button></div><div className="plans-list">{plans.length ? plans.slice(0, 3).map((plan) => <PlanRow key={plan.id} plan={plan} person={people.find((person) => person.id === plan.person_id)} />) : <EmptyInline text="No plans on the horizon yet." action="Add a plan" onClick={() => navigate('plans')} />}</div></section><section className="content-card people-preview"><div className="card-header"><div><span className="card-kicker">YOUR CIRCLE</span><h2>People</h2></div><button className="card-link" onClick={() => navigate('people')}>See directory <ArrowUpRight size={14} /></button></div><div className="mini-people">{people.slice(0, 4).map((person) => <button className="mini-person" key={person.id} onClick={() => navigate('people')}><Avatar person={person} size="sm" /><span>{person.name.split(' ')[0]}</span></button>)}</div><button className="add-person-line" onClick={() => navigate('people')}><Plus size={15} /> Keep your circle close</button></section></div></div>;
}

function SummaryStat({ label, value, icon, onClick }: { label: string; value: number; icon: React.ReactNode; onClick: () => void }) { return <button className="summary-stat" onClick={onClick}><span className="summary-stat-icon">{icon}</span><span><strong>{value}</strong><small>{label}</small></span><ArrowUpRight size={14} /></button>; }

function PlanRow({ plan, person }: { plan: Plan; person?: Person }) { return <div className="plan-row"><div className="date-block"><strong>{new Date(`${plan.plan_date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</strong><span>{new Date(`${plan.plan_date}T12:00:00`).getDate()}</span></div><div className="plan-info"><strong>{plan.title}</strong><span>{person?.name || 'Personal time'} <i>·</i> {plan.category}</span></div><div className="plan-time"><Clock3 size={14} />{plan.plan_time.slice(0, 5)}</div><ChevronRight size={16} className="row-chevron" /></div>; }

function PeoplePage({ search, setSearch, people, onAdd, onEdit, onDelete }: { search: string; setSearch: (value: string) => void; people: Person[]; onAdd: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void }) { return <div className="page-wrap people-page"><section className="page-heading-row"><div><p className="eyebrow">YOUR CIRCLE</p><h1>People</h1><p className="intro">The people who shape your days, held in one thoughtful place.</p></div><button className="primary-button" onClick={onAdd}><Plus size={17} /> Add person</button></section><div className="directory-toolbar"><div className="directory-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people" aria-label="Search people" /></div><span>{people.length} {people.length === 1 ? 'person' : 'people'}</span></div>{people.length ? <div className="people-grid">{people.map((person) => <article className="person-card" key={person.id}><div className="person-card-top"><Avatar person={person} size="lg" /><div className="card-actions"><button className="card-action" onClick={() => onEdit(person.id)} aria-label={`Edit ${person.name}`}><Edit3 size={15} /></button><button className="card-action danger-action" onClick={() => onDelete(person.id)} aria-label={`Delete ${person.name}`}><Trash2 size={15} /></button></div></div><h2>{person.name}</h2><p className="relationship">{person.relationship}</p><p className="person-detail">{person.detail || 'Add a little context to remember what matters.'}</p><div className="person-divider" /><div className="no-plan"><BookOpen size={15} /><span>{person.note || 'No note added yet'}</span></div><button className="view-person" onClick={() => onEdit(person.id)}>Edit profile <Edit3 size={15} /></button></article>)}</div> : <div className="empty-state"><div className="empty-icon"><Users size={23} /></div><h2>No one by that name yet.</h2><p>Try another search, or add someone new to your circle.</p><button className="primary-button" onClick={onAdd}><Plus size={17} /> Add person</button></div>}</div>; }

function PlansPage({ plans, people, onAdd, onEdit, onDelete }: { plans: Plan[]; people: Person[]; onAdd: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void }) { const now = new Date().toISOString().slice(0, 10); const upcoming = plans.filter((plan) => plan.plan_date >= now); const past = plans.filter((plan) => plan.plan_date < now); return <div className="page-wrap plans-page"><section className="page-heading-row"><div><p className="eyebrow">YOUR TIME</p><h1>Plans</h1><p className="intro">See what is ahead, and make room for the choices that matter.</p></div><button className="primary-button" onClick={onAdd}><Plus size={17} /> Add plan</button></section><div className="plan-columns"><PlanGroup title="Upcoming" plans={upcoming} people={people} onEdit={onEdit} onDelete={onDelete} empty="Nothing scheduled yet." /><PlanGroup title="Past plans" plans={past} people={people} onEdit={onEdit} onDelete={onDelete} empty="Your past plans will appear here." /></div></div>; }

function PlanGroup({ title, plans, people, onEdit, onDelete, empty }: { title: string; plans: Plan[]; people: Person[]; onEdit: (id: string) => void; onDelete: (id: string) => void; empty: string }) { return <section className="plan-group"><div className="section-heading"><div><span className="card-kicker">{title === 'Upcoming' ? 'NEXT ON YOUR CALENDAR' : 'LOOKING BACK'}</span><h2>{title}</h2></div><span className="group-count">{plans.length}</span></div>{plans.length ? <div className="plan-cards">{plans.map((plan) => <article className="plan-card" key={plan.id}><div className="plan-card-date"><strong>{new Date(`${plan.plan_date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</strong><b>{new Date(`${plan.plan_date}T12:00:00`).getDate()}</b><small>{new Date(`${plan.plan_date}T12:00:00`).toLocaleDateString('en-US', { month: 'short' })}</small></div><div className="plan-card-main"><div className="plan-card-heading"><div><span className="category-label">{plan.category}</span><h3>{plan.title}</h3></div><div className="card-actions"><button className="card-action" onClick={() => onEdit(plan.id)} aria-label={`Edit ${plan.title}`}><Edit3 size={15} /></button><button className="card-action danger-action" onClick={() => onDelete(plan.id)} aria-label={`Delete ${plan.title}`}><Trash2 size={15} /></button></div></div><p>{plan.context || 'No context added for this plan.'}</p><div className="plan-card-meta"><span><Clock3 size={14} /> {plan.plan_time.slice(0, 5)}</span><span><Users size={14} /> {people.find((person) => person.id === plan.person_id)?.name || 'Personal time'}</span></div></div></article>)}</div> : <div className="empty-state compact-empty"><div className="empty-icon"><CalendarDays size={20} /></div><p>{empty}</p></div>}</section>; }

function GoalsPage({ goals, onAdd, onEdit, onDelete, onToggle }: { goals: Goal[]; onAdd: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void; onToggle: (goal: Goal) => void }) { const activeCount = goals.filter((goal) => goal.status === 'active').length; return <div className="page-wrap goals-page"><section className="page-heading-row"><div><p className="eyebrow">THIS MONTH</p><h1>Goals</h1><p className="intro">A few gentle priorities to help your time reflect what matters.</p></div>{activeCount < 3 && <button className="primary-button" onClick={onAdd}><Plus size={17} /> Add goal</button>}</section><div className="goal-limit"><Target size={16} /><span>{activeCount} of 3 active monthly priorities</span><div className="goal-progress"><i style={{ width: `${Math.min(activeCount / 3 * 100, 100)}%` }} /></div></div>{goals.length ? <div className="goals-grid">{goals.map((goal) => <article className={`goal-card ${goal.status === 'completed' ? 'goal-completed' : ''}`} key={goal.id}><div className="goal-card-top"><span className="category-label">{goal.category}</span><div className="card-actions"><button className="card-action" onClick={() => onEdit(goal.id)} aria-label={`Edit ${goal.title}`}><Edit3 size={15} /></button><button className="card-action danger-action" onClick={() => onDelete(goal.id)} aria-label={`Delete ${goal.title}`}><Trash2 size={15} /></button></div></div><h2>{goal.title}</h2><p>{goal.description || 'No description added.'}</p><button className="goal-status" onClick={() => onToggle(goal)}>{goal.status === 'active' ? <><span className="status-circle" /> Active priority</> : <><Check size={14} /> Completed</>}</button></article>)}</div> : <div className="empty-state"><div className="empty-icon"><Target size={21} /></div><h2>What deserves your attention?</h2><p>Keep it light. Start with one priority for this month.</p><button className="primary-button" onClick={onAdd}><Plus size={17} /> Add goal</button></div>}</div>; }

function EmptyInline({ text, action, onClick }: { text: string; action: string; onClick: () => void }) { return <div className="empty-inline"><span>{text}</span><button className="card-link" onClick={onClick}>{action} <ArrowUpRight size={14} /></button></div>; }

function DecisionPanel({ decision }: { decision: NonNullable<DecisionResult> }) {
  return <div className="decision-panel"><div className="decision-header"><span className="card-kicker">DECISION SUPPORT</span><p className="decision-summary">{decision.summary}</p></div>{decision.matchedPeople.length > 0 && <div className="decision-match"><Users size={14} /><span>Related: {decision.matchedPeople.map((p) => p.name).join(', ')}</span></div>}{decision.matchedPlans.length > 0 && <div className="decision-match"><CalendarDays size={14} /><span>Related plans: {decision.matchedPlans.map((p) => p.title).join(', ')}</span></div>}<div className="decision-options">{decision.options.map((option) => <div className="decision-option" key={option.label}><strong>{option.label}</strong><p>{option.detail}</p></div>)}</div><div className="decision-tradeoffs"><span className="card-kicker">TRADE-OFFS</span><ul>{decision.tradeoffs.map((tradeoff) => <li key={tradeoff}>{tradeoff}</li>)}</ul></div><div className="decision-next"><Sparkles size={15} /><span>{decision.nextStep}</span></div></div>;
}

function ReflectionsPage({ reflections, onSave, onDelete }: { reflections: Reflection[]; onSave: (event: FormEvent<HTMLFormElement>) => void; onDelete: (id: string) => void }) {
  return <div className="page-wrap reflections-page"><section className="page-heading-row"><div><p className="eyebrow">A QUIET PRACTICE</p><h1>Reflections</h1><p className="intro">Pause and notice what is true for you right now. Nothing needs to be solved.</p></div></section><section className="reflection-compose"><form onSubmit={onSave}><label>What is on your mind?<textarea name="text" autoFocus placeholder="Write a few lines…" required /></label><div className="prompt-list">{reflectionPrompts.map((prompt) => <button type="button" key={prompt} className="prompt-pill" onClick={(event) => { const ta = (event.currentTarget.closest('form')?.querySelector('textarea')); if (ta) { ta.value = prompt; ta.focus(); } }}>{prompt}<ArrowUpRight size={14} /></button>)}</div><div className="modal-actions"><button type="submit" className="primary-button"><Check size={16} /> Save reflection</button></div></form></section><section className="reflection-history"><div className="section-heading"><div><span className="card-kicker">SAVED REFLECTIONS</span><h2>Previous reflections</h2></div><span className="group-count">{reflections.length}</span></div>{reflections.length ? <div className="reflection-list">{reflections.map((reflection) => <article className="reflection-card-item" key={reflection.id}><div className="reflection-item-top"><span className="reflection-date">{new Date(reflection.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} · {new Date(reflection.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span><button className="card-action danger-action" onClick={() => onDelete(reflection.id)} aria-label="Delete reflection"><Trash2 size={15} /></button></div><p>{reflection.text}</p></article>)}</div> : <div className="empty-state compact-empty"><div className="empty-icon"><BookOpen size={20} /></div><p>No reflections yet. Start with one above.</p></div>}</section></div>;
}

function PersonModal({ person, onClose, onSubmit }: { person?: Person; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <ModalFrame title={person ? 'Edit person' : 'Add someone'} eyebrow="YOUR CIRCLE" onClose={onClose}><form onSubmit={onSubmit}><label>Name<input name="name" defaultValue={person?.name} autoFocus placeholder="e.g. Alex Morgan" required /></label><label>Relationship<span className="label-optional">Optional</span><input name="relationship" defaultValue={person?.relationship} placeholder="e.g. close friend, colleague" /></label><label>Context<span className="label-optional">Optional</span><input name="detail" defaultValue={person?.detail} placeholder="What helps you remember this relationship?" /></label><label>Note<span className="label-optional">Optional</span><textarea name="note" defaultValue={person?.note} placeholder="A small thing worth remembering" /></label><ModalActions onClose={onClose} label={person ? 'Save changes' : 'Add person'} /></form></ModalFrame>; }

function PlanModal({ plan, people, onClose, onSubmit }: { plan?: Plan; people: Person[]; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <ModalFrame title={plan ? 'Edit plan' : 'Add a plan'} eyebrow="YOUR TIME" onClose={onClose}><form onSubmit={onSubmit}><label>Title<input name="title" defaultValue={plan?.title} autoFocus placeholder="e.g. Dinner with Maya" required /></label><div className="form-row"><label>Date<input type="date" name="plan_date" defaultValue={plan?.plan_date} required /></label><label>Time<input type="time" name="plan_time" defaultValue={plan?.plan_time?.slice(0, 5)} required /></label></div><div className="form-row"><label>Person<select name="person_id" defaultValue={plan?.person_id || ''}><option value="">Personal time</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label>Category<select name="category" defaultValue={plan?.category || 'Personal'}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label></div><label>Context<span className="label-optional">Optional</span><textarea name="context" defaultValue={plan?.context} placeholder="What do you want to keep in mind?" /></label><ModalActions onClose={onClose} label={plan ? 'Save changes' : 'Add plan'} /></form></ModalFrame>; }

function GoalModal({ goal, onClose, onSubmit }: { goal?: Goal; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <ModalFrame title={goal ? 'Edit goal' : 'Add a monthly goal'} eyebrow="THIS MONTH" onClose={onClose}><form onSubmit={onSubmit}><label>Title<input name="title" defaultValue={goal?.title} autoFocus placeholder="e.g. Protect two evenings for rest" required /></label><label>Category<select name="category" defaultValue={goal?.category || 'Relationships'}>{goalCategories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Description<span className="label-optional">Optional</span><textarea name="description" defaultValue={goal?.description} placeholder="What would this look like in practice?" /></label>{goal && <label>Status<select name="status" defaultValue={goal.status}><option value="active">Active</option><option value="completed">Completed</option></select></label>}<ModalActions onClose={onClose} label={goal ? 'Save changes' : 'Add goal'} /></form></ModalFrame>; }

function ModalFrame({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><span className="card-kicker">{eyebrow}</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>{children}</div></div>; }
function ModalActions({ onClose, label }: { onClose: () => void; label: string }) { return <div className="modal-actions"><button type="button" className="quiet-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button"><Check size={16} /> {label}</button></div>; }

function PlaceholderPage({ page, navigate }: { page: Page; navigate: (page: Page) => void }) { const label = navigation.find((item) => item.id === page)?.label; return <div className="page-wrap placeholder-page"><div className="placeholder-mark"><Sparkles size={22} /></div><p className="eyebrow">COMING NEXT</p><h1>{label} will feel intentional.</h1><p>This space is reserved for a calm, useful way to work with your {label?.toLowerCase()}. It is not connected yet.</p><button className="quiet-button" onClick={() => navigate('home')}>Return home <ArrowUpRight size={15} /></button></div>; }

export default App;
