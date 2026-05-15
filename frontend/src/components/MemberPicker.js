import React, { useState } from 'react';
import { useMember } from '../contexts/MemberContext';
import { members as membersApi } from '../api';
import { useToast } from '../contexts/ToastContext';

const COLORS = ['#0d9488', '#6366f1', '#f59e0b', '#ec4899', '#22c55e', '#ef4444', '#8b5cf6', '#06b6d4'];

function memberColor(idx) {
  return COLORS[idx % COLORS.length];
}

export default function MemberPicker() {
  const { members, activeMember, setActiveMember, reload } = useMember();
  const { showError, showConfirm, showSuccess } = useToast();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  if (!members.length) return null;

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await membersApi.create(name);
      await reload();
      setActiveMember(res.data.id);
      setNewName('');
      setAdding(false);
      showSuccess(`Dodano "${name}"`);
    } catch (e) {
      showError(e.response?.data?.error || 'Błąd dodawania');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (m) => {
    showConfirm({
      title: `Usuń "${m.name}"`,
      message: 'Wszystkie zaplanowane posiłki tej osoby zostaną usunięte. Tej operacji nie można cofnąć.',
      confirmLabel: 'Usuń',
      onConfirm: async () => {
        try {
          await membersApi.delete(m.id);
          await reload();
          showSuccess(`Usunięto "${m.name}"`);
        } catch (e) {
          showError(e.response?.data?.error || 'Błąd usuwania');
        }
      },
    });
  };

  return (
    <div style={{ background: '#111827', borderBottom: '1px solid #374151', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, color: '#6b7280', marginRight: 4, flexShrink: 0 }}>Profil:</span>

      {members.map((m, idx) => {
        const active = m.id === activeMember?.id;
        const color = memberColor(idx);
        return (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <button
              onClick={() => setActiveMember(m.id)}
              style={{
                padding: '4px 12px', border: `1px solid ${active ? color : '#374151'}`,
                borderRadius: m.is_primary ? '6px 0 0 6px' : 6,
                background: active ? color : '#1f2937',
                color: active ? '#fff' : '#9ca3af',
                fontSize: 12, fontWeight: active ? 700 : 400,
                cursor: 'pointer', transition: 'all 0.15s',
                borderRight: !m.is_primary ? undefined : '1px solid #374151',
              }}
            >
              {m.name}
            </button>
            {!m.is_primary && (
              <button
                onClick={() => handleDelete(m)}
                title={`Usuń ${m.name}`}
                style={{
                  padding: '4px 6px', border: `1px solid ${active ? color : '#374151'}`,
                  borderLeft: 'none', borderRadius: '0 6px 6px 0',
                  background: active ? color : '#1f2937',
                  color: active ? 'rgba(255,255,255,0.7)' : '#6b7280',
                  fontSize: 10, cursor: 'pointer', lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}
          </div>
        );
      })}

      {adding ? (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            autoFocus
            value={newName}
            maxLength={80}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNewName(''); } }}
            placeholder="Imię..."
            style={{ padding: '3px 8px', fontSize: 12, border: '1px solid #374151', borderRadius: 6, background: '#1f2937', color: '#f1f5f9', width: 100 }}
          />
          <button onClick={handleAdd} disabled={saving || !newName.trim()}
            style={{ padding: '3px 10px', fontSize: 12, background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            Dodaj
          </button>
          <button onClick={() => { setAdding(false); setNewName(''); }}
            style={{ padding: '3px 8px', fontSize: 12, background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            Anuluj
          </button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          style={{ padding: '4px 10px', fontSize: 12, background: 'none', border: '1px dashed #374151', borderRadius: 6, color: '#6b7280', cursor: 'pointer' }}>
          + Dodaj osobę
        </button>
      )}
    </div>
  );
}
