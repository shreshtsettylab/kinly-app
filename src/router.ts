import { useEffect, useState } from 'react';

// A deliberately tiny router: a handful of top-level screens is all Kinly needs, so there is
// no dependency. Vercel serves index.html for these paths (see vercel.json).
export type Route = 'landing' | 'app' | 'signin' | 'callback' | 'reset' | 'account' | 'checkout' | 'terms' | 'privacy' | 'refunds' | 'contact' | 'notfound';

const routes: [string, Route][] = [
  ['/app', 'app'],
  ['/signin', 'signin'],
  ['/auth/callback', 'callback'],
  ['/reset-password', 'reset'],
  ['/account', 'account'],
  ['/checkout/complete', 'checkout'],
  ['/terms', 'terms'],
  ['/privacy', 'privacy'],
  ['/refunds', 'refunds'],
  ['/contact', 'contact'],
];

export function routeFromPath(path: string): Route {
  const match = routes.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  if (match) return match[1];
  return path === '/' || path === '' || path === '/index.html' ? 'landing' : 'notfound';
}

export function navigateTo(path: string, { replace = false } = {}) {
  if (path === window.location.pathname + window.location.search) return;
  if (replace) window.history.replaceState({}, '', path);
  else window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0 });
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => routeFromPath(window.location.pathname));
  useEffect(() => {
    const onChange = () => setRoute(routeFromPath(window.location.pathname));
    window.addEventListener('popstate', onChange);
    return () => window.removeEventListener('popstate', onChange);
  }, []);
  return route;
}
