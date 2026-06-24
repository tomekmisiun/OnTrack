export const MEMBER_COLORS = [
  "#0d9488",
  "#6366f1",
  "#f59e0b",
  "#ec4899",
  "#22c55e",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
] as const;

export function memberColor(index: number): string {
  return MEMBER_COLORS[index % MEMBER_COLORS.length] ?? MEMBER_COLORS[0];
}
