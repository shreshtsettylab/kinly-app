import { useMemo, useState } from 'react';
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
  Home,
  Menu,
  Plus,
  Search,
  Settings,
  Sparkles,
  Target,
  Users,
  X,
} from 'lucide-react';
import { people as initialPeople, prompts, upcomingPlans, type Person } from './mockData';

type Page = 'home' | 'people' | 'plans' | 'reflections' | 'goals' | 'settings';

const navigation: { id: Page; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'people', label: 'People', icon: Users },
  { id: 'plans', label: 'Plans', icon: CalendarDays },
  { id: 'reflections', label: 'Reflections', icon: BookOpen },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function Avatar({ person, size = 'md' }: { person: Person; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div
      className={`avatar avatar-${size}`}
      style={{ backgroundColor: person.color }}
      aria-label={person.name}
    >
      {person.initials}
    </div>
  );
}

function App() {
  const [page, setPage] = useState<Page>('home');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [people, setPeople] = useState(initialPeople);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [search, setSearch] = useState('');
  const [question, setQuestion] = useState('');

  const filteredPeople = useMemo(
    () => people.filter((p) => `${p.name} ${p.relationship}`.toLowerCase().includes(search.toLowerCase())),
    [people, search]
  );

  const navigate = (nextPage: Page) => {
    setPage(nextPage);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addPerson = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const relationship = String(form.get('relationship') || '').trim() || 'Person in your life';
    if (!name) return;
    const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
    setPeople((current) => [...current, {
      id: Date.now(), name, initials, relationship,
      detail: 'Someone you want to be more intentional with',
      color: '#526579',
      note: 'Add a note whenever something feels worth remembering.',
    }]);
    setShowAddPerson(false);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <button className="brand" onClick={() => navigate('home')} aria-label="Go to Kinly home">
            <img className="brand-icon" src="/assets/kinly-icon.png" alt="" />
            <span className="brand-wordmark">Kinly</span>
          </button>
          <button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <div className="workspace-label">YOUR SPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${page === id ? 'nav-item-active' : ''}`} onClick={() => navigate(id)}>
              <Icon size={18} strokeWidth={page === id ? 2.3 : 1.8} />
              <span>{label}</span>
              {id === 'home' && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note"><Sparkles size={15} /><span>Your space is private<br />by design.</span></div>
          <div className="profile-chip">
            <div className="profile-avatar">JL</div>
            <div><strong>Jordan Lee</strong><span>Personal space</span></div>
            <ChevronRight size={15} className="profile-chevron" />
          </div>
        </div>
      </aside>

      {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
          <div className="breadcrumbs"><span>Kinly</span><ChevronRight size={14} /><strong>{navigation.find((item) => item.id === page)?.label}</strong></div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Search"><Search size={18} /></button>
            <button className="icon-button notification-button" aria-label="Notifications"><Bell size={18} /><span /></button>
            <div className="top-avatar">JL</div>
          </div>
        </header>

        {page === 'home' && <HomePage question={question} setQuestion={setQuestion} navigate={navigate} />}
        {page === 'people' && <PeoplePage search={search} setSearch={setSearch} people={filteredPeople} onAdd={() => setShowAddPerson(true)} />}
        {page !== 'home' && page !== 'people' && <PlaceholderPage page={page} navigate={navigate} />}
      </main>

      {showAddPerson && <AddPersonModal onClose={() => setShowAddPerson(false)} onSubmit={addPerson} />}
    </div>
  );
}

function HomePage({ question, setQuestion, navigate }: { question: string; setQuestion: (v: string) => void; navigate: (page: Page) => void }) {
  return (
    <div className="page-wrap home-page">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">TUESDAY, OCTOBER 13</p>
          <h1>Your people. A more intentional tomorrow.</h1>
          <p className="intro">Think clearly about your time, your relationships, and the choices between them.</p>
        </div>
        <button className="quiet-button" onClick={() => navigate('people')}><Plus size={16} /> Add a person</button>
      </section>

      <section className="reflection-card">
        <div className="reflection-icon"><Sparkles size={19} /></div>
        <div className="reflection-copy">
          <span className="card-kicker">A MOMENT TO CONSIDER</span>
          <h2>What would feel nourishing today?</h2>
          <p>You have some open space this evening. Notice what your energy is asking for before you fill it.</p>
        </div>
        <button className="text-button">Reflect for a minute <ArrowUpRight size={15} /></button>
      </section>

      <section className="ask-section">
        <div className="section-heading">
          <div><span className="card-kicker">THINK IT THROUGH</span><h2>Bring a question to mind.</h2></div>
          <CircleHelp size={18} />
        </div>
        <div className="question-box">
          <Search size={19} />
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about a person or plan…" aria-label="Ask about a person or plan" />
          <kbd><Command size={12} /> K</kbd>
        </div>
        <div className="prompt-list">
          {prompts.map((prompt) => (
            <button key={prompt} className="prompt-pill" onClick={() => setQuestion(prompt)}>{prompt}<ArrowUpRight size={14} /></button>
          ))}
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="content-card upcoming-card">
          <div className="card-header">
            <div><span className="card-kicker">YOUR WEEK</span><h2>Coming up</h2></div>
            <button className="card-link" onClick={() => navigate('plans')}>View all <ArrowUpRight size={14} /></button>
          </div>
          <div className="plans-list">
            {upcomingPlans.map((plan) => (
              <div className="plan-row" key={plan.id}>
                <div className="date-block"><strong>{plan.date.split(' ')[0]}</strong><span>{plan.date.split(' ')[1] || 'soon'}</span></div>
                <div className="plan-info"><strong>{plan.title}</strong><span>{plan.person} <i>·</i> {plan.kind}</span></div>
                <div className="plan-time"><Clock3 size={14} />{plan.time}</div>
                <ChevronRight size={16} className="row-chevron" />
              </div>
            ))}
          </div>
        </section>
        <section className="content-card people-preview">
          <div className="card-header">
            <div><span className="card-kicker">YOUR CIRCLE</span><h2>People</h2></div>
            <button className="card-link" onClick={() => navigate('people')}>See directory <ArrowUpRight size={14} /></button>
          </div>
          <div className="mini-people">
            {initialPeople.slice(0, 4).map((person) => (
              <button className="mini-person" key={person.id} onClick={() => navigate('people')}>
                <Avatar person={person} size="sm" />
                <span>{person.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
          <button className="add-person-line" onClick={() => navigate('people')}><Plus size={15} /> Keep your circle close</button>
        </section>
      </div>
    </div>
  );
}

function PeoplePage({ search, setSearch, people, onAdd }: { search: string; setSearch: (v: string) => void; people: Person[]; onAdd: () => void }) {
  return (
    <div className="page-wrap people-page">
      <section className="page-heading-row">
        <div>
          <p className="eyebrow">YOUR CIRCLE</p>
          <h1>People</h1>
          <p className="intro">The people who shape your days, held in one thoughtful place.</p>
        </div>
        <button className="primary-button" onClick={onAdd}><Plus size={17} /> Add person</button>
      </section>
      <div className="directory-toolbar">
        <div className="directory-search"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people" aria-label="Search people" /></div>
        <span>{people.length} {people.length === 1 ? 'person' : 'people'}</span>
      </div>
      {people.length > 0 ? (
        <div className="people-grid">
          {people.map((person) => (
            <article className="person-card" key={person.id}>
              <div className="person-card-top">
                <Avatar person={person} size="lg" />
                <button className="more-button" aria-label={`More options for ${person.name}`}>···</button>
              </div>
              <h2>{person.name}</h2>
              <p className="relationship">{person.relationship}</p>
              <p className="person-detail">{person.detail}</p>
              <div className="person-divider" />
              {person.nextPlan ? (
                <div className="next-plan">
                  <CalendarDays size={15} />
                  <div><span>NEXT UP</span><strong>{person.nextPlan}</strong><small>{person.nextPlanDate}</small></div>
                </div>
              ) : (
                <div className="no-plan"><Clock3 size={15} /><span>No upcoming plans</span></div>
              )}
              <button className="view-person">Open profile <ArrowUpRight size={15} /></button>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon"><Users size={23} /></div>
          <h2>No one by that name yet.</h2>
          <p>Try another search, or add someone new to your circle.</p>
          <button className="primary-button" onClick={onAdd}><Plus size={17} /> Add person</button>
        </div>
      )}
    </div>
  );
}

function PlaceholderPage({ page, navigate }: { page: Page; navigate: (page: Page) => void }) {
  const label = navigation.find((item) => item.id === page)?.label;
  return (
    <div className="page-wrap placeholder-page">
      <div className="placeholder-mark"><Sparkles size={22} /></div>
      <p className="eyebrow">COMING NEXT</p>
      <h1>{label} will feel intentional.</h1>
      <p>This space is reserved for a calm, useful way to work with your {label?.toLowerCase()}. It is not connected yet.</p>
      <button className="quiet-button" onClick={() => navigate('home')}>Return home <ArrowUpRight size={15} /></button>
    </div>
  );
}

function AddPersonModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="add-person-title">
        <div className="modal-header">
          <div><span className="card-kicker">YOUR CIRCLE</span><h2 id="add-person-title">Add someone</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={onSubmit}>
          <label>Name<input name="name" autoFocus placeholder="e.g. Alex Morgan" /></label>
          <label>Relationship<span className="label-optional">Optional</span><input name="relationship" placeholder="e.g. close friend, colleague" /></label>
          <div className="modal-actions">
            <button type="button" className="quiet-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button"><Check size={16} /> Add person</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
