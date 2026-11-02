import { deviceHasKinlyData } from '../lib/storage';

// True when this browser already has Kinly data, so CTAs can say "Open Kinly" instead.
export function hasSavedData(): boolean {
  return deviceHasKinlyData();
}
