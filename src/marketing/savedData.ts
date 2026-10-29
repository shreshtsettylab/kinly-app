// True when this browser already has Kinly data, so CTAs can say "Open Kinly" instead.
export function hasSavedData(): boolean {
  try {
    return window.localStorage.getItem('kinly-demo:people') !== null;
  } catch {
    return false;
  }
}
