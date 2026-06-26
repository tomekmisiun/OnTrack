"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { AppBackground } from "@/components/layout/AppBackground";
import { AppFooter } from "@/components/layout/AppFooter";
import { ProfileModal } from "@/components/profile/ProfileModal";
import { ProfileModalProvider } from "@/components/profile/ProfileModalContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAppShellDocument } from "@/hooks/useAppShellDocument";
import { useLayoutViewport } from "@/hooks/useLayoutViewport";
import { HOME_PATH } from "@/lib/config/routes";
import { LAYOUT_WIDTH } from "@/lib/layout/constants";
import "@/components/welcome/welcome.css";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isHome = pathname === HOME_PATH;
  const [showProfile, setShowProfile] = useState(false);

  useLayoutViewport(isHome ? LAYOUT_WIDTH.home : LAYOUT_WIDTH.app);
  useAppShellDocument(isHome);

  const profileModal = showProfile ? (
    <ProfileModal onClose={() => setShowProfile(false)} />
  ) : null;

  if (isHome) {
    return (
      <ProfileModalProvider openProfile={() => setShowProfile(true)}>
        <div className="app app--home">
          <AppBackground />
          <main className="app-main app-main--home">
            <div className="app-main-content">{children}</div>
            <AppFooter />
          </main>
          {profileModal}
        </div>
      </ProfileModalProvider>
    );
  }

  return (
    <ProfileModalProvider openProfile={() => setShowProfile(true)}>
      <div className="app">
        <AppBackground />
        <Sidebar onAccount={() => setShowProfile(true)} />
        <main className="app-main">
          <div className="app-main-content">{children}</div>
          <AppFooter />
        </main>
        {profileModal}
      </div>
    </ProfileModalProvider>
  );
}
