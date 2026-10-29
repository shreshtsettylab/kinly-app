import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { Link } from '../Link';
import { displayName, useAuth } from './authState';

// Settings card inside the app: shows who is signed in and offers sign in / out.
// It is honest that app data stays in this browser either way.
export function AccountCard() {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  if (auth.status === 'unconfigured') return null;
  const signedIn = auth.status === 'signedIn';
  return <section className="content-card settings-ai settings-account">
    <div className="reflection-icon"><UserRound size={19} /></div>
    <div className="settings-ai-copy">
      <span className="card-kicker">ACCOUNT</span>
      <h2>{signedIn ? displayName(auth.user) : 'Not signed in'}</h2>
      <p>{signedIn ? `Signed in as ${auth.user?.email ?? 'your account'}. ` : 'An account is optional. '}Your people, plans, goals and reflections live in this browser. Signing in doesn’t upload anything — use “Back up my data” below if you want a private copy in your account.</p>
    </div>
    {auth.status === 'loading' ? null : signedIn
      ? <div className="settings-account-actions"><Link to="/account" className="quiet-button">Account</Link><button className="quiet-button" disabled={busy} onClick={async () => { setBusy(true); await auth.signOut(); setBusy(false); }}>{busy ? 'Signing out…' : 'Sign out'}</button></div>
      : <Link to="/signin?next=/app" className="primary-button">Sign in</Link>}
  </section>;
}
