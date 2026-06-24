import { strict as assert } from "node:assert";

function getTargetMemberIds(includedMemberIds, fallbackId) {
  if (includedMemberIds.length > 0) return includedMemberIds;
  return fallbackId ? [fallbackId] : [];
}

function getViewMemberId(includedMemberIds, members, fallbackId) {
  if (includedMemberIds.length === 1) return includedMemberIds[0] ?? null;
  if (includedMemberIds.length > 1) {
    return members.find((m) => m.is_primary)?.id ?? includedMemberIds[0] ?? null;
  }
  return fallbackId;
}

const members = [
  { id: 1, is_primary: true },
  { id: 2, is_primary: false },
];

assert.deepEqual(getTargetMemberIds([2], 1), [2]);
assert.deepEqual(getTargetMemberIds([], 1), [1]);
assert.equal(getViewMemberId([2], members, 1), 2);
assert.equal(getViewMemberId([1, 2], members, 1), 1);
assert.equal(getViewMemberId([], members, 2), 2);

console.log("member target helpers: ok");
