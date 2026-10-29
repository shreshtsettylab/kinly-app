import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Info, MailCheck } from 'lucide-react';
import { authUrl, displayName, rememberNext, safeNext, useAuth } from '../auth/authState';
import { errorCode, friendlyAuthError } from '../auth/authErrors';
import { supabase } from '../auth/supabaseClient';
import { Link } from '../Link';
import { navigateTo } from '../router';
import { MarketingFooter, MarketingNav } from './parts';
import { hasSavedData } from './savedData';

type Mode = 'signin' | 'signup' | 'forgot' | 'check-email' | 'reset-sent';
type Busy = 'google' | 'email' | 'resend' | null;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function GoogleMark() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" /><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" /></svg>;
}

export default function SignIn() {
  const auth = useAuth();
  const params = new URLSearchParams(window.location.search);
  const next = safeNext(params.get('next'));
  const initialMode = params.get('mode');
  const [mode, setMode] = useState<Mode>(initialMode === 'signup' || initialMode === 'forgot' ? initialMode : 'signin');
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [notice, setNotice] = useState('');
  const [fields, setFields] = useState({ name: '', email: '', password: '', confirm: '' });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof typeof fields, string>>>({});
  const [returning] = useState(hasSavedData);
  const ready = auth.status !== 'unconfigured' && !!supabase;

  // Someone who signs in here, or arrives already signed in, goes on to where they were heading.
  useEffect(() => { if (auth.status === 'signedIn' && busy === 'email') navigateTo(next, { replace: true }); }, [auth.status, busy, next]);

  const switchMode = (nextMode: Mode) => { setMode(nextMode); setError(''); setNotice(''); setNeedsConfirmation(false); setFieldErrors({}); };
  const update = (key: keyof typeof fields, value: string) => { setFields({ ...fields, [key]: value }); setFieldErrors({ ...fieldErrors, [key]: undefined }); };

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {};
    if (!emailPattern.test(fields.email.trim())) errors.email = 'Enter a valid email address.';
    if (mode !== 'forgot') {
      if (!fields.password) errors.password = 'Enter your password.';
      else if (mode === 'signup' && fields.password.length < 8) errors.password = 'Use at least 8 characters.';
      if (mode === 'signup' && fields.confirm !== fields.password) errors.confirm = 'The passwords don’t match.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const withGoogle = async () => {
    if (!supabase) return;
    setError('');
    setBusy('google');
    rememberNext(next);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: authUrl('/auth/callback') } });
    // On success the browser has already left for Google; we only get here on failure.
    if (oauthError) { setError(friendlyAuthError(oauthError)); setBusy(null); }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !validate()) return;
    setError('');
    setNeedsConfirmation(false);
    setBusy('email');
    const email = fields.email.trim();
    if (mode === 'signin') {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: fields.password });
      if (signInError) {
        setNeedsConfirmation(errorCode(signInError) === 'email_not_confirmed');
        setError(friendlyAuthError(signInError));
        setBusy(null);
      }
      // Success: the auth state changes and the effect above moves on.
      return;
    }
    if (mode === 'signup') {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password: fields.password, options: { emailRedirectTo: authUrl('/auth/callback'), data: { full_name: fields.name.trim() || undefined } } });
      setBusy(null);
      if (signUpError) { setError(friendlyAuthError(signUpError)); return; }
      if (data.session) { navigateTo('/app', { replace: true }); return; }
      // With email confirmation on, Supabase hides whether an address is already registered by
      // returning a user with no identities instead of an error.
      if (data.user && data.user.identities?.length === 0) { setError('An account with this email may already exist. Try signing in, or reset your password.'); return; }
      setFields({ ...fields, password: '', confirm: '' });
      setMode('check-email');
      return;
    }
    // Forgot password: the same message whether or not the address has an account.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: authUrl('/reset-password') });
    setBusy(null);
    if (resetError && ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(errorCode(resetError) ?? '')) { setError(friendlyAuthError(resetError)); return; }
    setMode('reset-sent');
  };

  const resendConfirmation = async () => {
    if (!supabase || !emailPattern.test(fields.email.trim())) return;
    setBusy('resend');
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: fields.email.trim(), options: { emailRedirectTo: authUrl('/auth/callback') } });
    setBusy(null);
    if (resendError) setError(friendlyAuthError(resendError));
    else { setError(''); setNeedsConfirmation(false); setNotice('Confirmation email sent. Open the link in this browser.'); }
  };

  const heading = { signin: 'Welcome back.', signup: 'Make Kinly yours.', forgot: 'Reset your password.', 'check-email': 'Check your email.', 'reset-sent': 'Check your email.' }[mode];

  const body = () => {
    if (auth.status === 'signedIn' && busy === null) {
      return <div className="lp-auth-done"><b>You’re signed in as {displayName(auth.user)}.</b><div className="lp-auth-done-actions"><Link to={next} className="lp-button lp-button-primary">Continue to Kinly <ArrowRight size={15} /></Link><button className="lp-button lp-button-quiet" onClick={() => auth.signOut()}>Sign out</button></div></div>;
    }
    if (mode === 'check-email' || mode === 'reset-sent') {
      return <div className="lp-auth-done"><MailCheck size={22} className="lp-auth-done-icon" />
        <b>{mode === 'check-email' ? `We sent a confirmation link to ${fields.email.trim()}.` : `If an account exists for ${fields.email.trim()}, a reset link is on its way.`}</b>
        <p>Open the link in <strong>this browser</strong> to finish. It can take a minute — check your spam folder too.</p>
        {mode === 'check-email' && <button className="lp-text-link" onClick={resendConfirmation} disabled={busy === 'resend'}>{busy === 'resend' ? 'Sending…' : 'Send the link again'}</button>}
        {notice && <p className="lp-auth-ok" role="status">{notice}</p>}
        {error && <p className="lp-auth-error" role="alert">{error}</p>}
        <button className="lp-text-link" onClick={() => switchMode('signin')}>Back to sign in</button>
      </div>;
    }
    return <>
      {mode !== 'forgot' && <div className="lp-auth-tabs" role="tablist" aria-label="Account">
        <button role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'is-active' : ''} onClick={() => switchMode('signin')}>Sign in</button>
        <button role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'is-active' : ''} onClick={() => switchMode('signup')}>Create account</button>
      </div>}
      {!ready && <div className="lp-auth-notice" role="note"><Info size={16} /><div><b>{auth.configError ? 'Sign-in is misconfigured.' : 'Accounts aren’t available yet.'}</b> {auth.configError ?? 'Nothing you type here is sent or saved.'} You can use Kinly fully without an account.</div></div>}
      {mode !== 'forgot' && <>
        <button className="lp-google" onClick={withGoogle} disabled={!ready || busy !== null}><GoogleMark />{busy === 'google' ? 'Opening Google…' : 'Continue with Google'}</button>
        <div className="lp-auth-or"><span>or with email</span></div>
      </>}
      <form className="lp-auth-form" onSubmit={submit} noValidate>
        {mode === 'forgot' && <p className="lp-auth-hint">Enter the email you signed up with and we’ll send you a link to choose a new password.</p>}
        {mode === 'signup' && <label>Name<span className="lp-optional">Optional</span><input name="name" autoComplete="name" placeholder="Alex Morgan" value={fields.name} onChange={(event) => update('name', event.target.value)} /></label>}
        <label>Email<input name="email" type="email" autoComplete="email" placeholder="you@example.com" value={fields.email} onChange={(event) => update('email', event.target.value)} aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? 'email-error' : undefined} />{fieldErrors.email && <span className="lp-field-error" id="email-error">{fieldErrors.email}</span>}</label>
        {mode !== 'forgot' && <label><span className="lp-label-row">Password{mode === 'signin' && <button type="button" className="lp-text-link lp-forgot" onClick={() => switchMode('forgot')}>Forgot password?</button>}</span><input name="password" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={fields.password} onChange={(event) => update('password', event.target.value)} aria-invalid={!!fieldErrors.password} aria-describedby={fieldErrors.password ? 'password-error' : undefined} />{fieldErrors.password && <span className="lp-field-error" id="password-error">{fieldErrors.password}</span>}</label>}
        {mode === 'signup' && <label>Confirm password<input name="confirm" type="password" autoComplete="new-password" value={fields.confirm} onChange={(event) => update('confirm', event.target.value)} aria-invalid={!!fieldErrors.confirm} aria-describedby={fieldErrors.confirm ? 'confirm-error' : undefined} />{fieldErrors.confirm && <span className="lp-field-error" id="confirm-error">{fieldErrors.confirm}</span>}</label>}
        {error && <div className="lp-auth-error" role="alert">{error}{needsConfirmation && <button type="button" className="lp-text-link" onClick={resendConfirmation} disabled={busy === 'resend'}>{busy === 'resend' ? 'Sending…' : 'Resend confirmation email'}</button>}</div>}
        {notice && <p className="lp-auth-ok" role="status">{notice}</p>}
        <button type="submit" className="lp-button lp-button-primary lp-button-block" disabled={!ready || busy !== null}>{busy === 'email' ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}</button>
        {mode === 'forgot' && <button type="button" className="lp-text-link" onClick={() => switchMode('signin')}>Back to sign in</button>}
      </form>
    </>;
  };

  return <div className="lp lp-auth-page">
    <MarketingNav returning={returning} onLanding={false} />
    <main className="lp-auth">
      <div className="lp-auth-side">
        <span className="lp-tag">Your account</span>
        <h1>{heading} <span className="lp-muted">Calmly.</span></h1>
        <p>An account will let Kinly sync across devices in future. For now, your people, plans and reflections stay in this browser — signing in doesn’t move or upload them.</p>
      </div>
      <div className="lp-auth-card">
        {body()}
        <Link to="/app" className="lp-auth-continue">Continue without an account <ArrowRight size={15} /></Link>
        {import.meta.env.DEV && !ready && <details className="lp-auth-dev"><summary>Developer note: activating accounts</summary><p>Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in <code>.env.local</code>, then restart the dev server. Full steps, including Google, are in <code>docs/AUTH_SETUP.md</code>.</p><p>This note only appears while running locally.</p></details>}
      </div>
    </main>
    <MarketingFooter />
  </div>;
}
