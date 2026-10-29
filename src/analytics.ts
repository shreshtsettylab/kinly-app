// Microsoft Clarity: anonymous usage analytics (heatmaps, session recordings) for the live site.
// It only loads in production builds when VITE_CLARITY_PROJECT_ID is set. Personal content is
// masked: the app shell and account screens carry data-clarity-mask, so recordings show layout
// and clicks but never people's names, notes or reflections.
const projectId = (import.meta.env.VITE_CLARITY_PROJECT_ID as string | undefined)?.trim();

export const analyticsEnabled = import.meta.env.PROD && !!projectId && /^[a-z0-9]{6,20}$/i.test(projectId);

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };

export function loadAnalytics() {
  if (!analyticsEnabled || !projectId) return;
  const w = window as unknown as { clarity?: ClarityFn };
  // Microsoft's standard loader: queue calls until the tag arrives, then load it asynchronously.
  w.clarity = w.clarity || Object.assign((...args: unknown[]) => { (w.clarity!.q = w.clarity!.q || []).push(args); }, {});
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${encodeURIComponent(projectId)}`;
  document.head.appendChild(script);
}
