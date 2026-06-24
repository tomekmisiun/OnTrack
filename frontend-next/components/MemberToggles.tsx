"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type CSSProperties,
} from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMember } from "@/contexts/MemberContext";
import { useToast } from "@/contexts/ToastContext";
import {
  createMember,
  deleteMember,
  renameMember,
} from "@/lib/api/members";
import { memberColor } from "@/lib/members/colors";
import { ApiError } from "@/lib/api/errors";
import type { TranslationKey } from "@/lib/i18n/translations";

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
      className={`flex flex-wrap gap-1.5 ${
        variant === "sidebar" ? "text-xs" : "text-sm"
      }`}
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
          <span key={member.id} className="inline-flex items-center gap-0.5">
            {editingId === member.id ? (
              <form
                className="inline-flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleRename(member.id);
                }}
              >
                <input
                  ref={renameInputRef}
                  type="text"
                  className="w-24 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100"
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
                  className="cursor-pointer rounded bg-teal-700 px-1.5 py-1 text-[10px] text-white"
                  aria-label={tString(t, "save_btn")}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  ✓
                </button>
              </form>
            ) : (
              <>
                <button
                  type="button"
                  className={`inline-flex cursor-pointer items-center gap-1 rounded-full border border-slate-600 px-2 py-1 font-medium text-slate-300 ${
                    checked ? "border-[var(--member-color)]" : ""
                  } ${locked ? "opacity-90" : ""}`}
                  style={chipStyle}
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
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-current opacity-80"
                    aria-hidden
                  />
                  {member.name}
                </button>
                <button
                  type="button"
                  className="cursor-pointer rounded px-1 text-[10px] text-slate-500 hover:text-slate-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(member.id, member.name);
                  }}
                  aria-label={tString(t, "member_rename_btn")}
                  title={tString(t, "member_rename_btn")}
                >
                  ✎
                </button>
              </>
            )}
            {!member.is_primary && editingId !== member.id && (
              <button
                type="button"
                className="cursor-pointer rounded px-1 text-[10px] text-slate-500 hover:text-red-400"
                onClick={() => handleDelete(member.id, member.name)}
                aria-label={tFormat(t, "member_delete_title", member.name)}
                title={tString(t, "btn_delete")}
              >
                ×
              </button>
            )}
          </span>
        );
      })}

      {adding ? (
        <form className="inline-flex items-center gap-1" onSubmit={onAddSubmit}>
          <input
            ref={inputRef}
            type="text"
            className="w-24 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100"
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
            className="cursor-pointer rounded bg-teal-700 px-1.5 py-1 text-[10px] text-white"
            aria-label={tString(t, "welcome_add_profile")}
            onMouseDown={(e) => e.preventDefault()}
          >
            ✓
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-slate-600 text-slate-400 hover:border-teal-500 hover:text-teal-400"
          onClick={() => setAdding(true)}
          aria-label={tString(t, "welcome_add_profile")}
        >
          +
        </button>
      )}
    </div>
  );
}
