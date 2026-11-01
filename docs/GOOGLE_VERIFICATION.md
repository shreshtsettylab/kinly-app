# Google verification for Calendar import — submission kit

Kinly asks for one sensitive Google permission: **`https://www.googleapis.com/auth/calendar.events.readonly`**
(read-only access to calendar events). Until Google verifies it, people see a "Google hasn't
verified this app" screen and only 100 people can connect. Verification is free and usually takes
a few weeks.

**Where:** Google Cloud console → project **Kinly** (`kinly-513106`, signed in as
shreshtsetty@gmail.com) → **Google Auth Platform → Verification Center → Prepare for verification**.

---

## Before you submit (checklist)

- [ ] The updated privacy policy is **live** at https://www.kinly.in/privacy. It must have the
      "Google Calendar (optional)" section and the Limited Use sentence. Push first.
- [ ] **Branding** page: app name "Kinly", support email, home page `https://www.kinly.in`,
      privacy `https://www.kinly.in/privacy`, terms `https://www.kinly.in/terms` (done 31 Oct 2026).
- [ ] **Authorized domains** include `kinly.in` (done).
- [ ] `kinly.in` is verified in **Google Search Console** under shreshtsetty@gmail.com (done).
      Google checks that the person submitting owns the domain.
- [ ] **Data Access** lists only `calendar.events.readonly` as a sensitive scope (done).
- [ ] Demo video recorded and uploaded to YouTube as **Unlisted** (see the script below).
- [ ] Optional: leave the logo empty. Adding a logo triggers a separate brand review.

---

## 1. Scope justification (paste into "How will the scopes be used?")

> Kinly (https://www.kinly.in) is a personal planner for the relationships in someone's life. Users
> save the people who matter to them and the plans they make together, and Kinly helps them decide
> how to spend their time.
>
> We request calendar.events.readonly for one user-initiated feature: "Import from Google Calendar"
> on the Plans page. When the user clicks it, Kinly reads their events for the next 30 days and
> shows them as a list. The user ticks the events they want, and Kinly adds those as plans in the
> app, using each event's title, date, time and location. Attendee names are used only to suggest
> which saved person a plan is with, and are not stored.
>
> The request runs entirely in the user's browser using Google Identity Services (token model).
> Event data goes directly from Google to the browser and is never sent to or stored on our servers.
> The access token is kept in memory only and expires within an hour. We never create, modify or
> delete calendar data, so a read-only scope is the narrowest that supports the feature. We do not
> sell Google user data, use it for advertising, or use it to train AI models. Kinly's use of data
> from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use
> requirements.

**If asked why a narrower scope won't work:** `calendar.events.readonly` is already Google's
narrowest scope for reading event details (title, time, location). The free/busy-only scopes don't
include titles, which users need in order to recognise and choose events.

---

## 2. Demo video script (2–3 minutes; screen recording with voice or captions)

Record in Chrome on **https://www.kinly.in** (not localhost), signed in to a Google account you can
show on screen. Use a calendar with harmless sample events, such as "Coffee with Alex".

1. **(0:00) The app and its domain.** Show the address bar with `https://www.kinly.in`, then the
   home page. Say: "This is Kinly, a personal planner for the people in your life."
2. **(0:15) The privacy policy.** Click **Privacy policy** in the footer and scroll to
   **"Google Calendar (optional)"**. Pause on the Limited Use sentence.
3. **(0:35) Find the feature.** Open the app (`/app`) → **Plans** → click **Import from Google
   Calendar**. Read out the note: read-only, straight to the browser, nothing sent to Kinly.
4. **(0:55) The consent screen — the most important part.** Click **Connect Google Calendar**. In
   Google's window, choose the account. **Show the consent screen clearly**: the app name "Kinly"
   and the permission "View events on all your calendars". Click **Continue / Allow**.
   (Until verification, Google first shows "Google hasn't verified this app". That's expected:
   click Advanced → Go to Kinly.)
5. **(1:25) How the data is used.** Show the list of next-30-day events. Tick one or two, and show
   the "Who is this with?" choice. Click **Add plans**.
6. **(1:50) The result.** Show the new plans on the Plans page. Say: "Only the events the user
   chose are saved, as plans in their browser. Kinly can't change the calendar."
7. **(2:10) Revoking access.** Optional but helpful: open https://myaccount.google.com/permissions
   and show Kinly listed with the option to remove access.

**Upload:** YouTube → Create → Upload video → Visibility: **Unlisted** → copy the link into the
verification form.

---

## 3. Answers to other questions Google often asks

- **Is the scope used on a server?** No. All calls are made from the browser; no Google data
  reaches Kinly's servers.
- **Where is the data stored?** Only in the user's own browser (localStorage), as plans the user
  chose to create. Users can export or delete everything from Settings.
- **Do you share the data?** No. If the user later asks a Kinly Plus AI feature about a plan, that
  plan's text is sent to our AI provider (Cloudflare Workers AI, which doesn't train on it). This
  only happens when the user explicitly asks, and it's disclosed in the privacy policy.
- **Security assessment?** Not needed. `calendar.events.readonly` is a *sensitive* scope, not a
  *restricted* one, so no CASA security review applies.
- **Contact for Google:** shreshtsetty@gmail.com (developer contact on the Branding page).

---

## After submitting

Google replies by email to the developer contact, sometimes asking for small changes (a clearer
video, a wording fix in the privacy policy). Reply in the same thread. Once approved, the
"unverified app" screen disappears and the 100-user cap is lifted. Nothing in the code changes.
