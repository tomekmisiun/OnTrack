import React, { useState, useRef, useEffect } from 'react';
import { useMember } from '../contexts/MemberContext';
import { members as membersApi } from '../api';
import { useToast } from '../contexts/ToastContext';

const COLORS = ['#0d9488', '#6366f1', '#f59e0b', '#ec4899', '#22c55e', '#ef4444', '#8b5cf6', '#06b6d4'];
const memberColor = (idx) => COLORS[idx % COLORS.length];

export default function MemberPicker() {
  const { members, activeMember, setActiveMember, reload, activeMemberName } = useMember();
  const { showError, showConfirm, showSuccess } = useToast();

  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const ref = useRef();

  // Zamknij dropdown klikając poza nim
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeIdx = members.findIndex(m => m.id === activeMember?.id);
  const activeColor = activeIdx >= 0 ? memberColor(activeIdx) : '#0d9488';

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const res = await membersApi.create(name);
      await reload();
      setActiveMember(res.data.id);
      setNewName(''); setAdding(false);
      showSuccess(`Dodano "${name}"`);
    } catch (e) { showError(e.response?.data?.error || 'Błąd dodawania'); }
  };

  const handleRename = async (m) => {
    const name = editName.trim();
    setEditingId(null);
    if (!name || name === m.name) return;
    try {
      await membersApi.rename(m.id, name);
      await reload();
      showSuccess('Nazwa zmieniona');
    } catch (e) { showError(e.response?.data?.error || 'Błąd zmiany nazwy'); }
  };

  const handleDelete = (m) => {
    showConfirm({
      title: `Usuń "${m.name}"`,
      message: 'Wszystkie zaplanowane posiłki tej osoby zostaną usunięte. Tej operacji nie można cofnąć.',
      confirmLabel: 'Usuń',
      onConfirm: async () => {
        try { await membersApi.delete(m.id); await reload(); showSuccess(`Usunięto "${m.name}"`); }
        catch (e) { showError(e.response?.data?.error || 'Błąd usuwania'); }
      },
    });
  };

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      {/* Przycisk główny */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'rgba(255,255,255,0.15)', border: `1px solid ${activeColor}55`,
          color: '#fff', padding: '5px 13px', borderRadius: 6, cursor: 'pointer',
          fontSize: 12, fontWeight: 600, transition: 'background 0.15s',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: activeColor, flexShrink: 0 }} />
        {activeMemberName}
        <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 10000,
          background: '#1f2937', border: '1px solid #374151', borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)', padding: '8px 0',
          animation: 'fadeInScaleModal 0.15s ease',
        }}>
          {/* Lista członków */}
          {members.map((m, idx) => {
            const active = m.id === activeMember?.id;
            const color = memberColor(idx);
            const isEditing = editingId === m.id;
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', padding: '4px 12px', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                {isEditing ? (
                  <input
                    autoFocus
                    value={editName}
                    maxLength={80}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={() => handleRename(m)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(m); if (e.key === 'Escape') setEditingId(null); }}
                    style={{ flex: 1, padding: '2px 6px', fontSize: 13, border: `1px solid ${color}`, borderRadius: 5, background: '#111827', color: '#f1f5f9' }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span
                    onClick={() => { setActiveMember(m.id); setOpen(false); }}
                    onDoubleClick={() => { setEditingId(m.id); setEditName(m.name); }}
                    title="Kliknij aby przełączyć · Dwuklik aby zmienić nazwę"
                    style={{ flex: 1, fontSize: 13, fontWeight: active ? 700 : 400, color: active ? color : '#e2e8f0', cursor: 'pointer', userSelect: 'none' }}
                  >
                    {m.name}
                    {active && <span style={{ fontSize: 10, color, marginLeft: 6 }}>✓</span>}
                  </span>
                )}
                {!m.is_primary && !isEditing && (
                  <button
                    onClick={() => handleDelete(m)}
                    title="Usuń"
                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 12, padding: '2px 4px', lineHeight: 1 }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}
                  >✕</button>
                )}
              </div>
            );
          })}

          {/* Separator */}
          <div style={{ borderTop: '1px solid #374151', margin: '6px 0' }} />

          {/* Dodaj osobę */}
          {adding ? (
            <div style={{ padding: '4px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <input
                autoFocus
                value={newName}
                maxLength={80}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNewName(''); } }}
                placeholder="Imię..."
                style={{ width: '100%', boxSizing: 'border-box', padding: '4px 8px', fontSize: 12, border: '1px solid #374151', borderRadius: 5, background: '#111827', color: '#f1f5f9' }}
              />
              <button onClick={handleAdd} disabled={!newName.trim()}
                style={{ width: '100%', padding: '5px 0', fontSize: 12, background: '#0d9488', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>
                Dodaj
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              style={{ width: '100%', padding: '6px 12px', background: 'none', border: 'none', color: '#6b7280', fontSize: 12, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={e => e.currentTarget.style.color = '#0d9488'}
              onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}
            >
              <span style={{ fontSize: 14 }}>+</span> Dodaj osobę
            </button>
          )}
        </div>
      )}
    </div>
  );
}
