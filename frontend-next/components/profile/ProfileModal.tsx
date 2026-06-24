"use client";

import { useState } from "react";
import { changeLanguage } from "@/lib/api/auth";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LangCode } from "@/lib/i18n/translations";
import { tFormatArgs, tString } from "@/lib/i18n/translate";

type ProfileModalProps = {
  onClose: () => void;
  onStartTour?: () => void;
};

export function ProfileModal({ onClose, onStartTour }: ProfileModalProps) {
  const { user, logout, deleteAccount, updateUserLang } = useAuth();
  const { t, switchLang } = useLanguage();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [showLangWarning, setShowLangWarning] = useState(false);
  const [pendingLang, setPendingLang] = useState<LangCode | null>(null);
  const [changingLang, setChangingLang] = useState(false);

  if (!user) return null;

  const handleDelete = async () => {
    if (!window.confirm(tString(t, "delete_confirm"))) return;
    setDeleting(true);
    setError("");
    try {
      await deleteAccount();
      logout();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setDeleting(false);
    }
  };

  const requestLangChange = (newLang: LangCode) => {
    if (newLang === user.lang) return;
    setPendingLang(newLang);
    setShowLangWarning(true);
  };

  const confirmLangChange = async () => {
    if (!pendingLang) return;
    setChangingLang(true);
    setError("");
    try {
      await changeLanguage(pendingLang);
      updateUserLang(pendingLang);
      switchLang(pendingLang);
      setShowLangWarning(false);
      setPendingLang(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setChangingLang(false);
    }
  };

  const langName = (code: LangCode) =>
    code === "pl"
      ? tString(t, "profile_lang_name_pl")
      : tString(t, "profile_lang_name_en");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1f2937",
          borderRadius: 16,
          padding: "32px 28px",
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <h2 style={{ fontSize: 20, color: "#f1f5f9", margin: 0 }}>
            {tString(t, "my_profile")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
              color: "#6b7280",
            }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            style={{
              background: "#ffe0e0",
              color: "#c00",
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 11,
              color: "#0d9488",
              fontWeight: 700,
              letterSpacing: "0.5px",
              marginBottom: 6,
            }}
          >
            {user.username
              ? tString(t, "login_username_ph").toUpperCase()
              : "EMAIL"}
          </div>
          <div
            style={{
              fontSize: 15,
              color: "#f1f5f9",
              padding: "10px 14px",
              background: "#1c3534",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
            }}
          >
            {user.username || user.email}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 11,
              color: "#0d9488",
              fontWeight: 700,
              letterSpacing: "0.5px",
              marginBottom: 10,
            }}
          >
            {tString(t, "account_language")}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {(["pl", "en"] as LangCode[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => requestLangChange(code)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 8,
                  cursor: "pointer",
                  border: `2px solid ${user.lang === code ? "#0d9488" : "#374151"}`,
                  background: user.lang === code ? "#1c3534" : "#1f2937",
                  color: user.lang === code ? "#0d9488" : "#555",
                  fontWeight: user.lang === code ? 700 : 400,
                  fontSize: 14,
                  transition: "all 0.15s",
                }}
              >
                {langName(code)}
              </button>
            ))}
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: "#6b7280",
              lineHeight: 1.5,
            }}
          >
            {(() => {
              const v = t("profile_lang_desc");
              const name = langName(user.lang as LangCode);
              return typeof v === "function"
                ? (v as (n: string) => string)(name)
                : String(v);
            })()}
          </div>
        </div>

        <div style={{ borderTop: "1px solid #374151", paddingTop: 20 }}>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            style={{
              width: "100%",
              padding: "11px",
              border: "none",
              borderRadius: 8,
              background: deleting ? "#ffb3b3" : "#ff4757",
              color: "#1f2937",
              cursor: deleting ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            {deleting ? tString(t, "deleting") : tString(t, "delete_account")}
          </button>
          {onStartTour && (
            <button
              type="button"
              onClick={onStartTour}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #0d9488",
                borderRadius: 8,
                background: "none",
                cursor: "pointer",
                fontSize: 14,
                color: "#0d9488",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              ▶ {tString(t, "show_tutorial")}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #e0e0e0",
              borderRadius: 8,
              background: "none",
              cursor: "pointer",
              fontSize: 14,
              color: "#9ca3af",
            }}
          >
            {tString(t, "close")}
          </button>
        </div>
      </div>

      {showLangWarning && pendingLang && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10001,
          }}
          onClick={() => setShowLangWarning(false)}
        >
          <div
            style={{
              background: "#1f2937",
              borderRadius: 14,
              padding: "28px 24px",
              maxWidth: 380,
              width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>
              ⚠️
            </div>
            <h3
              style={{
                fontSize: 16,
                color: "#f1f5f9",
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              {tString(t, "profile_lang_change_title")}
            </h3>
            <div
              style={{
                fontSize: 13,
                color: "#e2e8f0",
                lineHeight: 1.7,
                marginBottom: 20,
                background: "#111827",
                border: "1px solid #f59e0b55",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <b>{tString(t, "profile_lang_warning_label")}</b>{" "}
              {tFormatArgs(
                t,
                "profile_lang_warning_body",
                langName(user.lang as LangCode),
                langName(pendingLang),
              )}
              <br />
              <br />
              {tString(t, "profile_lang_warning_note")}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => void confirmLangChange()}
                disabled={changingLang}
                style={{
                  flex: 1,
                  padding: "11px",
                  border: "none",
                  borderRadius: 8,
                  background: "#0d9488",
                  color: "#1f2937",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: changingLang ? "not-allowed" : "pointer",
                }}
              >
                {changingLang ? "..." : tString(t, "profile_lang_change_confirm")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLangWarning(false);
                  setPendingLang(null);
                }}
                style={{
                  flex: 1,
                  padding: "11px",
                  border: "1px solid #374151",
                  borderRadius: 8,
                  background: "none",
                  color: "#9ca3af",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {tString(t, "cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
