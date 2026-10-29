import { useState, type FormEvent } from 'react';
import { ArrowRight, Info } from 'lucide-react';
import { Link } from '../Link';
import { MarketingFooter, MarketingNav } from './parts';
import { hasSavedData } from './savedData';

type Mode = 'signin' | 'signup';

// Accounts are not switched on: Kinly has no Supabase client or credentials yet. This page
// shows the intended experience but never sends or stores what is typed.
const authConfigured = false;

export default function SignIn() {
  const [mode, setMode] = useState<Mode>('signin');
  const [attempted, setAttempted] = useState(false);
  const [returning] = useState(hasSavedData);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.currentTarget.reset();
    setAttempted(true);
  };
  const switchMode = (next: Mode) => { setMode(next); setAttempted(false); };
  return <div className="lp lp-auth-page">
    <MarketingNav returning={returning} onLanding={false} />
    <main className="lp-auth">
      <div className="lp-auth-side">
        <span className="lp-tag">Your account</span>
        <h1>{mode === 'signin' ? 'Welcome back.' : 'Make Kinly yours.'} <span className="lp-muted">Calmly.</span></h1>
        <p>Accounts will let you keep Kinly in sync across devices. Until then, everything you add stays in this browser — no account needed.</p>
      </div>
      <div className="lp-auth-card">
        <div className="lp-auth-tabs" role="tablist" aria-label="Account">
          <button role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'is-active' : ''} onClick={() => switchMode('signin')}>Sign in</button>
          <button role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'is-active' : ''} onClick={() => switchMode('signup')}>Create account</button>
        </div>
        {!authConfigured && <div className="lp-auth-notice" role="note"><Info size={16} /><div><b>Accounts aren’t available yet.</b> Nothing you type here is sent or saved. You can use Kinly fully without an account.</div></div>}
        <form className="lp-auth-form" onSubmit={submit}>
          {mode === 'signup' && <label>Name<input name="name" autoComplete="name" placeholder="Alex Morgan" /></label>}
          <label>Email<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
          <label>Password<input name="password" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required /></label>
          <button type="submit" className="lp-button lp-button-primary lp-button-block">{mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        </form>
        {attempted && <div className="lp-auth-result" role="status"><b>{mode === 'signin' ? 'Sign-in isn’t switched on yet.' : 'Account creation isn’t switched on yet.'}</b><p>Nothing was sent or saved, and the form has been cleared. Kinly works today without an account — your data stays in this browser.</p></div>}
        <Link to="/app" className="lp-auth-continue">Continue without an account <ArrowRight size={15} /></Link>
        {import.meta.env.DEV && !authConfigured && <details className="lp-auth-dev"><summary>Developer note: activating accounts</summary><ul>
          <li>Create a Supabase project and enable email sign-in.</li>
          <li>Add <code>@supabase/supabase-js</code> and set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (the public anon key only — never the service key).</li>
          <li>Replace the open demo policies in <code>supabase/migrations</code> with per-user rules before storing any data.</li>
          <li>Agree a plan for moving existing browser data into accounts before shipping.</li>
        </ul><p>This note only appears while running locally.</p></details>}
      </div>
    </main>
    <MarketingFooter />
  </div>;
}
