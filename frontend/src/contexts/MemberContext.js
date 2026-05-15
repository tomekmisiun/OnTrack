import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { members as membersApi } from '../api';
import { useAuth } from './AuthContext';

const MemberContext = createContext(null);

export function MemberProvider({ children }) {
  const { user } = useAuth();
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

  // Załaduj gdy user się zaloguje, wyczyść gdy wyloguje
  useEffect(() => {
    if (user) { reload(); }
    else { setMembers([]); }
  }, [user?.id, reload]);

  const setActiveMember = (id) => {
    setActiveMemberId(id);
    localStorage.setItem('activeMemberId', String(id));
    const m = members.find(x => x.id === id);
    if (m) localStorage.setItem('activeMemberName', m.name);
  };

  const activeMember = members.find(m => m.id === activeMemberId) || members[0] || null;

  // Zapisz nazwę gdy się zmieni (po załadowaniu)
  useEffect(() => {
    if (activeMember) localStorage.setItem('activeMemberName', activeMember.name);
  }, [activeMember?.id]);

  return (
    <MemberContext.Provider value={{ members, activeMember, setActiveMember, reload, activeMemberName: activeMember?.name || localStorage.getItem('activeMemberName') || 'Ja' }}>
      {children}
    </MemberContext.Provider>
  );
}

export function useMember() {
  return useContext(MemberContext);
}
