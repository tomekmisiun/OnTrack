import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { members as membersApi } from '../api';

const MemberContext = createContext(null);

export function MemberProvider({ children }) {
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

  useEffect(() => { reload(); }, [reload]);

  const setActiveMember = (id) => {
    setActiveMemberId(id);
    localStorage.setItem('activeMemberId', String(id));
  };

  const activeMember = members.find(m => m.id === activeMemberId) || members[0] || null;

  return (
    <MemberContext.Provider value={{ members, activeMember, setActiveMember, reload }}>
      {children}
    </MemberContext.Provider>
  );
}

export function useMember() {
  return useContext(MemberContext);
}
