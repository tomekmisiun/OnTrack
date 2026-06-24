import type { Member } from "@/types/member";

/** Members included in write operations (calendar etc.). */
export function getTargetMemberIds(
  includedMemberIds: number[],
  fallbackId: number | null,
): number[] {
  if (includedMemberIds.length > 0) return includedMemberIds;
  return fallbackId ? [fallbackId] : [];
}

/**
 * One included → that member; multiple → primary for macro/schedule/calendar view.
 */
export function getViewMemberId(
  includedMemberIds: number[],
  members: Member[],
  fallbackId: number | null,
): number | null {
  if (includedMemberIds.length === 1) return includedMemberIds[0] ?? null;
  if (includedMemberIds.length > 1) {
    return members.find((m) => m.is_primary)?.id ?? includedMemberIds[0] ?? null;
  }
  return fallbackId;
}
