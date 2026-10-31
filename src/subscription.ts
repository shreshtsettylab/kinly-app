import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './auth/authState';
import { supabase } from './auth/supabaseClient';

// Kinly's two plans. What someone is entitled to always comes from the database (subscriptions
// and the ai_credit_status function); nothing here, in React state or in localStorage decides it.

export const FREE_LIMITS = { people: 5, plans: 5, goals: 3 } as const;
export type LimitKind = keyof typeof FREE_LIMITS;
// Questions answered from saved notes (the instant answers). Counted per calendar month.
export const FREE_QUESTIONS_PER_MONTH = 15;
export type NoticeKind = LimitKind | 'questions';
export const PLUS_PRICES = { month: '₹99', year: '₹999' } as const;
export const PLUS_MONTHLY_CREDITS = 20;

export type AiFeature = 'reflection' | 'conversation_prep' | 'decision_analysis' | 'relationship_analysis' | 'weekly_review';
export const AI_FEATURES: Record<AiFeature, { label: string; cost: number }> = {
  reflection: { label: 'AI reflection', cost: 1 },
  conversation_prep: { label: 'Conversation preparation', cost: 1 },
  decision_analysis: { label: 'Advanced decision analysis', cost: 2 },
  relationship_analysis: { label: 'Detailed relationship analysis', cost: 2 },
  weekly_review: { label: 'Weekly relationship review', cost: 2 },
};

export type Subscription = {
  plan: 'free' | 'plus';
  status: 'active' | 'trial' | 'pending' | 'cancelled' | 'expired';
  billing_interval: 'month' | 'year' | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};
export type CreditStatus = { ai_access: boolean; allowance: number; used: number; remaining: number; resets_at: string | null };
export type UsageItem = { id: string; feature: AiFeature; credits_used: number; request_status: 'pending' | 'succeeded' | 'failed'; created_at: string };

export type PlanState = {
  // 'local' = not signed in (Free, nothing to look up); 'unavailable' = signed in but the plan couldn't be read.
  status: 'local' | 'loading' | 'ready' | 'unavailable';
  subscription: Subscription | null;
  credits: CreditStatus | null;
  usage: UsageItem[];
  isPlus: boolean;
  refresh: () => Promise<void>;
  setCredits: (credits: CreditStatus) => void;
};

export function usePlan({ withUsage = false } = {}): PlanState {
  const { status: authStatus, user } = useAuth();
  const [status, setStatus] = useState<PlanState['status']>('loading');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [credits, setCredits] = useState<CreditStatus | null>(null);
  const [usage, setUsage] = useState<UsageItem[]>([]);

  const refresh = useCallback(async () => {
    if (!supabase || !user) return;
    const [sub, creditStatus, history] = await Promise.all([
      supabase.from('subscriptions').select('plan, status, billing_interval, current_period_start, current_period_end, cancel_at_period_end').maybeSingle(),
      supabase.rpc('ai_credit_status'),
      withUsage ? supabase.from('ai_usage').select('id, feature, credits_used, request_status, created_at').order('created_at', { ascending: false }).limit(20) : Promise.resolve({ data: [], error: null }),
    ]);
    if (sub.error || creditStatus.error) { setStatus('unavailable'); return; }
    // Accounts created before plans existed have no row yet; they are on Free.
    setSubscription((sub.data as Subscription | null) ?? { plan: 'free', status: 'active', billing_interval: null, current_period_start: null, current_period_end: null, cancel_at_period_end: false });
    setCredits(creditStatus.data as CreditStatus);
    setUsage((history.data as UsageItem[] | null) ?? []);
    setStatus('ready');
  }, [user, withUsage]);

  useEffect(() => {
    if (authStatus === 'loading') { setStatus('loading'); return; }
    if (authStatus !== 'signedIn') { setStatus('local'); setSubscription(null); setCredits(null); setUsage([]); return; }
    setStatus('loading');
    void refresh();
  }, [authStatus, refresh]);

  const isPlus = status === 'ready' && subscription?.plan === 'plus' && (subscription.status === 'active' || subscription.status === 'trial');
  return { status, subscription, credits, usage, isPlus, refresh, setCredits };
}

export const fmtLongDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

export type AiResult =
  | { ok: true; answer: { verdict: 'go' | 'hold' | 'maybe' | 'info'; headline: string; reason: string; points: string[] }; cost: number; credits: CreditStatus | null }
  | { ok: false; code?: 'plus_required' | 'no_credits' | 'signed_out'; error: string; resets_at?: string | null };

// Runs one metered AI feature. The server checks the plan and credits; this only passes them on.
export async function runAi(feature: AiFeature, context: Record<string, unknown>): Promise<AiResult> {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  if (!session) return { ok: false, code: 'signed_out', error: 'Sign in to use Kinly Plus AI features.' };
  try {
    const response = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ feature, context }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.answer) return { ok: false, code: data.code, error: data.error || 'AI features are not available right now. No credits were used.', resets_at: data.resets_at };
    return { ok: true, answer: data.answer, cost: data.cost, credits: data.credits ?? null };
  } catch {
    return { ok: false, error: 'Kinly couldn’t reach the server. No credits were used.' };
  }
}
