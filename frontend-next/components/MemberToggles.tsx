"use client";

import { Icon } from "@iconify/react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMember } from "@/contexts/MemberContext";
import { useToast } from "@/contexts/ToastContext";
import { ApiError } from "@/lib/api/errors";
import {
  createMember,
  deleteMember,
  renameMember,
} from "@/lib/api/members";
import type { TranslationKey } from "@/lib/i18n/translations";
import { memberColor } from "@/lib/members/colors";
import "./member-toggles.css";

type MemberTogglesProps = {
  variant?: "sidebar" | "welcome";
};

function tString(
  t: (key: TranslationKey) => unknown,
  key: TranslationKey,
): string {
  return String(t(key));
}

function tFormat(
  t: (key: TranslationKey) => unknown,
  key: TranslationKey,
  arg: string,
): string {
  const value = t(key);
  if (typeof value === "function") {
    return String((value as (name: string) => string)(arg));
  }
  return String(value);
}

export function MemberToggles({ variant = "sidebar" }: MemberTogglesProps) {
  const { t } = useLanguage();
  const { showError, showSuccess, showConfirm } = useToast();
  const {
    members,
    includedMemberIds,
    toggleIncludedMember,
    reload,
    includeMember,
    excludeMember,
  } = useMember();

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  useEffect(() => {
    if (editingId) renameInputRef.current?.focus();
  }, [editingId]);

  const cancelAdd = () => {
    setAdding(false);
    setNewName("");
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditName("");
  };

  const startRename = (memberId: number, name: string) => {
    setEditingId(memberId);
    setEditName(name);
    cancelAdd();
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) {
      cancelAdd();
      return;
    }
    try {
      const created = await createMember(name);
      await reload();
      includeMember(created.id);
      setNewName("");
      setAdding(false);
      showSuccess(tFormat(t, "member_added", name));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : tString(t, "err_member_add");
      showError(message);
    }
  };

  const handleRename = async (memberId: number) => {
    const name = editName.trim();
    if (!name) {
      cancelRename();
      return;
    }
    const member = members.find((m) => m.id === memberId);
    if (member?.name === name) {
      cancelRename();
      return;
    }
    try {
      await renameMember(memberId, name);
      await reload();
      cancelRename();
      showSuccess(tString(t, "member_renamed"));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : tString(t, "err_member_rename");
      showError(message);
    }
  };

  const handleToggle = (memberId: number) => {
    const checked = includedMemberIds.includes(memberId);
    if (checked && includedMemberIds.length <= 1) return;
    toggleIncludedMember(memberId);
  };

  const handleDelete = (memberId: number, memberName: string) => {
    showConfirm({
      title: tFormat(t, "member_delete_title", memberName),
      message: tString(t, "member_delete_confirm"),
      confirmLabel: tString(t, "btn_delete"),
      onConfirm: async () => {
        try {
          await deleteMember(memberId);
          excludeMember(memberId);
          await reload();
          showSuccess(tFormat(t, "member_deleted", memberName));
        } catch (err) {
          const message =
            err instanceof ApiError
              ? err.message
              : tString(t, "err_member_delete");
          showError(message);
        }
      },
    });
  };

  const onAddSubmit = (e: FormEvent) => {
    e.preventDefault();
    void handleAdd();
  };

  return (
    <div
      className={`member-toggles member-toggles--${variant}`}
      role="group"
      aria-label={tString(t, "welcome_include_members")}
    >
      {members.map((member, idx) => {
        const checked = includedMemberIds.includes(member.id);
        const color = memberColor(idx);
        const locked = checked && includedMemberIds.length === 1;
        const chipStyle = {
          "--member-color": color,
          borderColor: checked ? color : undefined,
          background: checked ? `${color}18` : undefined,
          color: checked ? color : undefined,
        } as CSSProperties;

        return (
          <span
            key={member.id}
            className="member-toggle-wrap"
            title={tString(t, "member_switch_hint")}
          >
            {editingId === member.id ? (
              <form
                className="member-toggle-add-form member-toggle-rename-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleRename(member.id);
                }}
              >
                <input
                  ref={renameInputRef}
                  type="text"
                  className="member-toggle-add-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={tString(t, "member_name_ph")}
                  maxLength={40}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") cancelRename();
                  }}
                  onBlur={() => {
                    if (!editName.trim()) {
                      cancelRename();
                      return;
                    }
                    void handleRename(member.id);
                  }}
                />
                <button
                  type="submit"
                  className="member-toggle-add-confirm"
                  aria-label={tString(t, "save_btn")}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Icon icon="heroicons:check" width={14} />
                </button>
              </form>
            ) : (
              <>
                <button
                  type="button"
                  className={`member-toggle${checked ? " member-toggle--on" : ""}${locked ? " member-toggle--locked" : ""}`}
                  onClick={() => handleToggle(member.id)}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    startRename(member.id, member.name);
                  }}
                  aria-disabled={locked || undefined}
                  title={
                    locked
                      ? tString(t, "welcome_include_min_one")
                      : tString(t, "member_switch_hint")
                  }
                  aria-pressed={checked}
                  style={chipStyle}
                >
                  <span className="member-toggle-dot" />
                  {member.name}
                </button>
                <button
                  type="button"
                  className="member-toggle-edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(member.id, member.name);
                  }}
                  aria-label={tString(t, "member_rename_btn")}
                  title={tString(t, "member_rename_btn")}
                >
                  <Icon icon="heroicons:pencil-square" width={11} />
                </button>
              </>
            )}
            {!member.is_primary && editingId !== member.id && (
              <button
                type="button"
                className="member-toggle-del"
                onClick={() => handleDelete(member.id, member.name)}
                aria-label={tFormat(t, "member_delete_title", member.name)}
                title={tString(t, "btn_delete")}
              >
                <Icon icon="heroicons:x-mark" width={10} />
              </button>
            )}
          </span>
        );
      })}

      {adding ? (
        <form className="member-toggle-add-form" onSubmit={onAddSubmit}>
          <input
            ref={inputRef}
            type="text"
            className="member-toggle-add-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={tString(t, "member_name_ph")}
            maxLength={40}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancelAdd();
            }}
            onBlur={() => {
              if (!newName.trim()) cancelAdd();
            }}
          />
          <button
            type="submit"
            className="member-toggle-add-confirm"
            aria-label={tString(t, "welcome_add_profile")}
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
          aria-label={tString(t, "welcome_add_profile")}
        >
          <Icon icon="heroicons:plus" width={variant === "sidebar" ? 14 : 16} />
        </button>
      )}
    </div>
  );
}
