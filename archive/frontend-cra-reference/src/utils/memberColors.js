export const MEMBER_COLORS = ['#0d9488', '#6366f1', '#f59e0b', '#ec4899', '#22c55e', '#ef4444', '#8b5cf6', '#06b6d4'];

export function memberColor(idx) {
  return MEMBER_COLORS[idx % MEMBER_COLORS.length];
}
