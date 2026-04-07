/** Persists “first launch” onboarding completion in localStorage (web + Tauri). */
export const FIRST_LAUNCH_ONBOARDING_KEY = "athena.firstLaunchOnboarding.v1";

export function hasCompletedFirstLaunchOnboarding(): boolean {
  try {
    return localStorage.getItem(FIRST_LAUNCH_ONBOARDING_KEY) === "1";
  } catch {
    return true;
  }
}

export function completeFirstLaunchOnboarding(): void {
  try {
    localStorage.setItem(FIRST_LAUNCH_ONBOARDING_KEY, "1");
  } catch {
    /* ignore quota / private mode */
  }
}
