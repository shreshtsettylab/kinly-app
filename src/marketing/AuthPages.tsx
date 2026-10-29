import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, Check, Info } from 'lucide-react';
import { displayName, takeNext, useAuth } from '../auth/authState';
import { errorFromUrl, friendlyAuthError, friendlyUrlError } from '../auth/authErrors';
import { supabase } from '../auth/supabaseClient';
import { Link } from '../Link';
import { navigateTo } from '../router';
import { MarketingFooter, MarketingNav } from './parts';
import { hasSavedData } from './savedData';

function AuthShell({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  const [returning] = useState(hasSavedData);
  return <div className="lp lp-auth-page">
    <MarketingNav returning={returning} onLanding={false} />
    <main className="lp-auth lp-auth-single">
      <div className="lp-auth-card">
        <span className="lp-tag">{kicker}</span>
        <h1 className="lp-auth-title">{title}</h1>
        {children}
      </div>
    </main>
    <MarketingFooter />
  </div>;
}

function Waiting({ text }: { text: string }) {
  return <p className="lp-auth-waiting" role="status"><span className="lp-spinner" aria-hidden="true" />{text}</p>;
}

function NotConfigured() {
  return <div className="lp-auth-notice" role="note"><Info size={16} /><div><b>Accounts aren’t available yet.</b> Kinly works fully without an account — your data stays in this browser.</div></div>;
}

// Google and email links return here. Supabase exchanges the one-time ?code= for a session
// on load; we wait for that, then move on — or explain what went wrong.
export function AuthCallback() {
  const auth = useAuth();
  const [urlError] = useState(errorFromUrl);
  useEffect(() => {
    if (urlError || auth.status !== 'signedIn') return;
    navigateTo(takeNext(), { replace: true });
  }, [auth.status, urlError]);

  if (auth.status === 'unconfigured') return <AuthShell kicker="Sign in" title="Accounts aren’t available yet."><NotConfigured /><Link to="/app" className="lp-button lp-button-primary">Open Kinly <ArrowRight size={15} /></Link></AuthShell>;
  if (urlError || auth.status === 'signedOut') {
    const message = urlError ? friendlyUrlError(urlError) : 'This sign-in link has expired, was already used, or was opened in a different browser from the one you started in.';
    return <AuthShell kicker="Sign in" title="That didn’t quite work.">
      <p className="lp-auth-lead" role="alert">{message}</p>
      <div className="lp-auth-done-actions"><Link to="/signin" className="lp-button lp-button-primary">Back to sign in</Link><Link to="/app" className="lp-button lp-button-quiet">Continue without an account</Link></div>
    </AuthShell>;
  }
  return <AuthShell kicker="Sign in" title="Signing you in…"><Waiting text="Finishing sign-in. This only takes a moment." /></AuthShell>;
}

// Reached from the password-reset email (which signs the person in for this purpose), or by a
// signed-in person who wants to change their password.
export function ResetPassword() {
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [urlError] = useState(errorFromUrl);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (password.length < 8) nextErrors.password = 'Use at least 8 characters.';
    if (confirm !== password) nextErrors.confirm = 'The passwords don’t match.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !supabase) return;
    setBusy(true);
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) { setError(friendlyAuthError(updateError)); return; }
    setPassword('');
    setConfirm('');
    setDone(true);
  };

  if (auth.status === 'unconfigured') return <AuthShell kicker="Password" title="Accounts aren’t available yet."><NotConfigured /></AuthShell>;
  if (auth.status === 'loading') return <AuthShell kicker="Password" title="Checking your link…"><Waiting text="One moment." /></AuthShell>;
  if (done) return <AuthShell kicker="Password" title="Password updated.">
    <p className="lp-auth-lead lp-auth-ok-line"><Check size={16} /> You can use your new password next time you sign in.</p>
    <Link to="/app" className="lp-button lp-button-primary">Continue to Kinly <ArrowRight size={15} /></Link>
  </AuthShell>;
  if (urlError || auth.status !== 'signedIn') return <AuthShell kicker="Password" title="This reset link can’t be used.">
    <p className="lp-auth-lead" role="alert">{urlError ? friendlyUrlError(urlError) : 'It may have expired, been used already, or been opened in a different browser from the one where you asked for it.'}</p>
    <Link to="/signin?mode=forgot" className="lp-button lp-button-primary">Request a new link</Link>
  </AuthShell>;
  return <AuthShell kicker="Password" title="Choose a new password.">
    <p className="lp-auth-lead">For {displayName(auth.user)}.</p>
    <form className="lp-auth-form" onSubmit={submit} noValidate>
      <label>New password<input type="password" autoComplete="new-password" value={password} onChange={(event) => { setPassword(event.target.value); setErrors({ ...errors, password: undefined }); }} aria-invalid={!!errors.password} aria-describedby={errors.password ? 'new-password-error' : undefined} />{errors.password && <span className="lp-field-error" id="new-password-error">{errors.password}</span>}</label>
      <label>Confirm new password<input type="password" autoComplete="new-password" value={confirm} onChange={(event) => { setConfirm(event.target.value); setErrors({ ...errors, confirm: undefined }); }} aria-invalid={!!errors.confirm} aria-describedby={errors.confirm ? 'confirm-password-error' : undefined} />{errors.confirm && <span className="lp-field-error" id="confirm-password-error">{errors.confirm}</span>}</label>
      {error && <div className="lp-auth-error" role="alert">{error}</div>}
      <button type="submit" className="lp-button lp-button-primary lp-button-block" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
    </form>
  </AuthShell>;
}

// Account details are genuinely private, so this page needs a signed-in session. The Kinly app
// itself stays open without an account because its data lives only in this browser.
export function Account() {
  const auth = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    if (auth.status === 'signedOut' && !signingOut) navigateTo('/signin?next=/account', { replace: true });
  }, [auth.status, signingOut]);

  if (auth.status === 'unconfigured') return <AuthShell kicker="Account" title="Accounts aren’t available yet."><NotConfigured /><Link to="/app" className="lp-button lp-button-primary">Open Kinly <ArrowRight size={15} /></Link></AuthShell>;
  if (auth.status !== 'signedIn' || !auth.user) return <AuthShell kicker="Account" title="Checking your session…"><Waiting text="One moment." /></AuthShell>;
  const user = auth.user;
  const providers = ((user.app_metadata?.providers as string[] | undefined) ?? [user.app_metadata?.provider as string | undefined]).filter(Boolean).map((provider) => (provider === 'google' ? 'Google' : provider === 'email' ? 'Email and password' : provider)).join(', ');
  const signOut = async () => { setSigningOut(true); await auth.signOut(); navigateTo('/', { replace: true }); };
  return <AuthShell kicker="Account" title={`Hi, ${displayName(user).split(' ')[0]}.`}>
    <dl className="lp-account">
      <div><dt>Email</dt><dd>{user.email ?? '—'}</dd></div>
      <div><dt>Signed in with</dt><dd>{providers || '—'}</dd></div>
      <div><dt>Member since</dt><dd>{new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</dd></div>
    </dl>
    <div className="lp-auth-notice" role="note"><Info size={16} /><div><b>Your Kinly data lives in this browser.</b> Nothing is uploaded automatically. To keep a private copy in your account, use <b>Settings → Back up my data</b> in the app. Automatic syncing across devices will come later.</div></div>
    <div className="lp-auth-done-actions">
      <Link to="/app" className="lp-button lp-button-primary">Open Kinly <ArrowRight size={15} /></Link>
      {user.app_metadata?.providers && (user.app_metadata.providers as string[]).includes('email') && <Link to="/reset-password" className="lp-button lp-button-quiet">Change password</Link>}
      <button className="lp-button lp-button-quiet" onClick={signOut} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
    </div>
  </AuthShell>;
}
