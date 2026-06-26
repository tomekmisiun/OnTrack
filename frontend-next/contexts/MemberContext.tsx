"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { listMembers } from "@/lib/api/members";
import {
  defaultPrimaryName,
  localizePrimaryName,
} from "@/lib/members/localize";
import {
  loadActiveMemberId,
  loadActiveMemberName,
  loadIncludedMemberIds,
  saveActiveMemberId,
  saveActiveMemberName,
  saveIncludedMemberIds,
  clearMemberStorage,
} from "@/lib/members/storage";
import { getTargetMemberIds, getViewMemberId } from "@/lib/members/targets";
import type { LangCode } from "@/lib/i18n/translations";
import type { Member } from "@/types/member";

export type DisplayMember = Member & { name: string };

export type MemberContextValue = {
  members: DisplayMember[];
  activeMember: DisplayMember | null;
  setActiveMember: (id: number) => void;
  reload: () => Promise<void>;
  activeMemberName: string;
  includedMemberIds: number[];
  targetMemberIds: number[];
  toggleIncludedMember: (id: number) => void;
  includeMember: (id: number) => void;
};

const MemberContext = createContext<MemberContextValue | null>(null);

function withLocalizedNames(members: Member[], lang: LangCode): DisplayMember[] {
  return members.map((member) => ({
    ...member,
    name: localizePrimaryName(member.name, lang, member.is_primary),
  }));
}

export function MemberProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [members, setMembers] = useState<Member[]>([]);
  const [activeMemberId, setActiveMemberId] = useState<number | null>(() =>
    loadActiveMemberId(),
  );
  const [includedMemberIds, setIncludedMemberIds] = useState<number[]>(() =>
    loadIncludedMemberIds(),
  );

  const reload = useCallback(async () => {
    try {
      const list = await listMembers();
      setMembers(list);
      setActiveMemberId((prev) => {
        const still = list.find((m) => m.id === prev);
        if (still) return prev;
        const primary = list.find((m) => m.is_primary);
        const id = primary?.id ?? list[0]?.id ?? null;
        if (id) saveActiveMemberId(id);
        return id;
      });
    } catch {
      // keep prior state on transient errors
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setMembers([]);
      setIncludedMemberIds([]);
      setActiveMemberId(null);
      clearMemberStorage();
      return;
    }
    void reload();
  }, [user, reload]);

  useEffect(() => {
    if (!members.length) return;
    setIncludedMemberIds((prev) => {
      const valid = prev.filter((id) => members.some((m) => m.id === id));
      if (valid.length > 0) return valid;
      const fallback =
        activeMemberId ??
        members.find((m) => m.is_primary)?.id ??
        members[0]?.id ??
        null;
      return fallback ? [fallback] : [];
    });
  }, [members, activeMemberId]);

  useEffect(() => {
    if (!members.length || !includedMemberIds.length) return;
    const viewId = getViewMemberId(includedMemberIds, members, activeMemberId);
    if (!viewId || viewId === activeMemberId) return;
    setActiveMemberId(viewId);
    saveActiveMemberId(viewId);
    const member = members.find((m) => m.id === viewId);
    if (member) {
      saveActiveMemberName(
        localizePrimaryName(member.name, lang, member.is_primary),
      );
    }
  }, [includedMemberIds, members, lang, activeMemberId]);

  useEffect(() => {
    saveIncludedMemberIds(includedMemberIds);
  }, [includedMemberIds]);

  const toggleIncludedMember = useCallback((id: number) => {
    setIncludedMemberIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }, []);

  const includeMember = useCallback((id: number) => {
    setIncludedMemberIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const displayMembers = useMemo(
    () => withLocalizedNames(members, lang),
    [members, lang],
  );

  const setActiveMember = useCallback(
    (id: number) => {
      setActiveMemberId(id);
      saveActiveMemberId(id);
      const member = displayMembers.find((m) => m.id === id);
      if (member) saveActiveMemberName(member.name);
    },
    [displayMembers],
  );

  const activeMember =
    displayMembers.find((m) => m.id === activeMemberId) ??
    displayMembers[0] ??
    null;

  const targetMemberIds = getTargetMemberIds(
    includedMemberIds,
    activeMemberId,
  );

  useEffect(() => {
    if (activeMember) saveActiveMemberName(activeMember.name);
  }, [activeMember]);

  const activeMemberName = useMemo(() => {
    if (activeMember?.name) return activeMember.name;
    const stored = loadActiveMemberName();
    if (stored) return localizePrimaryName(stored, lang, true);
    return defaultPrimaryName(lang);
  }, [activeMember, lang]);

  const value = useMemo(
    () => ({
      members: displayMembers,
      activeMember,
      setActiveMember,
      reload,
      activeMemberName,
      includedMemberIds,
      targetMemberIds,
      toggleIncludedMember,
      includeMember,
    }),
    [
      displayMembers,
      activeMember,
      setActiveMember,
      reload,
      activeMemberName,
      includedMemberIds,
      targetMemberIds,
      toggleIncludedMember,
      includeMember,
    ],
  );

  return (
    <MemberContext.Provider value={value}>{children}</MemberContext.Provider>
  );
}

export function useMember(): MemberContextValue {
  const ctx = useContext(MemberContext);
  if (!ctx) {
    throw new Error("useMember must be used within MemberProvider");
  }
  return ctx;
}
