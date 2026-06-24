"use client";

import { useState } from "react";
import { changeLanguage } from "@/lib/api/auth";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LangCode } from "@/lib/i18n/translations";
import { tFormatArgs, tString } from "@/lib/i18n/translate";
import "./profile-modal.css";

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

  const activeLang = user.ui_locale;

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
    if (newLang === activeLang) return;
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
    <div className="profile-modal-backdrop" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h2 className="profile-modal-title">{tString(t, "my_profile")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="profile-modal-close"
          >
            ✕
          </button>
        </div>

        {error && <div className="profile-modal-error">{error}</div>}

        <div className="profile-field">
          <div className="profile-field-label">
            {user.username
              ? tString(t, "login_username_ph").toUpperCase()
              : "EMAIL"}
          </div>
          <div className="profile-field-value">
            {user.username || user.email}
          </div>
        </div>

        <div className="profile-field">
          <div className="profile-field-label profile-field-label--lang">
            {tString(t, "account_language")}
          </div>
          <div className="profile-lang-row">
            {(["pl", "en"] as LangCode[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => requestLangChange(code)}
                className={`profile-lang-btn${activeLang === code ? " profile-lang-btn--active" : ""}`}
              >
                {langName(code)}
              </button>
            ))}
          </div>
          <div className="profile-lang-desc">
            {(() => {
              const v = t("profile_lang_desc");
              const name = langName(activeLang);
              return typeof v === "function"
                ? (v as (n: string) => string)(name)
                : String(v);
            })()}
          </div>
        </div>

        <div className="profile-actions">
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="profile-btn profile-btn-delete"
          >
            {deleting ? tString(t, "deleting") : tString(t, "delete_account")}
          </button>
          {onStartTour && (
            <button
              type="button"
              onClick={onStartTour}
              className="profile-btn profile-btn-tour"
            >
              ▶ {tString(t, "show_tutorial")}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="profile-btn profile-btn-close"
          >
            {tString(t, "close")}
          </button>
        </div>
      </div>

      {showLangWarning && pendingLang && (
        <div
          className="profile-warning-backdrop"
          onClick={() => setShowLangWarning(false)}
        >
          <div
            className="profile-warning-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="profile-warning-icon">⚠️</div>
            <h3 className="profile-warning-title">
              {tString(t, "profile_lang_change_title")}
            </h3>
            <div className="profile-warning-body">
              <b>{tString(t, "profile_lang_warning_label")}</b>{" "}
              {tFormatArgs(
                t,
                "profile_lang_warning_body",
                langName(activeLang),
                langName(pendingLang),
              )}
              <br />
              <br />
              {tString(t, "profile_lang_warning_note")}
            </div>
            <div className="profile-warning-actions">
              <button
                type="button"
                onClick={() => void confirmLangChange()}
                disabled={changingLang}
                className="profile-warning-confirm"
              >
                {changingLang ? "..." : tString(t, "profile_lang_change_confirm")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLangWarning(false);
                  setPendingLang(null);
                }}
                className="profile-warning-cancel"
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
