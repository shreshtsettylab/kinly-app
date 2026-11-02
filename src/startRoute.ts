import { routeFromPath } from './router';

// Signed-in people expect kinly.in to open their space; everyone else sees the home page that
// explains Kinly. On the first visit to "/" in a tab, signed-in people go to /app. Links that ask
// for the home page ("/?home", or a "#section" anchor) always show it, and later visits in the tab
// are left alone.
export function openAppForReturningUsers() {
  const { pathname, search, hash } = window.location;
  if (routeFromPath(pathname) !== 'landing' || hash || new URLSearchParams(search).has('home')) return;
  try {
    if (window.sessionStorage.getItem('kinly-home-checked')) return;
    window.sessionStorage.setItem('kinly-home-checked', '1');
  } catch {
    return;
  }
  if (hasSignedInSession()) window.history.replaceState({}, '', '/app');
}

// Supabase keeps the session in this browser under "sb-<project>-auth-token". This runs before the
// app starts, so it only checks that a session is saved; a session that has expired for good still
// lands in the app, where the account menu offers to sign in again.
function hasSignedInSession(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) return false;
  try {
    const project = new URL(url).hostname.split('.')[0];
    const saved = JSON.parse(window.localStorage.getItem(`sb-${project}-auth-token`) ?? 'null') as { refresh_token?: string } | null;
    return !!saved?.refresh_token;
  } catch {
    return false;
  }
}
