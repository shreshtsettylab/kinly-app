import { useEffect, useState } from 'react';

// A deliberately tiny router: three top-level screens are all Kinly needs, so there is
// no dependency. Vercel serves index.html for /app and /signin (see vercel.json).
export type Route = 'landing' | 'app' | 'signin';

export function routeFromPath(path: string): Route {
  if (path === '/app' || path.startsWith('/app/')) return 'app';
  if (path === '/signin' || path.startsWith('/signin/')) return 'signin';
  return 'landing';
}

export function navigateTo(path: string) {
  if (path === window.location.pathname) return;
  window.history.pushState({}, '', path);
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
