import { routeFromPath } from './router';
import { hasSavedData } from './marketing/savedData';

// People who already use Kinly expect kinly.in to open their space, not the marketing page.
// On the first visit to "/" in a tab, send them to /app. Links that ask for the home page
// ("/?home", or a "#section" anchor) always show it, and later visits in the tab are left alone.
export function openAppForReturningUsers() {
  const { pathname, search, hash } = window.location;
  if (routeFromPath(pathname) !== 'landing' || hash || new URLSearchParams(search).has('home')) return;
  try {
    if (window.sessionStorage.getItem('kinly-home-checked')) return;
    window.sessionStorage.setItem('kinly-home-checked', '1');
  } catch {
    return;
  }
  if (hasSavedData()) window.history.replaceState({}, '', '/app');
}
