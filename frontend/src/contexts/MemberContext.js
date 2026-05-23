import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { members as membersApi } from '../api';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';

const MemberContext = createContext(null);

const DEFAULT_PRIMARY = { pl: 'Ja', en: 'Me' };

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

  // Załaduj gdy user się zaloguje, zmieni język, wyczyść gdy wyloguje
  useEffect(() => {
    if (user) { reload(); }
    else { setMembers([]); }
  }, [user?.id, user?.lang, reload]);

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
    <MemberContext.Provider value={{ members: displayMembers, activeMember, setActiveMember, reload, activeMemberName }}>
      {children}
    </MemberContext.Provider>
  );
}

export function useMember() {
  return useContext(MemberContext);
}
