import { useState } from 'react';
import { ArrowUpRight, Sparkles, X } from 'lucide-react';
import { Link } from '../Link';
import { AI_FEATURES, FREE_LIMITS, PLUS_MONTHLY_CREDITS, PLUS_PRICES, fmtLongDate, runAi, type AiFeature, type AiResult, type LimitKind, type PlanState } from '../subscription';

const statusLabels = { active: 'Active', trial: 'Trial', pending: 'Pending', cancelled: 'Cancelled', expired: 'Expired' } as const;
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

// The plan, as the database reports it. Never shows a date, price or status that isn't real.
export function SubscriptionCard({ plan, showUsage = false }: { plan: PlanState; showUsage?: boolean }) {
  const { status, subscription: sub, credits, usage, isPlus } = plan;
  if (status === 'loading') return <section className="content-card sub-card"><span className="card-kicker">YOUR PLAN</span><p className="sub-muted">Checking your plan…</p></section>;
  if (status === 'unavailable') return <section className="content-card sub-card"><span className="card-kicker">YOUR PLAN</span><h2>Plan details aren’t available right now</h2><p className="sub-muted">Kinly couldn’t read your plan. Everything you’ve saved is unaffected. Try again later.</p></section>;

  if (!isPlus) {
    const lapsed = sub && sub.plan === 'plus';
    return <section className="content-card sub-card">
      <div className="sub-head"><div><span className="card-kicker">YOUR PLAN</span><h2>Kinly Free</h2></div><p className="sub-price">₹0<span>/month</span></p></div>
      <dl className="sub-details">
        <div><dt>Status</dt><dd>{lapsed ? `Plus ${statusLabels[sub.status].toLowerCase()} — you’re on Free` : status === 'local' ? 'Free, no account needed' : 'Active'}</dd></div>
      </dl>
      <ul className="sub-limits">
        <li><b>{FREE_LIMITS.people}</b> people allowed</li>
        <li><b>{FREE_LIMITS.plans}</b> active plans allowed</li>
        <li><b>{FREE_LIMITS.goals}</b> active goals allowed</li>
        <li>Unlimited reflections, notes and decision support</li>
      </ul>
      <div className="sub-actions">
        <Link to="/pricing" className="primary-button">Explore Kinly Plus <ArrowUpRight size={15} /></Link>
        {status === 'local' && <Link to="/signin?next=/app" className="quiet-button">Sign in</Link>}
      </div>
    </section>;
  }

  const allowance = credits?.allowance ?? PLUS_MONTHLY_CREDITS;
  const used = credits?.used ?? 0;
  const remaining = credits?.remaining ?? 0;
  const interval = sub?.billing_interval === 'year' ? 'year' : 'month';
  return <section className="content-card sub-card sub-card-plus">
    <div className="sub-head"><div><span className="card-kicker">YOUR PLAN</span><h2>Kinly Plus</h2></div><p className="sub-price">{PLUS_PRICES[interval]}<span>/{interval}</span></p></div>
    <dl className="sub-details">
      <div><dt>Status</dt><dd>{sub ? statusLabels[sub.status] : '—'}</dd></div>
      <div><dt>Billing</dt><dd>{interval === 'year' ? 'Annual' : 'Monthly'}</dd></div>
      {sub?.current_period_end && <div><dt>{sub.cancel_at_period_end || sub.status === 'cancelled' ? 'Plus ends on' : 'Renews on'}</dt><dd>{fmtLongDate(sub.current_period_end)}</dd></div>}
    </dl>
    <div className="sub-usage">
      <span className="card-kicker">AI USAGE</span>
      <p className="sub-usage-line"><b>{used} / {allowance}</b> credits used · {plural(remaining, 'credit')} remaining</p>
      <div className="sub-progress" role="progressbar" aria-label="AI credits used" aria-valuemin={0} aria-valuemax={allowance} aria-valuenow={used}><i style={{ width: `${Math.min(used / allowance * 100, 100)}%` }} /></div>
      {credits?.resets_at && <p className="sub-muted">Next reset: {fmtLongDate(credits.resets_at)}</p>}
    </div>
    {showUsage && <div className="sub-history">
      <span className="card-kicker">RECENT AI USE</span>
      {usage.length ? <ul>{usage.map((item) => <li key={item.id}><span>{AI_FEATURES[item.feature]?.label ?? item.feature}</span><span>{item.request_status === 'succeeded' ? plural(item.credits_used, 'credit') : item.request_status === 'failed' ? 'Failed · no credits' : 'In progress'}</span><span>{new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></li>)}</ul> : <p className="sub-muted">No AI features used yet.</p>}
    </div>}
    <div className="sub-actions"><Link to="/contact" className="quiet-button">Manage subscription</Link></div>
    <p className="sub-muted sub-footnote">To change or cancel your plan, contact us. Self-serve management will come with online Plus payments.</p>
  </section>;
}

const limitCopy: Record<LimitKind, { title: string; text: string }> = {
  people: { title: `Your circle has ${FREE_LIMITS.people} people`, text: `That’s the most Kinly Free keeps active. Archive someone you see less often to make room — their history stays — or move to Kinly Plus for unlimited people.` },
  plans: { title: `You have ${FREE_LIMITS.plans} upcoming plans`, text: 'That’s the Free limit for active plans. Past plans don’t count, so this frees up as plans happen. Kinly Plus has no limit.' },
  goals: { title: `You have ${FREE_LIMITS.goals} active goals`, text: 'That’s the Free limit. Mark one completed to make room, or move to Kinly Plus for unlimited goals.' },
};

// Shown only when someone tries to go past a Free limit. Dismissible, and nothing is hidden or removed.
export function UpgradeNotice({ kind, onDismiss }: { kind: LimitKind; onDismiss: () => void }) {
  const { title, text } = limitCopy[kind];
  return <div className="upgrade-notice" role="status">
    <Sparkles size={17} className="upgrade-notice-icon" />
    <div><strong>{title}</strong><p>{text}</p><Link to="/pricing" className="card-link">Explore Kinly Plus <ArrowUpRight size={14} /></Link></div>
    <button className="icon-button" onClick={onDismiss} aria-label="Dismiss"><X size={16} /></button>
  </div>;
}

type AiPanelProps = { feature: AiFeature; plan: PlanState; aiEnabled: boolean; onEnableAi: () => void; buildContext: () => Record<string, unknown>; sends: string; benefit: string };

// One Kinly Plus AI action. Free and signed-out people see it marked Plus and get an explanation,
// never a request. Plus members see the cost before they tap, and what was used afterwards.
export function AiPanel({ feature, plan, aiEnabled, onEnableAi, buildContext, sends, benefit }: AiPanelProps) {
  const { label, cost } = AI_FEATURES[feature];
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'explain' } | AiResult>({ status: 'idle' });
  const credits = plan.credits;
  const costText = plural(cost, 'credit');

  if ('ok' in state && state.ok) {
    const { verdict, headline, reason, points } = state.answer;
    return <div className={`deeper-answer deeper-${verdict}`}><span className="card-kicker"><Sparkles size={12} /> {label.toUpperCase()} — CLAUDE AI</span><h4>{headline}</h4><p>{reason}</p>{points.length > 0 && <ul>{points.slice(0, 5).map((point) => <li key={point}>{point}</li>)}</ul>}<small>Used {costText}{state.credits ? ` · ${plural(state.credits.remaining, 'credit')} left this month` : ''}. Written by Claude from your saved notes — it can be wrong, so trust your own sense of things.</small></div>;
  }

  if (!plan.isPlus) {
    const explain = 'status' in state && state.status === 'explain';
    return <div className="ai-panel">
      <button className="deeper-button ai-locked" onClick={() => setState({ status: explain ? 'idle' : 'explain' })} aria-expanded={explain} disabled={plan.status === 'loading'}><Sparkles size={15} /> {label}<span className="plus-badge">Plus</span></button>
      {explain && <div className="ai-explain"><p>{benefit} It’s part of Kinly Plus, which includes {PLUS_MONTHLY_CREDITS} AI credits a month.</p><div className="ai-explain-actions"><Link to="/pricing" className="card-link">Explore Kinly Plus <ArrowUpRight size={14} /></Link>{plan.status === 'local' && <Link to="/signin?next=/app" className="card-link">Sign in</Link>}</div></div>}
    </div>;
  }

  if (!aiEnabled) return <div className="ai-panel"><button className="deeper-invite" onClick={onEnableAi}><Sparkles size={14} /> {label}: turn on AI features in Settings first</button></div>;

  if (credits && credits.remaining < cost) {
    return <div className="ai-panel"><button className="deeper-button" disabled><Sparkles size={15} /> {label} · {costText}</button><p className="ai-caption">You’ve used {credits.used} of {credits.allowance} AI credits this month{credits.remaining > 0 ? ` (${plural(credits.remaining, 'credit')} left; this needs ${cost})` : ''}.{credits.resets_at ? ` They reset on ${fmtLongDate(credits.resets_at)}.` : ''} Everything else in Kinly keeps working as usual.</p></div>;
  }

  const run = async () => {
    setState({ status: 'loading' });
    const result = await runAi(feature, buildContext());
    if (result.ok && result.credits) plan.setCredits(result.credits);
    if (!result.ok && (result.code === 'no_credits' || result.code === 'plus_required')) void plan.refresh();
    setState(result);
  };
  const loading = 'status' in state && state.status === 'loading';
  const failed = 'ok' in state && !state.ok ? state : null;
  return <div className="ai-panel deeper-request"><button className="deeper-button" onClick={run} disabled={loading}><Sparkles size={15} /> {loading ? 'Thinking it through…' : `${label} · ${costText}`}</button><span className={failed ? 'deeper-error' : ''} role={failed ? 'alert' : undefined}>{failed ? failed.error : `Sends ${sends} to Claude AI. Uses ${costText} only if it works${credits ? ` · ${plural(credits.remaining, 'credit')} left` : ''}.`}</span></div>;
}
