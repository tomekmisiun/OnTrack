import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { members as membersApi } from '../api';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { getViewMemberId } from '../utils/memberTargets';

const MemberContext = createContext(null);

const DEFAULT_PRIMARY = { pl: 'Ja', en: 'Me' };
const INCLUDED_STORAGE_KEY = 'includedMemberIds';

function loadIncludedIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(INCLUDED_STORAGE_KEY) || 'null');
    if (Array.isArray(parsed) && parsed.length) return parsed.map(Number).filter(Boolean);
  } catch {}
  return [];
}

function localizePrimaryName(name, lang, isPrimary) {
  if (!isPrimary) return name;
  const other = lang === 'pl' ? 'Me' : 'Ja';
  if (name === other) return DEFAULT_PRIMARY[lang] || name;
  return name;
}

export function MemberProvider({ children }) {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [members, setMembers] = useState([]);
  const [activeMemberId, setActiveMemberId] = useState(
    () => parseInt(localStorage.getItem('activeMemberId') || '0') || null
  );
  const [includedMemberIds, setIncludedMemberIds] = useState(loadIncludedIds);

  const reload = useCallback(async () => {
    try {
      const res = await membersApi.getAll();
      const list = res.data;
      setMembers(list);
      setActiveMemberId(prev => {
        const still = list.find(m => m.id === prev);
        if (still) return prev;
        const primary = list.find(m => m.is_primary);
        const id = primary?.id || list[0]?.id || null;
        if (id) localStorage.setItem('activeMemberId', id);
        return id;
      });
    } catch {}
  }, []);

  useEffect(() => {
    if (!user) {
      setMembers([]);
      setIncludedMemberIds([]);
      return;
    }
    reload();
  }, [user?.id, user?.lang, reload]);

  useEffect(() => {
    if (!members.length) return;
    setIncludedMemberIds(prev => {
      const valid = prev.filter(id => members.some(m => m.id === id));
      if (valid.length > 0) return valid;
      const fallback = activeMemberId
        || members.find(m => m.is_primary)?.id
        || members[0]?.id;
      return fallback ? [fallback] : [];
    });
  }, [members, activeMemberId]);

  useEffect(() => {
    if (!members.length || !includedMemberIds.length) return;
    const viewId = getViewMemberId(includedMemberIds, members, activeMemberId);
    if (!viewId || viewId === activeMemberId) return;
    setActiveMemberId(viewId);
    localStorage.setItem('activeMemberId', String(viewId));
    const m = members.find(x => x.id === viewId);
    if (m) localStorage.setItem('activeMemberName', localizePrimaryName(m.name, lang, m.is_primary));
  }, [includedMemberIds, members, lang]); // eslint-disable-line

  useEffect(() => {
    if (includedMemberIds.length) {
      localStorage.setItem(INCLUDED_STORAGE_KEY, JSON.stringify(includedMemberIds));
    }
  }, [includedMemberIds]);

  const toggleIncludedMember = useCallback((id) => {
    setIncludedMemberIds(prev => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter(x => x !== id);
      }
      return [...prev, id];
    });
  }, []);

  const includeMember = useCallback((id) => {
    setIncludedMemberIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const displayMembers = members.map(m => ({
    ...m,
    name: localizePrimaryName(m.name, lang, m.is_primary),
  }));

  const setActiveMember = (id) => {
    setActiveMemberId(id);
    localStorage.setItem('activeMemberId', String(id));
    const m = displayMembers.find(x => x.id === id);
    if (m) localStorage.setItem('activeMemberName', m.name);
  };

  const activeMember = displayMembers.find(m => m.id === activeMemberId) || displayMembers[0] || null;

  const targetMemberIds = includedMemberIds.length
    ? includedMemberIds
    : (activeMemberId ? [activeMemberId] : []);

  // Zapisz nazwę gdy się zmieni (po załadowaniu)
  useEffect(() => {
    if (activeMember) localStorage.setItem('activeMemberName', activeMember.name);
  }, [activeMember?.id, activeMember?.name]);

  const fallbackName = DEFAULT_PRIMARY[lang] || 'Ja';
  const storedName = localStorage.getItem('activeMemberName');
  const activeMemberName = activeMember?.name
    || (storedName ? localizePrimaryName(storedName, lang, true) : null)
    || fallbackName;

  return (
    <MemberContext.Provider value={{
      members: displayMembers,
      activeMember,
      setActiveMember,
      reload,
      activeMemberName,
      includedMemberIds,
      targetMemberIds,
      toggleIncludedMember,
      includeMember,
    }}>
      {children}
    </MemberContext.Provider>
  );
}

export function useMember() {
  return useContext(MemberContext);
}
