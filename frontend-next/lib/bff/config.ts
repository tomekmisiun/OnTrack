/**
 * Opt-in BFF mode. Default off — JWT stays in localStorage (tasks 1–15 behavior).
 */
export function isBffEnabled(): boolean {
  return process.env.NEXT_PUBLIC_BFF_ENABLED === "1";
}
