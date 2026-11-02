import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
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

// A headline that arrives word by word. Each word is still plain text for screen readers.
function Words({ text, start = 0 }: { text: string; start?: number }) {
  const words = text.split(' ');
  return <>{words.map((word, index) => <span key={`${word}-${index}`}><span className="lp-word" style={{ '--i': start + index } as CSSProperties}>{word}</span>{index < words.length - 1 ? ' ' : ''}</span>)}</>;
}

// The live demo, with the three things Kinly remembers floating around it.
function HeroScene() {
  return <div className="lp-scene">
    <p className="lp-scene-note" aria-hidden="true">Ask, decide,<br />then reflect.<svg viewBox="0 0 60 30" width="54" height="27"><path d="M4 6 C 22 4, 40 10, 50 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M43 22 L 51 25 L 52 17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></p>
    <div className="lp-scene-card"><HeroPreview /></div>
    <div className="lp-float lp-float-a" style={{ '--d': '.5s' } as CSSProperties}><span className="lp-float-avatar">MC</span><span><b>Maya Chen</b><small>Close friend · “ask about the move”</small></span></div>
    <div className="lp-float lp-float-b" style={{ '--d': '.65s' } as CSSProperties}><span className="lp-float-icon"><CalendarDays size={15} /></span><span><b>Dinner at Lupa</b><small>Tomorrow · 7:00 PM</small></span></div>
    <div className="lp-float lp-float-c" style={{ '--d': '.8s' } as CSSProperties}><span className="lp-float-icon"><BookOpen size={15} /></span><span><b>Felt warm</b><small>Coffee, 12 days ago</small></span></div>
  </div>;
}

// The moments Kinly has words for, drifting slowly past. Pauses on hover; still for reduced motion.
const moments = ['Cancel kindly', 'Say no without guilt', 'Leave early, warmly', 'Reconnect after months', 'Check in on a friend', 'Celebrate their news', 'Ask for money back', 'Say “I miss you”', 'Follow up, no pressure', 'Apologise well'];
function Moments() {
  return <div className="lp-marquee" aria-label="Moments Kinly helps with">
    <div className="lp-marquee-track">{[...moments, ...moments].map((moment, index) => <span key={index} aria-hidden={index >= moments.length}>{moment}<i>✦</i></span>)}</div>
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
    <Reveal><SectionIntro id="demo-title" kicker="See it in action" title="A little context." muted="A clearer answer.">Pick a question. These are samples built from example people.</SectionIntro></Reveal>
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
  { title: 'Add your people', text: 'A name, a note, a plan. That’s enough to start.' },
  { title: 'Ask a real question', text: 'Get a clear answer, with the reasons shown.' },
  { title: 'Reflect afterwards', text: 'A few lines on how it felt. Patterns appear.' },
];

const features = [
  { icon: Users, tag: 'People', title: 'Remember what matters about each person.', text: 'A page for each person, with your notes and shared history.', vignette: <div className="lp-vig-person"><span className="lp-vig-avatar">MC</span><div><b>Maya Chen</b><small>Close friend</small><p>“Ask about the studio move.”</p></div></div> },
  { icon: CalendarDays, tag: 'Plans', title: 'See your week before it fills up.', text: 'Plans linked to people. Import them from Google Calendar.', vignette: <div className="lp-vig-plans"><div><b>Thu</b><span>Dinner with Maya</span><small>7:00 PM</small></div><div><b>Sat</b><span>Walk with Arjun</span><small>10:30 AM</small></div></div> },
  { icon: Target, tag: 'Goals', title: 'A few priorities, kept honest.', text: 'Three monthly priorities and a weekly connection goal.', vignette: <div className="lp-vig-goals"><span>2 of 3 active priorities</span><i><b style={{ width: '66%' }} /></i><small>Weekly goal · 1 seen · 2 planned</small></div> },
  { icon: Sparkles, tag: 'Decisions', title: 'Clear answers, with the reasons shown.', text: 'Should I go? What do I say? Your energy shapes the answer.', vignette: <div className="lp-vig-verdict"><span className="lp-verdict-mark" /><div><b>Not tonight</b><small>You’re already seeing Arjun on Saturday.</small></div></div>, note: 'Kinly Plus adds AI answers and ready-made words for tricky moments.' },
  { icon: BookOpen, tag: 'Reflections', title: 'Learn from how time together felt.', text: 'Write how time together felt. Kinly notices patterns.', vignette: <div className="lp-vig-reflect"><small>Mon, Oct 19 · About Maya</small><b>Felt good</b><p>“Warm and easy. She needs room to think out loud.”</p></div> },
  { icon: Lock, tag: 'Privacy', title: 'Your notes stay on this device.', text: 'Saved in your browser. Back up or delete any time.', vignette: <div className="lp-vig-privacy"><HardDrive size={18} /><span>Stored in this browser</span><Download size={16} /></div> },
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
      <section className="lp-hero lp-hero-v2" aria-labelledby="hero-title">
        <div className="lp-hero-split">
          <div className="lp-hero-text">
            <span className="lp-tag lp-rise" style={{ '--d': '0s' } as CSSProperties}>Your personal relationship copilot</span>
            <h1 id="hero-title" className="lp-hero-title"><Words text="Clearer choices about" /> <em className="lp-accent"><Words text="the people who matter." start={3} /></em></h1>
            <p className="lp-hero-copy lp-rise" style={{ '--d': '.6s' } as CSSProperties}>Ask a real question. Kinly answers from what you’ve saved, with the reasons shown.</p>
            <div className="lp-hero-ctas lp-rise" style={{ '--d': '.72s' } as CSSProperties}>
              <Link to="/app" className="lp-button lp-button-primary">{returning ? 'Open Kinly' : 'Get started'} <ArrowRight size={16} /></Link>
              <a href="#how-it-works" className="lp-button lp-button-quiet">How it works</a>
            </div>
            <p className="lp-hero-meta lp-rise" style={{ '--d': '.84s' } as CSSProperties}>Free · No sign-up · Stays in your browser</p>
          </div>
          <HeroScene />
        </div>
      </section>
      <Moments />

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
        <Reveal><SectionIntro id="pricing-title" kicker="Pricing" title="Start free." muted="Grow into Plus.">No card, no account, no trial clock.</SectionIntro></Reveal>
        <div className="lp-pricing">
          <Reveal><article className="lp-plan lp-plan-free">
            <div className="lp-plan-head"><h3>Free</h3><p className="lp-price">₹0</p><p>For keeping your circle close, every day.</p></div>
            <ul>{['Up to 5 people in your circle', '15 questions a month, with clear verdicts', 'Unlimited reflections, notes and your daily check-in', 'Backup, restore and delete — all in your browser'].map((item) => <li key={item}><Check size={15} />{item}</li>)}</ul>
            <Link to="/app" className="lp-button lp-button-primary lp-button-block">{returning ? 'Open Kinly' : 'Get started'}</Link>
          </article></Reveal>
          <Reveal delay={90}><article className="lp-plan lp-plan-plus">
            <div className="lp-plan-head"><h3>Kinly Plus <span className="lp-chip">Coming soon</span></h3><p className="lp-price">₹99<span className="lp-price-per">/month</span></p><p>Or ₹999 a year. Unlimited people and questions, plus 20 AI credits a month.</p></div>
            <ul>{['AI reflections and weekly relationship reviews', 'Advanced decision and relationship analysis', 'AI conversation preparation', 'Unlimited people, questions, plans and goals'].map((item) => <li key={item}><span className="lp-dot" aria-hidden="true" />{item}</li>)}</ul>
            <Link to="/pricing" className="lp-button lp-button-quiet lp-button-block">Compare plans</Link>
            {checkoutAvailable && <div className="lp-support-early"><p>Plus payments aren’t open yet. Want to help build it now?</p><SupportButton /></div>}
          </article></Reveal>
        </div>
      </section>

      <section className="lp-privacy" id="privacy" aria-labelledby="privacy-title">
        <Reveal className="lp-privacy-inner">
          <div><span className="lp-tag lp-tag-dark">Privacy</span><h2 id="privacy-title">Your notes stay with you.</h2><p>How Kinly handles your data, plainly.</p></div>
          <ul className="lp-privacy-list">
            <li><b>Saved in this browser.</b> Your notes never leave it unless you choose to.</li>
            <li><b>A space per account.</b> Signing out hides your data; signing in brings it back.</li>
            <li><b>Backups are yours.</b> Export, restore or delete everything from Settings.</li>
            {analyticsEnabled && <li><b>Masked analytics.</b> Microsoft Clarity counts page visits; it never sees your notes or names.</li>}
            {authConfigured
              ? <li><b>Accounts are optional.</b> Back up to a private account only you can read. Nothing uploads unless you choose to.</li>
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
