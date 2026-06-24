import { describe, expect, it } from "vitest";
import { getTargetMemberIds, getViewMemberId } from "@/lib/members/targets";
import type { Member } from "@/types/member";

const members: Member[] = [
  {
    id: 1,
    name: "Primary",
    is_primary: true,
    gender: null,
    age: null,
    weight: null,
    height: null,
    activity: null,
    goal: null,
    macro_goals: null,
  },
  {
    id: 2,
    name: "Other",
    is_primary: false,
    gender: null,
    age: null,
    weight: null,
    height: null,
    activity: null,
    goal: null,
    macro_goals: null,
  },
];

describe("member targets", () => {
  it("resolves target member ids", () => {
    expect(getTargetMemberIds([2], 1)).toEqual([2]);
    expect(getTargetMemberIds([], 1)).toEqual([1]);
    expect(getTargetMemberIds([], null)).toEqual([]);
  });

  it("resolves view member id", () => {
    expect(getViewMemberId([2], members, 1)).toBe(2);
    expect(getViewMemberId([1, 2], members, 1)).toBe(1);
    expect(getViewMemberId([], members, 2)).toBe(2);
  });
});
