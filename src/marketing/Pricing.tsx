import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { useAuth } from '../auth/authState';
import { Link } from '../Link';
import { navigateTo } from '../router';
import { AI_FEATURES, FREE_LIMITS, FREE_QUESTIONS_PER_MONTH, PLUS_MONTHLY_CREDITS, PLUS_PRICES, startPlusCheckout, usePlan, type AiFeature } from '../subscription';
import { MarketingFooter, MarketingNav } from './parts';
import { hasSavedData } from './savedData';

const freeFeatures = [
  `Up to ${FREE_LIMITS.people} people in your circle`,
  `${FREE_QUESTIONS_PER_MONTH} questions a month, answered from your own notes`,
  'Unlimited reflections and notes',
  `Up to ${FREE_LIMITS.plans} active plans and ${FREE_LIMITS.goals} active goals`,
  'Relationship history and basic reminders',
  'Export your data any time',
];

const plusFeatures = [
  'Unlimited people, questions, plans and goals',
  `${PLUS_MONTHLY_CREDITS} AI credits every month`,
  'AI reflections',
  'Advanced decision analysis',
  'Relationship pattern detection and detailed analysis',
  'Weekly relationship reviews',
  'AI conversation preparation',
  'Advanced goal alignment, reminders and follow-ups',
];

const comparison: [string, string, string][] = [
  ['People in your circle', `Up to ${FREE_LIMITS.people} active`, 'Unlimited'],
  ['Questions', `${FREE_QUESTIONS_PER_MONTH} a month`, 'Unlimited'],
  ['Active plans', `Up to ${FREE_LIMITS.plans}`, 'Unlimited'],
  ['Active goals', `Up to ${FREE_LIMITS.goals}`, 'Unlimited'],
  ['Reflections and notes', 'Unlimited', 'Unlimited'],
  ['Decision support', 'Clear verdicts from your saved notes', 'Plus advanced AI analysis'],
  ['AI features', 'Not included', `${PLUS_MONTHLY_CREDITS} credits a month`],
  ['Data export', 'Included', 'Included'],
];

const creditOrder: AiFeature[] = ['reflection', 'conversation_prep', 'decision_analysis', 'relationship_analysis', 'weekly_review'];

// Upgrading needs an account, so the plan belongs to someone. The server decides the price and
// only switches the account to Plus after checking Razorpay's signature.
function PlusButton({ id, interval, primary = false }: { id: string; interval: 'month' | 'year'; primary?: boolean }) {
  const auth = useAuth();
  const plan = usePlan();
  const [state, setState] = useState<{ busy: boolean; message: string }>({ busy: false, message: '' });
  const className = `lp-button ${primary ? 'lp-button-primary' : 'lp-button-quiet'} lp-button-block`;
  if (plan.isPlus) return <><Link to="/account" className={className}>You’re on Kinly Plus</Link><p className="lp-plan-note" id={id}>Manage it from your account.</p></>;
  if (auth.status !== 'signedIn') return <><Link to="/signin?next=/pricing" className={className}>Sign in to upgrade</Link><p className="lp-plan-note" id={id}>An account keeps your plan with you. Kinly Free works without one.</p></>;
  const upgrade = async () => {
    setState({ busy: true, message: '' });
    const outcome = await startPlusCheckout(interval, auth.user?.email);
    if (outcome.status === 'upgraded') { navigateTo('/account?upgraded=1'); return; }
    if (outcome.status === 'closed') { setState({ busy: false, message: '' }); return; }
    setState({ busy: false, message: outcome.code === 'unavailable' ? 'Coming soon — Plus payments aren’t available yet.' : outcome.code === 'already_plus' ? 'You already have Kinly Plus.' : outcome.error });
  };
  return <>
    <button type="button" className={className} onClick={upgrade} disabled={state.busy} aria-describedby={id}>{state.busy ? 'Opening checkout…' : 'Upgrade to Plus'}</button>
    <p className="lp-plan-note" id={id} role={state.message ? 'status' : undefined}>{state.message ? <b>{state.message}</b> : `Renews every ${interval}. Cancel any time from your account.`}</p>
  </>;
}

export default function Pricing() {
  const [returning] = useState(hasSavedData);
  return <div className="lp">
    <MarketingNav returning={returning} onLanding={false} />
    <main className="lp-pricing-page">
      <header className="lp-pricing-intro">
        <span className="lp-tag">Pricing</span>
        <h1>Start free. <span className="lp-muted">Grow into Plus.</span></h1>
        <p>Everything you need to keep your people close is free, with no card or trial clock. Kinly Plus adds unlimited space and AI help when you want it.</p>
      </header>

      <div className="lp-pricing lp-pricing-three">
        <article className="lp-plan lp-plan-free">
          <div className="lp-plan-head"><h3>Free</h3><p className="lp-price">₹0<span className="lp-price-per">/month</span></p><p>For keeping your circle close, every day.</p></div>
          <ul>{freeFeatures.map((item) => <li key={item}><Check size={15} />{item}</li>)}</ul>
          <Link to="/app" className="lp-button lp-button-quiet lp-button-block">Start free <ArrowRight size={15} /></Link>
        </article>
        <article className="lp-plan lp-plan-paid lp-plan-featured">
          <div className="lp-plan-head"><h3>Kinly Plus <span className="lp-chip">Monthly</span></h3><p className="lp-price">{PLUS_PRICES.month}<span className="lp-price-per">/month</span></p><p>Unlimited relationships and AI support.</p></div>
          <ul>{plusFeatures.map((item) => <li key={item}><Check size={15} />{item}</li>)}</ul>
          <PlusButton id="plus-monthly-availability" interval="month" primary />
        </article>
        <article className="lp-plan lp-plan-paid">
          <div className="lp-plan-head"><h3>Kinly Plus <span className="lp-chip">Annual</span></h3><p className="lp-price">{PLUS_PRICES.year}<span className="lp-price-per">/year</span></p><p>Everything in Plus, for about two months less than paying monthly.</p></div>
          <ul>{['Everything in Plus monthly', `${PLUS_MONTHLY_CREDITS} AI credits every month, all year`, 'One payment a year'].map((item) => <li key={item}><Check size={15} />{item}</li>)}</ul>
          <PlusButton id="plus-annual-availability" interval="year" />
        </article>
      </div>

      <section className="lp-compare" aria-labelledby="compare-title">
        <h2 id="compare-title">Free and Plus, side by side</h2>
        <div className="lp-compare-scroll">
          <table>
            <thead><tr><th scope="col"><span className="lp-sr">Feature</span></th><th scope="col">Free</th><th scope="col">Plus</th></tr></thead>
            <tbody>{comparison.map(([feature, free, plus]) => <tr key={feature}><th scope="row">{feature}</th><td>{free}</td><td>{plus}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="lp-compare" id="credits" aria-labelledby="credits-title">
        <h2 id="credits-title">How AI credits work</h2>
        <p>Plus includes {PLUS_MONTHLY_CREDITS} credits each billing month. Every AI button shows its cost before you tap it. Credits are only used when an answer comes back. If something fails, nothing is used. Unused credits don’t roll over. If you run out, AI features pause until your next reset date, and everything else keeps working.</p>
        <ul className="lp-credit-list">{creditOrder.map((feature) => <li key={feature}><span>{AI_FEATURES[feature].label}</span><b>{AI_FEATURES[feature].cost} {AI_FEATURES[feature].cost === 1 ? 'credit' : 'credits'}</b></li>)}</ul>
      </section>

      <section className="lp-compare" aria-labelledby="promise-title">
        <h2 id="promise-title">Our promise</h2>
        <p>A plan limit never deletes, hides or locks anything you’ve saved. If you go back to Free, everything stays, and you can still read, edit and export it. See our <Link to="/terms">terms</Link> and <Link to="/refunds">refund policy</Link>.</p>
      </section>
    </main>
    <MarketingFooter />
  </div>;
}
