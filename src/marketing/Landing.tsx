import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowRight, BookOpen, CalendarDays, Check, Download, HardDrive, Lock, Sparkles, Target, Users } from 'lucide-react';
import { analyticsEnabled } from '../analytics';
import { authConfigured } from '../auth/supabaseClient';
import { checkoutAvailable, checkoutIsTest, startCheckout } from '../checkout';
import { Link } from '../Link';
import { navigateTo } from '../router';
import { demoAnswers, heroVariants } from './demoData';
import { DemoBadge, DemoResponse, MarketingFooter, MarketingNav, Reveal, SectionIntro, Verdict } from './parts';
import { hasSavedData } from './savedData';

type Energy = keyof typeof heroVariants;

function HeroPreview() {
  const [energy, setEnergy] = useState<Energy>('low');
  const variant = heroVariants[energy];
  return <div className="lp-window" aria-label="Interactive preview of Kinly with sample data">
    <div className="lp-window-bar"><span /><span /><span /><DemoBadge /></div>
    <div className="lp-window-body">
      <div className="lp-preview-question"><span className="lp-mini-label">Think it through</span><div className="lp-fake-input">Should I meet Arjun tonight?</div></div>
      <div className="lp-energy" role="group" aria-label="Try it: your energy right now">
        <span className="lp-mini-label">Try it — your energy right now</span>
        <div>{(['low', 'okay', 'good'] as Energy[]).map((level) => <button key={level} className={energy === level ? 'is-active' : ''} aria-pressed={energy === level} onClick={() => setEnergy(level)}>{level[0].toUpperCase() + level.slice(1)}</button>)}</div>
      </div>
      <div className="lp-swap" key={energy}><Verdict tone={variant.tone} kicker="Your answer" headline={variant.headline} reason={variant.reason} /></div>
      <dl className="lp-glance lp-glance-compact">
        <div><dt>Last time</dt><dd>Coffee · 12 days ago</dd></div>
        <div><dt>How you felt</dt><dd>Felt good</dd></div>
        <div><dt>Next plan</dt><dd>Sat, 10:30 AM</dd></div>
      </dl>
    </div>
  </div>;
}

function DemoSection() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + demoAnswers.length) % demoAnswers.length;
    setActive(next);
    tabs.current[next]?.focus();
  };
  const answer = demoAnswers[active];
  return <section className="lp-section" id="product" aria-labelledby="demo-title">
    <Reveal><SectionIntro id="demo-title" kicker="See it in action" title="A little more context." muted="A better decision.">Pick a question. Each answer below is a prewritten example built from sample people — the public demo doesn’t read anything about you.</SectionIntro></Reveal>
    <Reveal className="lp-demo">
      <div className="lp-demo-tabs" role="tablist" aria-label="Example questions" aria-orientation="vertical">
        {demoAnswers.map((item, index) => <button key={item.id} ref={(node) => { tabs.current[index] = node; }} role="tab" id={`demo-tab-${item.id}`} aria-selected={active === index} aria-controls="demo-panel" tabIndex={active === index ? 0 : -1} className={active === index ? 'is-active' : ''} onClick={() => setActive(index)} onKeyDown={(event) => onKey(event, index)}><span className="lp-demo-num">0{index + 1}</span>{item.question}</button>)}
      </div>
      <div className="lp-window lp-demo-window" role="tabpanel" id="demo-panel" aria-labelledby={`demo-tab-${answer.id}`}>
        <div className="lp-window-bar"><span /><span /><span /><DemoBadge /></div>
        <div className="lp-window-body">
          <div className="lp-preview-question"><span className="lp-mini-label">You asked</span><div className="lp-fake-input">{answer.question}</div></div>
          <div className="lp-swap" key={answer.id}><DemoResponse answer={answer} /></div>
        </div>
      </div>
    </Reveal>
  </section>;
}

const steps = [
  { title: 'Add a little context', text: 'Save the people who matter, your plans and up to three monthly goals. A note here, a feeling there.' },
  { title: 'Ask, and see your options', text: 'Bring a real question. Kinly answers with a clear verdict, the facts behind it, and the trade-offs.' },
  { title: 'Reflect, then choose with intent', text: 'After time together, write a few lines. Patterns appear, and the next decision gets easier.' },
];

const features = [
  { icon: Users, tag: 'People', title: 'Remember what matters about each person.', text: 'Notes, relationship context, an avatar colour, and a page per person with your shared history.', vignette: <div className="lp-vig-person"><span className="lp-vig-avatar">MC</span><div><b>Maya Chen</b><small>Close friend</small><p>“Ask about the studio move.”</p></div></div> },
  { icon: CalendarDays, tag: 'Plans', title: 'See your week before it fills up.', text: 'Upcoming and past plans in your own time zone, linked to the people involved.', vignette: <div className="lp-vig-plans"><div><b>Thu</b><span>Dinner with Maya</span><small>7:00 PM</small></div><div><b>Sat</b><span>Walk with Arjun</span><small>10:30 AM</small></div></div> },
  { icon: Target, tag: 'Goals', title: 'A few priorities, kept honest.', text: 'Up to three active monthly goals — the limit is enforced — plus a weekly connection goal.', vignette: <div className="lp-vig-goals"><span>2 of 3 active priorities</span><i><b style={{ width: '66%' }} /></i><small>Weekly goal · 1 seen · 2 planned</small></div> },
  { icon: Sparkles, tag: 'Decisions', title: 'Clear answers, with the reasons shown.', text: 'Should I go? How did it go? Should I cancel? Who should I reach out to? Your energy check-in shapes the verdict.', vignette: <div className="lp-vig-verdict"><span className="lp-verdict-mark" /><div><b>Not tonight</b><small>You’re already seeing Arjun on Saturday.</small></div></div>, note: 'Optional AI “Deeper answers” with Claude are built but not switched on yet.' },
  { icon: BookOpen, tag: 'Reflections', title: 'Learn from how time together felt.', text: 'Tag a reflection with a person. Kinly notices feelings and, over a few weeks, gentle patterns.', vignette: <div className="lp-vig-reflect"><small>Mon, Oct 19 · About Maya</small><b>Felt good</b><p>“Warm and easy. She needs room to think out loud.”</p></div> },
  { icon: Lock, tag: 'Privacy', title: 'Your notes stay on this device.', text: 'Everything is saved in your browser. Export a backup, restore it, or delete everything in one place.', vignette: <div className="lp-vig-privacy"><HardDrive size={18} /><span>Stored in this browser</span><Download size={16} /></div> },
];

// Opens Razorpay's payment window; the order and the signature check happen on the server.
function SupportButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function support() {
    setBusy(true);
    setMessage('');
    try {
      const outcome = await startCheckout();
      if (outcome.status === 'succeeded') navigateTo(`/checkout/complete?status=succeeded&payment_id=${encodeURIComponent(outcome.paymentId)}`);
      else if (outcome.failure) setMessage(`${outcome.failure} You haven’t been charged. You can try again.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return <>
    <button type="button" className="lp-button lp-button-primary lp-button-block" onClick={support} disabled={busy}>{busy ? 'Opening checkout…' : 'Support Kinly early'}</button>
    {message && <p className="lp-auth-error" role="alert">{message}</p>}
    <p className="lp-plan-note">{checkoutIsTest ? <><b className="lp-test-badge">Test mode</b> — no real money is charged.</> : 'Secure checkout by Razorpay.'} You’ll see the price in the Razorpay window before you pay. See our <Link to="/terms">terms</Link> and <Link to="/refunds">refund policy</Link>.</p>
  </>;
}

export default function Landing() {
  const [returning] = useState(hasSavedData);
  // Arriving from another page with a #section link: scroll once the page has rendered.
  useEffect(() => {
    if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, []);
  return <div className="lp">
    <a className="lp-skip" href="#main">Skip to content</a>
    <MarketingNav returning={returning} />
    <main id="main">
      <section className="lp-hero" aria-labelledby="hero-title">
        <div className="lp-hero-grid">
          <h1 id="hero-title" className="lp-hero-title">Make more intentional decisions <span className="lp-muted">about the people in your life.</span></h1>
          <div className="lp-hero-side">
            <span className="lp-tag lp-tag-solid">Personal decision copilot</span>
            <p className="lp-hero-copy">Kinly helps you reflect on your relationships, balance your time, and make decisions with greater clarity.</p>
            <div className="lp-hero-ctas">
              <Link to="/app" className="lp-button lp-button-primary">{returning ? 'Open Kinly' : 'Get started'} <ArrowRight size={16} /></Link>
              <a href="#how-it-works" className="lp-button lp-button-quiet">Explore how it works</a>
            </div>
            <p className="lp-hero-meta">Free · No sign-up needed · Stays in your browser</p>
          </div>
        </div>
        <div className="lp-hero-preview"><HeroPreview /></div>
        <ul className="lp-pillars" aria-label="What Kinly helps with">
          {[[Users, 'People'], [CalendarDays, 'Plans'], [Target, 'Goals'], [Sparkles, 'Decisions'], [BookOpen, 'Reflections']].map(([Icon, label]) => { const I = Icon as typeof Users; return <li key={label as string}><I size={20} strokeWidth={1.6} /><span>{label as string}</span></li>; })}
        </ul>
      </section>

      <DemoSection />

      <section className="lp-section" id="how-it-works" aria-labelledby="how-title">
        <Reveal><SectionIntro id="how-title" kicker="How it works" title="Three small steps." muted="Repeated, they add up." /></Reveal>
        <Reveal><ol className="lp-steps">{steps.map((step, index) => <li key={step.title} className="lp-step" style={{ animationDelay: `${index * 90}ms` }}><span className="lp-step-num">{index + 1}</span><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol></Reveal>
      </section>

      <section className="lp-section" id="features" aria-labelledby="features-title">
        <Reveal><SectionIntro id="features-title" kicker="Features" title="Built from real moments," muted="not marketing claims.">Everything below works in Kinly today.</SectionIntro></Reveal>
        <div className="lp-features">{features.map((feature, index) => <Reveal key={feature.tag} delay={(index % 3) * 80}><article className="lp-feature">
          <div className="lp-feature-vignette">{feature.vignette}</div>
          <div className="lp-feature-copy"><span className="lp-tag"><feature.icon size={12} /> {feature.tag}</span><h3>{feature.title}</h3><p>{feature.text}</p>{feature.note && <p className="lp-feature-note">{feature.note}</p>}</div>
        </article></Reveal>)}</div>
      </section>

      <section className="lp-section" id="pricing" aria-labelledby="pricing-title">
        <Reveal><SectionIntro id="pricing-title" kicker="Pricing" title="Free to use." muted="More, later.">No card, no account, no trial clock.</SectionIntro></Reveal>
        <div className="lp-pricing">
          <Reveal><article className="lp-plan lp-plan-free">
            <div className="lp-plan-head"><h3>Free</h3><p className="lp-price">₹0</p><p>Everything Kinly does today.</p></div>
            <ul>{['People, plans and up to three monthly goals', 'Decision support with clear verdicts', 'Reflections, patterns and your daily check-in', 'Backup, restore and delete — all in your browser'].map((item) => <li key={item}><Check size={15} />{item}</li>)}</ul>
            <Link to="/app" className="lp-button lp-button-primary lp-button-block">{returning ? 'Open Kinly' : 'Get started'}</Link>
          </article></Reveal>
          <Reveal delay={90}><article className="lp-plan lp-plan-plus">
            <div className="lp-plan-head"><h3>Kinly Plus <span className="lp-chip">Proposed</span></h3><p className="lp-price lp-price-muted">{checkoutAvailable ? 'Support early' : 'Coming later'}</p><p>{checkoutAvailable ? 'Ideas we’re exploring. These features aren’t available yet — supporting now helps build them.' : 'Ideas we’re exploring. Not available yet, and no price is set.'}</p></div>
            <ul>{['Sync across devices, once accounts exist', 'Optional deeper AI answers', 'Longer-term patterns and reviews'].map((item) => <li key={item}><span className="lp-dot" aria-hidden="true" />{item}</li>)}</ul>
            {checkoutAvailable ? <SupportButton /> : <>
              <span className="lp-button lp-button-disabled lp-button-block" aria-disabled="true">Coming later</span>
              <p className="lp-plan-note">There’s no waitlist or payment yet. We’ll share news here first.</p>
            </>}
          </article></Reveal>
        </div>
      </section>

      <section className="lp-privacy" id="privacy" aria-labelledby="privacy-title">
        <Reveal className="lp-privacy-inner">
          <div><span className="lp-tag lp-tag-dark">Privacy</span><h2 id="privacy-title">Your notes stay with you.</h2><p>Here’s exactly how Kinly handles your data today — no fine print.</p></div>
          <ul className="lp-privacy-list">
            <li><b>Saved in this browser, on this device.</b> People, plans, goals and reflections never leave it unless you choose to.</li>
            <li><b>Not synced.</b> Another device or browser starts empty. Clearing your browser data removes everything.</li>
            <li><b>Backups are yours.</b> Export a file from Settings and restore it anywhere; delete everything in one click.</li>
            {analyticsEnabled && <li><b>Anonymous usage analytics.</b> We use Microsoft Clarity to see which pages and buttons people use, so we can improve Kinly. Text inside the app and your account is masked — Clarity never sees your notes, names or reflections. It uses cookies to recognise repeat visits.</li>}
            {authConfigured
              ? <li><b>Accounts are optional.</b> If you sign in, you can copy your data to a private account that only you can read. Nothing uploads unless you choose to. It isn’t end-to-end encrypted, and it doesn’t sync across devices automatically yet.</li>
              : <li><b>No accounts yet.</b> We don’t offer cloud backup, end-to-end encryption or account security today, and we won’t claim to.</li>}
          </ul>
        </Reveal>
      </section>

      <section className="lp-cta" aria-labelledby="cta-title">
        <Reveal><h2 id="cta-title">Your people. <span className="lp-muted">A more intentional tomorrow.</span></h2>
          <div className="lp-hero-ctas lp-cta-buttons"><Link to="/app" className="lp-button lp-button-primary">{returning ? 'Open Kinly' : 'Get started'} <ArrowRight size={16} /></Link><a href="#product" className="lp-button lp-button-quiet">Try the demo again</a></div></Reveal>
      </section>
    </main>
    <MarketingFooter />
  </div>;
}
