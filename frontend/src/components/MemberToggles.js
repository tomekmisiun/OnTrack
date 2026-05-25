import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useMember } from '../contexts/MemberContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { members as membersApi } from '../api';
import { memberColor } from '../utils/memberColors';
import './MemberToggles.css';

export default function MemberToggles({ variant = 'sidebar' }) {
  const { t } = useLanguage();
  const { showError, showSuccess, showConfirm } = useToast();
  const {
    members,
    includedMemberIds,
    toggleIncludedMember,
    reload,
    includeMember,
  } = useMember();

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const cancelAdd = () => {
    setAdding(false);
    setNewName('');
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) {
      cancelAdd();
      return;
    }
    try {
      const res = await membersApi.create(name);
      await reload();
      includeMember(res.data.id);
      setNewName('');
      setAdding(false);
      showSuccess(t('member_added')(name));
    } catch (e) {
      showError(e.response?.data?.error || t('err_member_add'));
    }
  };

  const handleToggle = (m) => {
    const checked = includedMemberIds.includes(m.id);
    if (checked && includedMemberIds.length <= 1) return;
    toggleIncludedMember(m.id);
  };

  const handleDelete = (m) => {
    showConfirm({
      title: t('member_delete_title')(m.name),
      message: t('member_delete_confirm'),
      confirmLabel: t('btn_delete'),
      onConfirm: async () => {
        try {
          await membersApi.delete(m.id);
          await reload();
          showSuccess(t('member_deleted')(m.name));
        } catch (e) {
          showError(e.response?.data?.error || t('err_member_delete'));
        }
      },
    });
  };

  return (
    <div
      className={`member-toggles member-toggles--${variant}`}
      role="group"
      aria-label={t('welcome_include_members')}
    >
      {members.map((m, idx) => {
        const checked = includedMemberIds.includes(m.id);
        const color = memberColor(idx);
        const locked = checked && includedMemberIds.length === 1;

        return (
          <span key={m.id} className="member-toggle-wrap">
            <button
              type="button"
              className={`member-toggle${checked ? ' member-toggle--on' : ''}`}
              onClick={() => handleToggle(m)}
              disabled={locked}
              title={locked ? t('welcome_include_min_one') : undefined}
              aria-pressed={checked}
              style={{
                '--member-color': color,
                borderColor: checked ? color : undefined,
                background: checked ? `${color}18` : undefined,
                color: checked ? color : undefined,
              }}
            >
              <span className="member-toggle-dot" />
              {m.name}
            </button>
            {!m.is_primary && (
              <button
                type="button"
                className="member-toggle-del"
                onClick={() => handleDelete(m)}
                aria-label={t('member_delete_title')(m.name)}
                title={t('btn_delete')}
              >
                <Icon icon="heroicons:x-mark" width={10} />
              </button>
            )}
          </span>
        );
      })}

      {adding ? (
        <form
          className="member-toggle-add-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleAdd();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            className="member-toggle-add-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('member_name_ph')}
            maxLength={40}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelAdd();
            }}
            onBlur={() => {
              if (!newName.trim()) cancelAdd();
            }}
          />
          <button
            type="submit"
            className="member-toggle-add-confirm"
            aria-label={t('welcome_add_profile')}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Icon icon="heroicons:check" width={14} />
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="member-toggle-add"
          onClick={() => setAdding(true)}
          aria-label={t('welcome_add_profile')}
        >
          <Icon icon="heroicons:plus" width={variant === 'sidebar' ? 14 : 16} />
        </button>
      )}
    </div>
  );
}
