export const ACTIVE_MEMBER_ID_KEY = "activeMemberId";
export const ACTIVE_MEMBER_NAME_KEY = "activeMemberName";
export const INCLUDED_MEMBER_IDS_KEY = "includedMemberIds";

export function loadIncludedMemberIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      localStorage.getItem(INCLUDED_MEMBER_IDS_KEY) ?? "null",
    ) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map(Number).filter((id) => Number.isFinite(id) && id > 0);
    }
  } catch {
    // ignore invalid JSON
  }
  return [];
}

export function saveIncludedMemberIds(ids: number[]): void {
  if (ids.length > 0) {
    localStorage.setItem(INCLUDED_MEMBER_IDS_KEY, JSON.stringify(ids));
  }
}

export function loadActiveMemberId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(ACTIVE_MEMBER_ID_KEY);
  const id = raw ? parseInt(raw, 10) : 0;
  return id > 0 ? id : null;
}

export function saveActiveMemberId(id: number): void {
  localStorage.setItem(ACTIVE_MEMBER_ID_KEY, String(id));
}

export function saveActiveMemberName(name: string): void {
  localStorage.setItem(ACTIVE_MEMBER_NAME_KEY, name);
}

export function loadActiveMemberName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_MEMBER_NAME_KEY);
}

export function clearMemberStorage(): void {
  localStorage.removeItem(ACTIVE_MEMBER_ID_KEY);
  localStorage.removeItem(ACTIVE_MEMBER_NAME_KEY);
  localStorage.removeItem(INCLUDED_MEMBER_IDS_KEY);
}
