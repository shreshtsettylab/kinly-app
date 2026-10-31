// Google Calendar import. Read-only and one-way: Google sends the person's upcoming events
// straight to this browser, and they choose which ones become Kinly plans. Nothing goes through
// Kinly's servers, and the access token lives only in memory for this visit.

// The OAuth client id is a public identifier (it's visible in every Google sign-in URL), not a secret.
const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || '';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';

export const calendarAvailable = CLIENT_ID.endsWith('.apps.googleusercontent.com');

export type CalendarEvent = { id: string; title: string; date: string; time: string; allDay: boolean; location: string; attendees: string[] };

type TokenResponse = { access_token?: string; error?: string; error_description?: string };
type TokenClient = { requestAccessToken: (options?: { prompt?: string }) => void };
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: { initTokenClient: (config: { client_id: string; scope: string; callback: (response: TokenResponse) => void; error_callback?: (error: { type?: string }) => void }) => TokenClient } } };
  }
}

let scriptLoading: Promise<void> | null = null;
function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  scriptLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { scriptLoading = null; script.remove(); reject(new Error('Google couldn’t load. Check your connection and try again.')); };
    document.head.appendChild(script);
  });
  return scriptLoading;
}

let token: { value: string; expires: number } | null = null;

// Opens Google's consent window (or reuses this visit's access) and resolves with a token.
async function accessToken(): Promise<string> {
  if (token && token.expires > Date.now()) return token.value;
  await loadGoogleScript();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error('Google couldn’t load. Try again.');
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (response) => {
        if (!response.access_token) { reject(new Error(response.error === 'access_denied' ? 'Calendar access wasn’t allowed, so nothing was imported.' : 'Google didn’t share your calendar. Try again.')); return; }
        token = { value: response.access_token, expires: Date.now() + 50 * 60 * 1000 };
        resolve(response.access_token);
      },
      error_callback: (error) => reject(new Error(error.type === 'popup_closed' ? 'The Google window was closed, so nothing was imported.' : 'Google couldn’t open its sign-in window. Allow pop-ups for kinly.in and try again.')),
    });
    client.requestAccessToken();
  });
}

const pad = (value: number) => String(value).padStart(2, '0');
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

type GoogleEvent = { id: string; status?: string; summary?: string; location?: string; start?: { date?: string; dateTime?: string }; attendees?: { email?: string; displayName?: string; self?: boolean }[] };

// The next `days` days of events from the person's main calendar, soonest first.
export async function upcomingEvents(days = 30): Promise<CalendarEvent[]> {
  const value = await accessToken();
  const now = new Date();
  const until = new Date(now.getTime() + days * 86400000);
  const params = new URLSearchParams({ timeMin: now.toISOString(), timeMax: until.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '100' });
  let response: Response;
  try {
    response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, { headers: { authorization: `Bearer ${value}` } });
  } catch {
    throw new Error('Kinly couldn’t reach Google Calendar. Check your connection and try again.');
  }
  if (response.status === 401) { token = null; throw new Error('Your Google access expired. Try again.'); }
  if (!response.ok) throw new Error('Google Calendar didn’t respond. Try again shortly.');
  const data = await response.json() as { items?: GoogleEvent[] };
  return (data.items ?? [])
    .filter((event) => event.status !== 'cancelled' && (event.start?.dateTime || event.start?.date))
    .map((event) => {
      const allDay = !event.start?.dateTime;
      const start = event.start?.dateTime ? new Date(event.start.dateTime) : null;
      return {
        id: event.id,
        title: (event.summary || 'Untitled event').slice(0, 200),
        date: start ? dateKey(start) : (event.start?.date ?? ''),
        time: start ? `${pad(start.getHours())}:${pad(start.getMinutes())}` : '09:00',
        allDay,
        location: (event.location ?? '').slice(0, 200),
        attendees: (event.attendees ?? []).filter((attendee) => !attendee.self).map((attendee) => attendee.displayName || attendee.email || '').filter(Boolean),
      };
    });
}

// Forgets this visit's Google access.
export function forgetCalendarAccess() {
  token = null;
}
