"use client";

import { MemberToggles } from "@/components/MemberToggles";
import { useLanguage } from "@/contexts/LanguageContext";
import "./welcome-members.css";

export function WelcomeMembers() {
  const { t } = useLanguage();

  return (
    <div className="welcome-members">
      <MemberToggles variant="welcome" />
      <p className="welcome-members-hint">{String(t("welcome_members_hint"))}</p>
    </div>
  );
}
