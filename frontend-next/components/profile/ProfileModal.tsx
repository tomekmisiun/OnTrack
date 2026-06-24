"use client";

import { useState } from "react";
import { changeLanguage, changeMarket } from "@/lib/api/auth";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { MarketCode } from "@/lib/domain/market";
import type { LangCode } from "@/lib/i18n/translations";
import { tFormatArgs, tString } from "@/lib/i18n/translate";
import "./profile-modal.css";

type ProfileModalProps = {
  onClose: () => void;
  onStartTour?: () => void;
};

const MARKETS: MarketCode[] = ["PL", "GB"];

export function ProfileModal({ onClose, onStartTour }: ProfileModalProps) {
  const { user, logout, deleteAccount, updateUserLang, updateUserMarket } =
    useAuth();
  const { t, switchLang } = useLanguage();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [changingLang, setChangingLang] = useState(false);
  const [showMarketWarning, setShowMarketWarning] = useState(false);
  const [pendingMarket, setPendingMarket] = useState<MarketCode | null>(null);
  const [changingMarket, setChangingMarket] = useState(false);

  if (!user) return null;

  const activeLang = user.ui_locale;
  const activeMarket = user.market_code;

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

  const handleLangChange = async (newLang: LangCode) => {
    if (newLang === activeLang || changingLang) return;
    setChangingLang(true);
    setError("");
    try {
      await changeLanguage(newLang);
      updateUserLang(newLang);
      switchLang(newLang);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setChangingLang(false);
    }
  };

  const requestMarketChange = (newMarket: MarketCode) => {
    if (newMarket === activeMarket) return;
    setPendingMarket(newMarket);
    setShowMarketWarning(true);
  };

  const confirmMarketChange = async () => {
    if (!pendingMarket) return;
    setChangingMarket(true);
    setError("");
    try {
      await changeMarket(pendingMarket);
      updateUserMarket(pendingMarket);
      setShowMarketWarning(false);
      setPendingMarket(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setChangingMarket(false);
    }
  };

  const langName = (code: LangCode) =>
    code === "pl"
      ? tString(t, "profile_lang_name_pl")
      : tString(t, "profile_lang_name_en");

  const marketName = (code: MarketCode) =>
    code === "PL"
      ? tString(t, "profile_market_name_pl")
      : tString(t, "profile_market_name_gb");

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
                onClick={() => void handleLangChange(code)}
                disabled={changingLang}
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

        <div className="profile-field">
          <div className="profile-field-label profile-field-label--lang">
            {tString(t, "account_market")}
          </div>
          <div className="profile-lang-row">
            {MARKETS.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => requestMarketChange(code)}
                className={`profile-lang-btn${activeMarket === code ? " profile-lang-btn--active" : ""}`}
              >
                {marketName(code)}
              </button>
            ))}
          </div>
          <div className="profile-lang-desc">
            {(() => {
              const v = t("profile_market_desc");
              const name = marketName(activeMarket);
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

      {showMarketWarning && pendingMarket && (
        <div
          className="profile-warning-backdrop"
          onClick={() => setShowMarketWarning(false)}
        >
          <div
            className="profile-warning-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="profile-warning-icon">⚠️</div>
            <h3 className="profile-warning-title">
              {tString(t, "profile_market_change_title")}
            </h3>
            <div className="profile-warning-body">
              <b>{tString(t, "profile_market_warning_label")}</b>{" "}
              {tFormatArgs(
                t,
                "profile_market_warning_body",
                marketName(activeMarket),
                marketName(pendingMarket),
              )}
              <br />
              <br />
              {tString(t, "profile_market_warning_note")}
            </div>
            <div className="profile-warning-actions">
              <button
                type="button"
                onClick={() => void confirmMarketChange()}
                disabled={changingMarket}
                className="profile-warning-confirm"
              >
                {changingMarket
                  ? "..."
                  : tString(t, "profile_market_change_confirm")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMarketWarning(false);
                  setPendingMarket(null);
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
